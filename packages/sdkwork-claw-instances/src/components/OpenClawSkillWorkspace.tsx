import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Copy, ExternalLink, Package, Plus, Search, Settings, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Switch,
} from '@sdkwork/claw-ui';
import type { AgentWorkbenchSnapshot } from '../services';
import {
  buildNextOpenClawSkillSelection,
  buildOpenClawSkillConfigDraft,
  buildOpenClawSkillGroups,
  buildOpenClawSkillHealth,
  buildOpenClawSkillSelectionSummary,
  createOpenClawSkillEnvEntry,
  filterOpenClawSkills,
  isOpenClawSkillEnabledForAgent,
  normalizeOpenClawSkillEnvEntries,
  type OpenClawSkillConfigDraft,
} from './openClawSkillWorkspaceModel.ts';

interface OpenClawSkillWorkspaceProps {
  snapshot: AgentWorkbenchSnapshot;
  isReadonly: boolean;
  isInstallingSkill: boolean;
  updatingSkillKeys: string[];
  removingSkillKeys: string[];
  onInstallSkill: (slug: string) => Promise<void> | void;
  onSetSkillEnabled: (skillKey: string, enabled: boolean) => Promise<void> | void;
  onRemoveSkill: (skill: AgentWorkbenchSnapshot['skills'][number]) => Promise<void> | void;
  onSaveSkillConfiguration?: (input: {
    skillKey: string;
    enabled: boolean;
    apiKey?: string;
    env?: Record<string, string>;
  }) => Promise<void> | void;
  isSavingSkillSelection?: boolean;
  onSaveSkillSelection?: (
    nextConfiguredSkillNames: string[] | null,
  ) => Promise<void> | void;
  header?: ReactNode;
}

function getTone(status: string) {
  if (status === 'ready') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300';
  }
  if (status === 'blocked') {
    return 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300';
  }
  if (status === 'degraded') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300';
  }
  return 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
}

function getSkillStateLabel(
  skill: AgentWorkbenchSnapshot['skills'][number],
  translate: (key: string) => string,
) {
  if (skill.disabled) {
    return {
      tone: 'disabled',
      label: translate('instances.detail.instanceWorkbench.agents.skillStates.disabled'),
    };
  }
  if (skill.blockedByAllowlist) {
    return {
      tone: 'blocked',
      label: translate('instances.detail.instanceWorkbench.agents.skillStates.blocked'),
    };
  }
  if (skill.always) {
    return {
      tone: 'ready',
      label: translate('instances.detail.instanceWorkbench.agents.panel.alwaysOn'),
    };
  }
  if (skill.eligible) {
    return {
      tone: 'ready',
      label: translate('instances.detail.instanceWorkbench.agents.skillStates.ready'),
    };
  }
  return {
    tone: 'degraded',
    label: translate('instances.detail.instanceWorkbench.agents.skillStates.needsSetup'),
  };
}

function formatSkillScope(
  scope: NonNullable<AgentWorkbenchSnapshot['skills'][number]>['scope'],
  translate: (key: string) => string,
) {
  if (scope === 'workspace') {
    return translate('instances.detail.instanceWorkbench.agents.skillScopes.workspace');
  }
  if (scope === 'managed') {
    return translate('instances.detail.instanceWorkbench.agents.skillScopes.managed');
  }
  if (scope === 'bundled') {
    return translate('instances.detail.instanceWorkbench.agents.skillScopes.bundled');
  }
  return translate('instances.detail.instanceWorkbench.agents.skillScopes.unknown');
}

function buildSkillInstallCommand(workspacePath?: string | null, slug?: string) {
  const target = workspacePath?.trim() || '.';
  const normalizedSlug = slug?.trim() || '<skill-slug>';
  return `cd "${target}"\nopenclaw skills install ${normalizedSlug}`;
}

