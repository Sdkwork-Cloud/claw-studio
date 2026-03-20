import type { HubInstallAssessmentResult } from '@sdkwork/claw-infrastructure';

export type InstallRecommendationHostOs = 'windows' | 'macos' | 'linux' | 'unknown';
export type InstallRecommendationState =
  | 'installed'
  | 'ready'
  | 'setupNeeded'
  | 'fixFirst'
  | 'checking'
  | 'comingSoon';
export type InstallRecommendationReason =
  | 'installed'
  | 'platformPreferred'
  | 'bestReadyFallback'
  | 'requiresSetup'
  | 'singlePath';
export type InstallAssessmentLoadStatus = 'idle' | 'loading' | 'success' | 'error';

export interface InstallChoiceAssessmentState {
  status: InstallAssessmentLoadStatus;
  result?: HubInstallAssessmentResult;
  error?: string;
}

export interface InstallChoiceCandidate<TId extends string = string> {
  id: TId;
  softwareName: string;
  disabled?: boolean;
  assessment?: InstallChoiceAssessmentState;
}

export interface InstallChoiceRecommendation<TId extends string = string>
  extends InstallChoiceCandidate<TId> {
  state: InstallRecommendationState;
  score: number;
  blockers: number;
  warnings: number;
  autoFixes: number;
  hasExistingInstall: boolean;
  effectiveRuntimePlatform: string | null;
  primaryIssue: string | null;
  recommendationReason: InstallRecommendationReason;
}

export interface InstallPlatformSignals {
  hostOs: InstallRecommendationHostOs;
  arch: string | null;
  runtimePlatform: string | null;
  wslAvailable: boolean | null;
  dockerAvailable: boolean | null;
  nodeAvailable: boolean | null;
}

export interface InstallRecommendationSummary<TId extends string = string> {
  primaryChoice: InstallChoiceRecommendation<TId> | null;
  choices: InstallChoiceRecommendation<TId>[];
  secondaryChoices: InstallChoiceRecommendation<TId>[];
  recoveryChoices: InstallChoiceRecommendation<TId>[];
  readyChoiceCount: number;
  fixFirstChoiceCount: number;
  platformSignals: InstallPlatformSignals;
}

const ACTIONABLE_STATES = new Set<InstallRecommendationState>(['installed', 'ready', 'setupNeeded']);
const STATE_ORDER: Record<InstallRecommendationState, number> = {
  installed: 0,
  ready: 1,
  setupNeeded: 2,
  fixFirst: 3,
  checking: 4,
  comingSoon: 5,
};

function countBlockers(result?: HubInstallAssessmentResult) {
  return result?.issues.filter((item) => item.severity === 'error').length ?? 0;
}

function countWarnings(result?: HubInstallAssessmentResult) {
  return result?.issues.filter((item) => item.severity === 'warning').length ?? 0;
}

function countAutoFixes(result?: HubInstallAssessmentResult) {
  return (
    result?.dependencies.filter(
      (item) => item.status === 'remediable' && item.supportsAutoRemediation,
    ).length ?? 0
  );
}

function matchesCommandKey(commandName: string, expected: string) {
  const normalized = commandName.toLowerCase();
  return normalized === expected || normalized.includes(expected);
}

function hasCommand(result: HubInstallAssessmentResult | undefined, commandName: string) {
  if (!result) {
    return false;
  }

  return Object.entries(result.runtime.commandAvailability).some(
    ([name, present]) => present && matchesCommandKey(name, commandName),
  );
}

function hasDockerRuntime(result: HubInstallAssessmentResult | undefined) {
  if (!result) {
    return false;
  }

  return result.runtime.hostDockerAvailable || result.runtime.wslDockerAvailable;
}

function resolveChoiceState(choice: InstallChoiceCandidate) {
  if (choice.disabled) {
    return 'comingSoon' as const;
  }

  const assessment = choice.assessment;
  if (!assessment || assessment.status === 'idle' || assessment.status === 'loading') {
    return 'checking' as const;
  }

  if (assessment.status === 'error' || !assessment.result) {
    return 'fixFirst' as const;
  }

  if (assessment.result.installStatus === 'installed') {
    return 'installed' as const;
  }

  const blockers = countBlockers(assessment.result);
  if (blockers > 0 || !assessment.result.ready) {
    return 'fixFirst' as const;
  }

  const warnings = countWarnings(assessment.result);
  const autoFixes = countAutoFixes(assessment.result);
  if (warnings > 0 || autoFixes > 0) {
    return 'setupNeeded' as const;
  }

  return 'ready' as const;
}

function getHostAffinityScore(hostOs: InstallRecommendationHostOs, choiceId: string) {
  if (hostOs === 'windows') {
    if (choiceId === 'wsl') return 45;
    if (choiceId === 'docker') return 30;
    if (choiceId === 'npm') return 18;
    if (choiceId === 'pnpm') return 16;
    if (choiceId === 'source') return 10;
  }

  if (hostOs === 'macos' || hostOs === 'linux') {
    if (choiceId === 'npm') return 34;
    if (choiceId === 'pnpm') return 32;
    if (choiceId === 'docker') return 24;
    if (choiceId === 'source') return 18;
  }

  return 8;
}

