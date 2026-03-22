import type {
  HubInstallCatalogEntry,
  HubInstallCatalogVariant,
  HubInstallRequest,
  HubUninstallRequest,
} from '@sdkwork/claw-infrastructure';

export type OpenClawCatalogHostOs = 'windows' | 'macos' | 'linux' | 'unknown';
export type OpenClawCatalogRuntimePlatform = 'host' | 'wsl';
export type OpenClawCatalogIconId = 'sparkles' | 'server' | 'package' | 'github' | 'file';

export interface OpenClawCatalogChoice {
  id: string;
  label: string;
  description: string;
  uninstallDescription: string;
  iconId: OpenClawCatalogIconId;
  tags: string[];
  request: HubInstallRequest;
  uninstallRequest: HubUninstallRequest;
  supportedHosts: Array<Exclude<OpenClawCatalogHostOs, 'unknown'>>;
  softwareName: string;
  runtimePlatform: OpenClawCatalogRuntimePlatform;
}

export interface OpenClawCatalogPresentation {
  installChoices: OpenClawCatalogChoice[];
  recommendedChoiceId: string | null;
}

export interface OpenClawCatalogInstallRecordLike {
  softwareName?: string | null;
  manifestName?: string | null;
  effectiveRuntimePlatform?: string | null;
}

function toCatalogHostPlatform(hostOs: OpenClawCatalogHostOs) {
  if (hostOs === 'linux') {
    return 'ubuntu';
  }

  return hostOs === 'unknown' ? null : hostOs;
}

function toSupportedHost(hostPlatform: string) {
  if (hostPlatform === 'ubuntu') {
    return 'linux' as const;
  }

  if (hostPlatform === 'windows' || hostPlatform === 'macos') {
    return hostPlatform;
  }

  return null;
}

function inferIconId(variant: HubInstallCatalogVariant): OpenClawCatalogIconId {
  if (variant.softwareName === 'openclaw-wsl' || variant.softwareName === 'openclaw') {
    return 'sparkles';
  }

  if (
    variant.softwareName === 'openclaw-docker' ||
    variant.softwareName === 'openclaw-podman'
  ) {
    return 'server';
  }

  if (
    variant.softwareName === 'openclaw-npm' ||
    variant.softwareName === 'openclaw-pnpm' ||
    variant.softwareName === 'openclaw-cli-script' ||
    variant.softwareName === 'openclaw-bun' ||
    variant.softwareName === 'openclaw-nix'
  ) {
    return 'package';
  }

  if (
    variant.softwareName === 'openclaw-git' ||
    variant.softwareName === 'openclaw-source'
  ) {
    return 'github';
  }

  if (variant.softwareName === 'openclaw-ansible') {
    return 'server';
  }

  return 'file';
}

function inferTags(variant: HubInstallCatalogVariant) {
  const tags = new Set<string>();

  for (const hostPlatform of variant.hostPlatforms) {
    const mapped = toSupportedHost(hostPlatform);
    if (mapped) {
      tags.add(mapped);
    }
  }

  if (variant.runtimePlatform === 'wsl') {
    tags.add('wsl');
  }

  if (variant.softwareName === 'openclaw' || variant.softwareName === 'openclaw-cli-script') {
    tags.add('managed');
    tags.add('script');
  }

  if (variant.softwareName === 'openclaw-git' || variant.softwareName === 'openclaw-source') {
    tags.add('git');
  }

  if (variant.softwareName === 'openclaw-source') {
    tags.add('source');
  }

  if (variant.softwareName === 'openclaw-docker') {
    tags.add('docker');
  }

  if (variant.softwareName === 'openclaw-podman') {
    tags.add('podman');
  }

  if (variant.softwareName === 'openclaw-npm') {
    tags.add('nodejs');
    tags.add('npm');
  }

  if (variant.softwareName === 'openclaw-pnpm') {
    tags.add('nodejs');
    tags.add('pnpm');
  }

  if (variant.softwareName === 'openclaw-bun') {
    tags.add('bun');
    tags.add('source');
    tags.add('experimental');
  }

  if (variant.softwareName === 'openclaw-ansible') {
    tags.add('ansible');
    tags.add('automation');
  }

  if (variant.softwareName === 'openclaw-nix') {
    tags.add('nix');
    tags.add('declarative');
  }

  return [...tags];
}

function toRuntimePlatform(value: string | null | undefined): OpenClawCatalogRuntimePlatform | null {
  if (!value) {
    return null;
  }

  return value.toLowerCase() === 'wsl' ? 'wsl' : 'host';
}

function toChoice(variant: HubInstallCatalogVariant): OpenClawCatalogChoice {
  return {
    id: variant.id,
    label: variant.label,
    description: variant.summary,
    uninstallDescription: variant.summary,
    iconId: inferIconId(variant),
    tags: inferTags(variant),
    request: variant.request,
    uninstallRequest: {
      ...variant.request,
      purgeData: false,
    },
    supportedHosts: variant.hostPlatforms
      .map(toSupportedHost)
      .filter(
        (value): value is Exclude<OpenClawCatalogHostOs, 'unknown'> => value !== null,
      ),
    softwareName: variant.softwareName,
    runtimePlatform: variant.runtimePlatform,
  };
}

export function resolveOpenClawCatalogPresentation(
  entry: HubInstallCatalogEntry | null | undefined,
  hostOs: OpenClawCatalogHostOs,
): OpenClawCatalogPresentation {
  if (!entry) {
    return {
      installChoices: [],
      recommendedChoiceId: null,
    };
  }

  const hostPlatform = toCatalogHostPlatform(hostOs);
  const variants = entry.variants.filter(
    (variant) => !hostPlatform || variant.hostPlatforms.includes(hostPlatform),
  );
  const installChoices = variants.map(toChoice);
  const recommendedChoiceId = installChoices.some(
    (choice) => choice.id === entry.defaultVariantId,
  )
    ? entry.defaultVariantId
    : installChoices[0]?.id ?? null;

  return {
    installChoices,
    recommendedChoiceId,
  };
}

export function detectOpenClawCatalogChoice(
  record: OpenClawCatalogInstallRecordLike | null | undefined,
  choices: Pick<OpenClawCatalogChoice, 'softwareName' | 'request' | 'runtimePlatform' | 'id'>[],
) {
  const candidateName =
    record?.softwareName?.trim() || record?.manifestName?.trim() || '';
  if (!candidateName) {
    return null;
  }

  const matches = choices.filter(
    (choice) =>
      choice.softwareName === candidateName || choice.request.softwareName === candidateName,
  );
  if (!matches.length) {
    return null;
  }

  const preferredRuntime = toRuntimePlatform(record?.effectiveRuntimePlatform);
  if (!preferredRuntime) {
    return matches[0] ?? null;
  }

  return (
    matches.find((choice) => choice.runtimePlatform === preferredRuntime) ?? matches[0] ?? null
  );
}