function summarizeMissingRequirements(
  missing: AgentWorkbenchSnapshot['skills'][number]['missing'],
  translate: (key: string) => string,
) {
  const parts: string[] = [];
  if (missing.env.length > 0) {
    parts.push(
      `${translate('instances.detail.instanceWorkbench.agents.panel.requirementEnv')}: ${missing.env.join(', ')}`,
    );
  }
  if (missing.bins.length > 0) {
    parts.push(
      `${translate('instances.detail.instanceWorkbench.agents.panel.requirementBins')}: ${missing.bins.join(', ')}`,
    );
  }
  if (missing.anyBins.length > 0) {
    parts.push(
      `${translate('instances.detail.instanceWorkbench.agents.panel.requirementAnyBin')}: ${missing.anyBins.join(', ')}`,
    );
  }
  if (missing.config.length > 0) {
    parts.push(
      `${translate('instances.detail.instanceWorkbench.agents.panel.requirementConfig')}: ${missing.config.join(', ')}`,
    );
  }
  if (missing.os.length > 0) {
    parts.push(
      `${translate('instances.detail.instanceWorkbench.agents.panel.requirementOs')}: ${missing.os.join(', ')}`,
    );
  }
  return parts.join(' / ');
}

function summarizeSkillConfigChecks(
  configChecks: AgentWorkbenchSnapshot['skills'][number]['configChecks'],
) {
  const total = configChecks.length;
  const satisfied = configChecks.filter((check) => check.satisfied).length;
  const missingPaths = configChecks
    .filter((check) => !check.satisfied)
    .map((check) => check.path);

  return {
    total,
    satisfied,
    missingPaths,
  };
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[1.3rem] border border-zinc-200/70 bg-white/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/35">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-[1.4rem] border border-dashed border-zinc-200 bg-zinc-50/80 px-5 py-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-400">
      {message}
    </div>
  );
}