function getCapabilityScore(
  choiceId: string,
  result: HubInstallAssessmentResult | undefined,
  hostOs: InstallRecommendationHostOs,
) {
  if (!result) {
    return 0;
  }

  if (choiceId === 'wsl') {
    return result.runtime.wslAvailable ? 24 : hostOs === 'windows' ? -28 : -12;
  }

  if (choiceId === 'docker') {
    return hasDockerRuntime(result) ? 18 : -16;
  }

  if (choiceId === 'npm') {
    let score = hasCommand(result, 'node') ? 16 : -18;
    score += hasCommand(result, 'npm') ? 6 : -4;
    return score;
  }

  if (choiceId === 'pnpm') {
    let score = hasCommand(result, 'node') ? 16 : -18;
    score += hasCommand(result, 'pnpm') ? 8 : -6;
    return score;
  }

  if (choiceId === 'source') {
    let score = hasCommand(result, 'git') ? 8 : 0;
    score += hasCommand(result, 'cargo') ? 6 : 0;
    return score;
  }

  return 0;
}

function getStateScore(state: InstallRecommendationState) {
  if (state === 'installed') return 220;
  if (state === 'ready') return 140;
  if (state === 'setupNeeded') return 118;
  if (state === 'fixFirst') return 32;
  if (state === 'checking') return 10;
  return -200;
}

function buildChoiceRecommendation<TId extends string>(
  choice: InstallChoiceCandidate<TId>,
  hostOs: InstallRecommendationHostOs,
  productPreferredChoiceId: TId,
): InstallChoiceRecommendation<TId> {
  const result = choice.assessment?.result;
  const state = resolveChoiceState(choice);
  const blockers = countBlockers(result);
  const warnings = countWarnings(result);
  const autoFixes = countAutoFixes(result);
  const score =
    getStateScore(state) +
    getHostAffinityScore(hostOs, choice.id) +
    getCapabilityScore(choice.id, result, hostOs) +
    (choice.id === productPreferredChoiceId ? 32 : 0) -
    blockers * 18 -
    warnings * 4;

  return {
    ...choice,
    state,
    score,
    blockers,
    warnings,
    autoFixes,
    hasExistingInstall: result?.installStatus === 'installed',
    effectiveRuntimePlatform: result?.runtime.effectiveRuntimePlatform ?? null,
    primaryIssue: result?.issues[0]?.message ?? choice.assessment?.error ?? null,
    recommendationReason: choice.id === productPreferredChoiceId ? 'platformPreferred' : 'bestReadyFallback',
  };
}

function compareChoices<TId extends string>(
  left: InstallChoiceRecommendation<TId>,
  right: InstallChoiceRecommendation<TId>,
) {
  const rank = STATE_ORDER[left.state] - STATE_ORDER[right.state];
  if (rank !== 0) {
    return rank;
  }

  if (left.score !== right.score) {
    return right.score - left.score;
  }

  return left.id.localeCompare(right.id);
}

function buildPlatformSignals<TId extends string>(
  hostOs: InstallRecommendationHostOs,
  arch: string | null | undefined,
  choices: InstallChoiceRecommendation<TId>[],
  primaryChoice: InstallChoiceRecommendation<TId> | null,
): InstallPlatformSignals {
  const results = choices
    .map((choice) => choice.assessment?.result)
    .filter((result): result is HubInstallAssessmentResult => Boolean(result));
  const primaryResult = primaryChoice?.assessment?.result ?? results[0];
  const hasDockerChoice = choices.some((choice) => choice.id === 'docker');
  const hasNodeChoice = choices.some((choice) => choice.id === 'npm' || choice.id === 'pnpm');
  const hasWslChoice = choices.some((choice) => choice.id === 'wsl');
  const dockerAvailable =
    hasDockerChoice && results.length ? results.some((result) => hasDockerRuntime(result)) : null;
  const nodeAvailable =
    hasNodeChoice && results.length ? results.some((result) => hasCommand(result, 'node')) : null;
  const wslAvailable =
    hasWslChoice && results.length ? results.some((result) => result.runtime.wslAvailable) : null;

  return {
    hostOs,
    arch: arch ?? null,
    runtimePlatform: primaryResult?.runtime.effectiveRuntimePlatform ?? null,
    wslAvailable,
    dockerAvailable,
    nodeAvailable,
  };
}

export function buildInstallRecommendationSummary<TId extends string>(input: {
  hostOs: InstallRecommendationHostOs;
  arch?: string | null;
  productPreferredChoiceId: TId;
  choices: InstallChoiceCandidate<TId>[];
}): InstallRecommendationSummary<TId> {
  const choices = input.choices
    .map((choice) => buildChoiceRecommendation(choice, input.hostOs, input.productPreferredChoiceId))
    .sort(compareChoices);
  const actionableChoices = choices.filter((choice) => ACTIONABLE_STATES.has(choice.state));
  const recoveryChoices = choices.filter((choice) => choice.state === 'fixFirst');
  const primaryChoice = actionableChoices[0] ?? recoveryChoices[0] ?? choices[0] ?? null;

  if (primaryChoice) {
    if (choices.length === 1) {
      primaryChoice.recommendationReason = 'singlePath';
    } else if (primaryChoice.state === 'installed') {
      primaryChoice.recommendationReason = 'installed';
    } else if (primaryChoice.state === 'fixFirst') {
      primaryChoice.recommendationReason = 'requiresSetup';
    } else if (primaryChoice.id === input.productPreferredChoiceId) {
      primaryChoice.recommendationReason = 'platformPreferred';
    } else {
      primaryChoice.recommendationReason = 'bestReadyFallback';
    }
  }

  return {
    primaryChoice,
    choices,
    secondaryChoices: actionableChoices.filter((choice) => choice.id !== primaryChoice?.id),
    recoveryChoices,
    readyChoiceCount: actionableChoices.length,
    fixFirstChoiceCount: recoveryChoices.length,
    platformSignals: buildPlatformSignals(input.hostOs, input.arch, choices, primaryChoice),
  };
}