export function OpenClawSkillWorkspace({
  snapshot,
  isReadonly,
  isInstallingSkill,
  updatingSkillKeys,
  removingSkillKeys,
  onInstallSkill,
  onSetSkillEnabled,
  onRemoveSkill,
  onSaveSkillConfiguration,
  isSavingSkillSelection = false,
  onSaveSkillSelection,
  header,
}: OpenClawSkillWorkspaceProps) {
  const { t } = useTranslation();
  const [skillInstallSlug, setSkillInstallSlug] = useState('');
  const [skillQuery, setSkillQuery] = useState('');
  const [copiedCommandKey, setCopiedCommandKey] = useState<string | null>(null);
  const [skillConfigDialog, setSkillConfigDialog] = useState<{
    skillKey: string;
    draft: OpenClawSkillConfigDraft;
  } | null>(null);
  const [isSavingSkillConfiguration, setIsSavingSkillConfiguration] = useState(false);

  useEffect(() => {
    setSkillInstallSlug('');
    setSkillQuery('');
    setCopiedCommandKey(null);
    setSkillConfigDialog(null);
  }, [snapshot.agent.agent.id]);

  const skillsDirectoryPath =
    snapshot.paths.skillsDirectoryPath || `${snapshot.paths.workspacePath || '.'}/skills`;
  const skillInstallCommand = buildSkillInstallCommand(snapshot.paths.workspacePath, skillInstallSlug);
  const canInstallSelectedAgentSkill =
    Boolean(snapshot.agent.isDefault) && !isReadonly && skillInstallSlug.trim().length > 0;
  const showDirectInstallNotice = !snapshot.agent.isDefault;
  const filteredSkills = useMemo(
    () => filterOpenClawSkills(snapshot.skills, skillQuery),
    [skillQuery, snapshot.skills],
  );
  const groupedSkills = useMemo(() => buildOpenClawSkillGroups(filteredSkills), [filteredSkills]);
  const skillHealth = useMemo(() => buildOpenClawSkillHealth(snapshot.skills), [snapshot.skills]);
  const skillSelectionSummary = useMemo(
    () =>
      buildOpenClawSkillSelectionSummary(
        snapshot.skills,
        snapshot.skillSelection.usesAllowlist
          ? snapshot.skillSelection.configuredSkillNames
          : undefined,
      ),
    [
      snapshot.skillSelection.configuredSkillNames,
      snapshot.skillSelection.usesAllowlist,
      snapshot.skills,
    ],
  );
  const selectedConfigSkill = useMemo(
    () => snapshot.skills.find((skill) => skill.skillKey === skillConfigDialog?.skillKey) || null,
    [skillConfigDialog?.skillKey, snapshot.skills],
  );
  const sharedConfigScopeNotice = t(
    'instances.detail.instanceWorkbench.agents.panel.sharedConfigScopeNotice',
  );
  const canManageSkillSelection = Boolean(onSaveSkillSelection) && !isReadonly;

  const handleCopyCommand = async (key: string, command: string) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      return;
    }

    await navigator.clipboard.writeText(command);
    setCopiedCommandKey(key);
    window.setTimeout(() => {
      setCopiedCommandKey((current) => (current === key ? null : current));
    }, 1600);
  };

  const handleOpenSkillConfigDialog = (skill: AgentWorkbenchSnapshot['skills'][number]) => {
    setSkillConfigDialog({
      skillKey: skill.skillKey,
      draft: buildOpenClawSkillConfigDraft(skill),
    });
  };

  const handleSkillConfigChange = (patch: Partial<OpenClawSkillConfigDraft>) => {
    setSkillConfigDialog((current) =>
      current
        ? {
            ...current,
            draft: {
              ...current.draft,
              ...patch,
            },
          }
        : current,
    );
  };

  const handleSkillConfigEnvChange = (
    entryId: string,
    field: 'key' | 'value',
    value: string,
  ) => {
    setSkillConfigDialog((current) =>
      current
        ? {
            ...current,
            draft: {
              ...current.draft,
              envEntries: current.draft.envEntries.map((entry) =>
                entry.id === entryId ? { ...entry, [field]: value } : entry,
              ),
            },
          }
        : current,
    );
  };

  const handleAddSkillConfigEnvRow = () => {
    setSkillConfigDialog((current) =>
      current
        ? {
            ...current,
            draft: {
              ...current.draft,
              envEntries: [
                ...current.draft.envEntries,
                createOpenClawSkillEnvEntry(current.draft.envEntries.length),
              ],
            },
          }
        : current,
    );
  };

  const handleRemoveSkillConfigEnvRow = (entryId: string) => {
    setSkillConfigDialog((current) => {
      if (!current) {
        return current;
      }

      const remainingEntries = current.draft.envEntries.filter((entry) => entry.id !== entryId);
      return {
        ...current,
        draft: {
          ...current.draft,
          envEntries: remainingEntries.length > 0 ? remainingEntries : [createOpenClawSkillEnvEntry(0)],
        },
      };
    });
  };

  const handleSaveSkillConfig = async () => {
    if (!skillConfigDialog || !onSaveSkillConfiguration) {
      return;
    }

    setIsSavingSkillConfiguration(true);
    try {
      await onSaveSkillConfiguration({
        skillKey: skillConfigDialog.skillKey,
        enabled: selectedConfigSkill?.always ? true : skillConfigDialog.draft.enabled,
        apiKey: skillConfigDialog.draft.apiKey,
        env: normalizeOpenClawSkillEnvEntries(skillConfigDialog.draft.envEntries),
      });
      setSkillConfigDialog(null);
    } finally {
      setIsSavingSkillConfiguration(false);
    }
  };

  const handleSaveSkillSelection = async (nextConfiguredSkillNames: string[] | null) => {
    if (!onSaveSkillSelection) {
      return;
    }

    await onSaveSkillSelection(nextConfiguredSkillNames);
  };

  return (
    <div data-slot="openclaw-skill-workspace" className="space-y-5">
      {header ? (
        <div className="rounded-[1.5rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/35">
          {header}
        </div>
      ) : null}

      <div className="rounded-[1.5rem] border border-sky-200/70 bg-sky-50/70 p-5 dark:border-sky-500/20 dark:bg-sky-500/10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-200">
              {sharedConfigScopeNotice}
            </div>
            <p className="mt-2 text-sm leading-6 text-sky-900/80 dark:text-sky-100/80">
              {t('instances.detail.instanceWorkbench.agents.panel.sharedConfigScopeDescription')}
            </p>
          </div>
          <div className="rounded-full border border-sky-300/60 bg-white/80 px-3 py-1.5 text-xs font-semibold text-sky-800 dark:border-sky-400/30 dark:bg-sky-950/40 dark:text-sky-100">
            {snapshot.agent.agent.name}
          </div>
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/35">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.agents.panel.agentSkillAccessTitle')}
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              {skillSelectionSummary.usesAllowlist
                ? t('instances.detail.instanceWorkbench.agents.panel.agentSkillAccessCustomDescription', {
                    enabledCount: skillSelectionSummary.visibleEnabledSkillCount,
                    totalCount: skillSelectionSummary.visibleTotalSkillCount,
                  })
                : t('instances.detail.instanceWorkbench.agents.panel.agentSkillAccessAllDescription', {
                    totalCount: skillSelectionSummary.visibleTotalSkillCount,
                  })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void handleSaveSkillSelection(null)}
              disabled={!canManageSkillSelection || isSavingSkillSelection}
              className="rounded-2xl px-3 py-2"
            >
              {t('instances.detail.instanceWorkbench.agents.panel.enableAllAgentSkills')}
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleSaveSkillSelection([])}
              disabled={!canManageSkillSelection || isSavingSkillSelection}
              className="rounded-2xl px-3 py-2"
            >
              {t('instances.detail.instanceWorkbench.agents.panel.disableAllAgentSkills')}
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleSaveSkillSelection(null)}
              disabled={
                !canManageSkillSelection ||
                isSavingSkillSelection ||
                !skillSelectionSummary.usesAllowlist
              }
              className="rounded-2xl px-3 py-2"
            >
              {t('common.reset')}
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 font-semibold text-zinc-700 dark:bg-white/[0.06] dark:text-zinc-200">
            {skillSelectionSummary.visibleEnabledSkillCount}/{skillSelectionSummary.visibleTotalSkillCount}
          </span>
          <span className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 dark:bg-white/[0.06]">
            {skillSelectionSummary.usesAllowlist
              ? t('instances.detail.instanceWorkbench.agents.panel.agentSkillAccessCustomBadge')
              : t('instances.detail.instanceWorkbench.agents.panel.agentSkillAccessAllBadge')}
          </span>
          {isReadonly ? (
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 dark:border-zinc-700 dark:bg-zinc-900">
              {t('instances.detail.instanceWorkbench.agents.panel.skillConfigDialogReadonlyNotice')}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="rounded-[1.3rem] border border-zinc-200/70 bg-white/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/30">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                {t('instances.detail.instanceWorkbench.agents.panel.workspaceInstallCommand')}
              </div>
              <p className="mt-2 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                {t('instances.detail.instanceWorkbench.agents.panel.workspaceInstallDescription')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleCopyCommand('agent-skill-install', skillInstallCommand)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
              title={copiedCommandKey === 'agent-skill-install' ? t('common.copied') : t('common.copy')}
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 flex flex-col gap-3 md:flex-row">
            <Input
              value={skillInstallSlug}
              onChange={(event) => setSkillInstallSlug(event.target.value)}
              placeholder={t('instances.detail.instanceWorkbench.agents.panel.skillSlugPlaceholder')}
              className="flex-1"
            />
            <Button
              onClick={() => void onInstallSkill(skillInstallSlug.trim())}
              disabled={!canInstallSelectedAgentSkill || isInstallingSkill}
              className="rounded-2xl px-4 py-3"
            >
              {isInstallingSkill
                ? t('common.loading')
                : t('instances.detail.instanceWorkbench.agents.panel.installToDefaultWorkspace')}
            </Button>
          </div>
          {showDirectInstallNotice ? (
            <div className="mt-3 rounded-[1rem] border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
              {t('instances.detail.instanceWorkbench.agents.panel.defaultWorkspaceOnlyNotice')}
            </div>
          ) : null}
          <div className="mt-3 rounded-2xl bg-zinc-950 px-3 py-3 font-mono text-xs text-zinc-100 dark:bg-black">
            {skillInstallCommand}
          </div>
        </div>

        <div className="rounded-[1.3rem] bg-zinc-950/[0.03] p-4 dark:bg-white/[0.04]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
            {t('instances.detail.instanceWorkbench.agents.panel.skillPaths')}
          </div>
          <div className="mt-3 space-y-3">
            <div>
              <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                {t('instances.detail.instanceWorkbench.agents.panel.agentWorkspace')}
              </div>
              <div className="mt-1 break-all font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                {skillsDirectoryPath}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                {t('instances.detail.instanceWorkbench.agents.panel.sharedSkills')}
              </div>
              <div className="mt-1 break-all font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                {t('instances.detail.instanceWorkbench.agents.panel.sharedSkillsDefaultPath')}
              </div>
            </div>
            <div className="rounded-[1rem] border border-zinc-200/70 bg-white/80 px-3 py-3 text-[11px] leading-5 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.agents.panel.bundledScopeDescription')}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={t('instances.detail.instanceWorkbench.agents.skillStates.ready')}
          value={skillHealth.ready}
        />
        <MetricCard
          label={t('instances.detail.instanceWorkbench.agents.skillStates.needsSetup')}
          value={skillHealth.needsSetup}
        />
        <MetricCard
          label={t('instances.detail.instanceWorkbench.agents.skillStates.blocked')}
          value={skillHealth.blocked}
        />
        <MetricCard
          label={t('instances.detail.instanceWorkbench.agents.skillStates.disabled')}
          value={skillHealth.disabled}
        />
      </div>

      <div className="rounded-[1.5rem] border border-zinc-200/70 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/35">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {t('instances.detail.instanceWorkbench.sections.skills.title')}
            </h3>
            <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              {t('instances.detail.instanceWorkbench.sections.skills.description')}
            </p>
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            <Input
              value={skillQuery}
              onChange={(event) => setSkillQuery(event.target.value)}
              placeholder={`${t('common.search')} ${t('instances.detail.instanceWorkbench.sections.skills.title')}`}
              className="pl-9"
            />
          </div>
        </div>

        <div className="mt-5">
          {snapshot.skills.length === 0 ? (
            <EmptyState message={t('instances.detail.instanceWorkbench.empty.skills')} />
          ) : groupedSkills.length > 0 ? (
            <div className="space-y-5">
              {groupedSkills.map((group) => (
                <div key={group.scope} className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                      {formatSkillScope(group.scope, t)}
                    </div>
                    <div className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-[11px] font-semibold text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                      {group.skills.length}
                    </div>
                  </div>
                  <div className="grid gap-3">
                    {group.skills.map((skill) => {
                      const missingRequirements = summarizeMissingRequirements(skill.missing, t);
                      const skillState = getSkillStateLabel(skill, t);
                      const configCheckSummary = summarizeSkillConfigChecks(skill.configChecks);
                      const canManageSkill = !isReadonly && !skill.always;
                      const isSkillEnabledForAgent =
                        skill.always ||
                        isOpenClawSkillEnabledForAgent(skill.name, skillSelectionSummary);
                      const hasSharedConfig =
                        skill.configEntry.hasEntry ||
                        Boolean(skill.primaryEnv) ||
                        Boolean(skill.homepage) ||
                        skill.configChecks.length > 0 ||
                        skill.missing.config.length > 0 ||
                        skill.missing.env.length > 0;
                      const canOpenSkillConfiguration = Boolean(onSaveSkillConfiguration) || hasSharedConfig;

                      return (
                        <div
                          key={skill.id}
                          className="rounded-[1.35rem] border border-zinc-200/70 bg-white/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/30"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-950/[0.04] text-zinc-700 dark:bg-white/[0.06] dark:text-zinc-200">
                              {skill.emoji ? (
                                <span className="text-lg leading-none">{skill.emoji}</span>
                              ) : (
                                <Package className="h-4 w-4" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                                    {skill.name}
                                  </div>
                                  <span className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                                    {formatSkillScope(skill.scope, t)}
                                  </span>
                                  <span
                                    className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${getTone(
                                      skillState.tone,
                                    )}`}
                                  >
                                    {skillState.label}
                                  </span>
                                  {skill.configEntry.hasEntry ? (
                                    <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200">
                                      {t('instances.detail.instanceWorkbench.agents.panel.configured')}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {skill.homepage ? (
                                    <Button variant="outline" className="rounded-2xl px-3 py-2" asChild>
                                      <a href={skill.homepage} target="_blank" rel="noreferrer">
                                        {t('instances.detail.instanceWorkbench.agents.panel.openGuide')}
                                        <ExternalLink className="h-4 w-4" />
                                      </a>
                                    </Button>
                                  ) : null}
                                  {canOpenSkillConfiguration ? (
                                    <Button
                                      variant="outline"
                                      onClick={() => handleOpenSkillConfigDialog(skill)}
                                      className="rounded-2xl px-3 py-2"
                                    >
                                      <Settings className="h-4 w-4" />
                                      {t('instances.detail.instanceWorkbench.agents.panel.manageSkill')}
                                    </Button>
                                  ) : null}
                                  {canManageSkill ? (
                                    <Button
                                      variant="outline"
                                      onClick={() => void onSetSkillEnabled(skill.skillKey, skill.disabled)}
                                      disabled={
                                        updatingSkillKeys.includes(skill.skillKey) ||
                                        removingSkillKeys.includes(skill.skillKey)
                                      }
                                      className="rounded-2xl px-3 py-2"
                                    >
                                      {updatingSkillKeys.includes(skill.skillKey)
                                        ? t('common.loading')
                                        : skill.disabled
                                          ? t('instances.detail.instanceWorkbench.agents.panel.enableSkill')
                                          : t('instances.detail.instanceWorkbench.agents.panel.disableSkill')}
                                    </Button>
                                  ) : null}
                                  {canManageSkill && skill.scope === 'workspace' ? (
                                    <Button
                                      variant="outline"
                                      onClick={() => void onRemoveSkill(skill)}
                                      disabled={removingSkillKeys.includes(skill.skillKey)}
                                      className="rounded-2xl px-3 py-2 text-rose-600 hover:text-rose-600 dark:text-rose-300"
                                    >
                                      {removingSkillKeys.includes(skill.skillKey) ? t('common.loading') : (
                                        <>
                                          <Trash2 className="h-4 w-4" />
                                          {t('common.delete')}
                                        </>
                                      )}
                                    </Button>
                                  ) : null}
                                </div>
                              </div>
                              <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                                {skill.skillKey}
                                {skill.version ? ` / v${skill.version}` : ''}
                              </div>
                              <div className="mt-2 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                                {skill.description}
                              </div>
                              <div className="mt-3 flex items-center justify-between gap-4 rounded-[1rem] border border-zinc-200/70 bg-zinc-50/80 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                                <div className="min-w-0">
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                                    {t('instances.detail.instanceWorkbench.agents.panel.agentSkillAccessCardTitle')}
                                  </div>
                                  <div className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                    {isSkillEnabledForAgent
                                      ? t('instances.detail.instanceWorkbench.agents.panel.agentSkillAccessEnabled')
                                      : t('instances.detail.instanceWorkbench.agents.panel.agentSkillAccessDisabled')}
                                  </div>
                                </div>
                                <Switch
                                  checked={isSkillEnabledForAgent}
                                  disabled={
                                    !canManageSkillSelection ||
                                    isSavingSkillSelection ||
                                    skill.always
                                  }
                                  onCheckedChange={(checked) =>
                                    void handleSaveSkillSelection(
                                      buildNextOpenClawSkillSelection(
                                        skillSelectionSummary,
                                        skill.name,
                                        checked,
                                      ),
                                    )
                                  }
                                />
                              </div>
                              <div className="mt-3 grid gap-3 md:grid-cols-2">
                                <div className="rounded-[1rem] bg-zinc-950/[0.03] px-3 py-3 dark:bg-white/[0.04]">
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                                    {t('instances.detail.instanceWorkbench.agents.panel.source')}
                                  </div>
                                  <div className="mt-1 break-all text-xs text-zinc-900 dark:text-zinc-100">
                                    {skill.filePath || skill.source}
                                  </div>
                                </div>
                                <div className="rounded-[1rem] bg-zinc-950/[0.03] px-3 py-3 dark:bg-white/[0.04]">
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                                    {t('instances.detail.instanceWorkbench.agents.panel.primaryEnv')}
                                  </div>
                                  <div className="mt-1 break-all text-xs text-zinc-900 dark:text-zinc-100">
                                    {skill.primaryEnv || t('common.none')}
                                  </div>
                                </div>
                              </div>
                              {skill.configEntry.hasEntry ? (
                                <div className="mt-3 rounded-[1rem] border border-sky-200 bg-sky-50 px-3 py-3 text-xs text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200">
                                  {t('instances.detail.instanceWorkbench.agents.panel.configuredSummary', {
                                    envCount: Object.keys(skill.configEntry.env).length,
                                  })}
                                </div>
                              ) : null}
                              {configCheckSummary.total > 0 ? (
                                <div
                                  className={`mt-3 rounded-[1rem] border px-3 py-3 text-xs ${
                                    configCheckSummary.missingPaths.length > 0
                                      ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200'
                                      : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200'
                                  }`}
                                >
                                  <div className="font-semibold">
                                    {configCheckSummary.missingPaths.length > 0
                                      ? t('instances.detail.instanceWorkbench.agents.panel.configChecksMissing', {
                                          satisfiedCount: configCheckSummary.satisfied,
                                          totalCount: configCheckSummary.total,
                                        })
                                      : t('instances.detail.instanceWorkbench.agents.panel.configChecksSatisfied', {
                                          totalCount: configCheckSummary.total,
                                        })}
                                  </div>
                                  {configCheckSummary.missingPaths.length > 0 ? (
                                    <div className="mt-1">
                                      {configCheckSummary.missingPaths.join(', ')}
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                              {skill.blockedByAllowlist ? (
                                <div className="mt-3 rounded-[1rem] border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                                  {t('instances.detail.instanceWorkbench.agents.panel.allowlistNotice')}
                                </div>
                              ) : null}
                              {missingRequirements ? (
                                <div className="mt-3 rounded-[1rem] border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                                  {t('instances.detail.instanceWorkbench.agents.panel.missingPrefix')}:{' '}
                                  {missingRequirements}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message={t('common.noResults')} />
          )}
        </div>
      </div>

      <Dialog open={Boolean(skillConfigDialog)} onOpenChange={(open) => !open && setSkillConfigDialog(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {selectedConfigSkill?.name || t('instances.detail.instanceWorkbench.sections.skills.title')}
            </DialogTitle>
            <DialogDescription>
              {t('instances.detail.instanceWorkbench.agents.panel.skillConfigDialogDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 md:col-span-2 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              <span className="font-semibold">
                {t('instances.detail.instanceWorkbench.agents.panel.skillConfigDialogSelectedAgent')}
              </span>{' '}
              {snapshot.agent.agent.name}
            </div>
            <label className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3 md:col-span-2 dark:border-zinc-700 dark:bg-zinc-950">
              <div>
                <div className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                  {t('instances.detail.instanceWorkbench.agents.panel.skillConfigDialogEnabled')}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {selectedConfigSkill?.always
                    ? t('instances.detail.instanceWorkbench.agents.panel.skillConfigDialogAlwaysOn')
                    : t('instances.detail.instanceWorkbench.agents.panel.sharedConfigScopeDescription')}
                </div>
              </div>
              <Switch
                checked={selectedConfigSkill?.always ? true : skillConfigDialog?.draft.enabled || false}
                disabled={isReadonly || selectedConfigSkill?.always}
                onCheckedChange={(checked) => handleSkillConfigChange({ enabled: checked })}
              />
            </label>
            <label className="block md:col-span-2">
              <Label className="mb-2">
                {t('instances.detail.instanceWorkbench.agents.panel.skillConfigDialogApiKey')}
              </Label>
              <Input
                type="password"
                value={skillConfigDialog?.draft.apiKey || ''}
                onChange={(event) => handleSkillConfigChange({ apiKey: event.target.value })}
                disabled={isReadonly}
                placeholder={t('instances.detail.instanceWorkbench.agents.panel.skillConfigDialogApiKeyPlaceholder')}
              />
            </label>
            {selectedConfigSkill?.homepage ? (
              <div className="md:col-span-2">
                <Button variant="outline" className="rounded-2xl px-3 py-2" asChild>
                  <a href={selectedConfigSkill.homepage} target="_blank" rel="noreferrer">
                    {t('instances.detail.instanceWorkbench.agents.panel.openGuide')}
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            ) : null}
            {selectedConfigSkill && selectedConfigSkill.configChecks.length > 0 ? (
              <div className="md:col-span-2">
                <Label className="mb-2 block">
                  {t('instances.detail.instanceWorkbench.agents.panel.configChecks')}
                </Label>
                <div className="grid gap-2">
                  {selectedConfigSkill.configChecks.map((check) => (
                    <div
                      key={check.path}
                      className={`rounded-2xl border px-4 py-3 text-sm ${
                        check.satisfied
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200'
                          : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200'
                      }`}
                    >
                      <div className="font-medium">{check.path}</div>
                      <div className="mt-1 text-xs opacity-80">
                        {check.satisfied
                          ? t('instances.detail.instanceWorkbench.agents.panel.configCheckSatisfied')
                          : t('instances.detail.instanceWorkbench.agents.panel.configCheckMissing')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="md:col-span-2">
              <div className="mb-2 flex items-center justify-between gap-3">
                <Label>{t('instances.detail.instanceWorkbench.agents.panel.skillConfigDialogEnv')}</Label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddSkillConfigEnvRow}
                  disabled={isReadonly}
                  className="rounded-2xl px-3 py-2"
                >
                  <Plus className="h-4 w-4" />
                  {t('common.add')}
                </Button>
              </div>
              <div className="space-y-3">
                {(skillConfigDialog?.draft.envEntries || []).map((entry) => (
                  <div key={entry.id} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                    <Input
                      value={entry.key}
                      onChange={(event) =>
                        handleSkillConfigEnvChange(entry.id, 'key', event.target.value)
                      }
                      disabled={isReadonly}
                      placeholder={t('instances.detail.instanceWorkbench.agents.panel.skillConfigDialogEnvKeyPlaceholder')}
                    />
                    <Input
                      value={entry.value}
                      onChange={(event) =>
                        handleSkillConfigEnvChange(entry.id, 'value', event.target.value)
                      }
                      disabled={isReadonly}
                      placeholder={t('instances.detail.instanceWorkbench.agents.panel.skillConfigDialogEnvValuePlaceholder')}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleRemoveSkillConfigEnvRow(entry.id)}
                      disabled={isReadonly}
                      className="rounded-2xl px-3 py-2"
                    >
                      {t('common.delete')}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            {isReadonly ? (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500 md:col-span-2 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                {t('instances.detail.instanceWorkbench.agents.panel.skillConfigDialogReadonlyNotice')}
              </div>
            ) : null}
            {selectedConfigSkill?.blockedByAllowlist ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 md:col-span-2 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                {t('instances.detail.instanceWorkbench.agents.panel.skillConfigDialogAllowlistNotice')}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSkillConfigDialog(null)}>
              {t('common.cancel')}
            </Button>
            {onSaveSkillConfiguration ? (
              <Button
                onClick={() => void handleSaveSkillConfig()}
                disabled={isReadonly || isSavingSkillConfiguration}
              >
                {isSavingSkillConfiguration ? t('common.loading') : t('common.save')}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
