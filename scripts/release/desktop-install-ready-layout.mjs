const DESKTOP_INSTALL_READY_RUNTIME_PREFIX = 'runtime/';

export const DESKTOP_INSTALL_READY_LAYOUT_MANIFEST_RELATIVE_PATH = 'manifest.json';
export const DESKTOP_INSTALL_READY_LAYOUT_RUNTIME_SIDECAR_RELATIVE_PATH =
  'runtime/.sdkwork-openclaw-runtime.json';

function normalizeRelativePath(value, { expectedValue = '', requireRuntimePrefix = false } = {}) {
  const normalizedValue = String(value ?? '').trim().replaceAll('\\', '/');
  const relativeSegments = normalizedValue
    .split('/')
    .filter(Boolean);

  if (
    relativeSegments.length === 0
    || normalizedValue.startsWith('/')
    || relativeSegments.some((segment) => segment === '.' || segment === '..')
  ) {
    return '';
  }

  const canonicalValue = relativeSegments.join('/');
  if (expectedValue && canonicalValue !== expectedValue) {
    return '';
  }
  if (requireRuntimePrefix && !canonicalValue.startsWith(DESKTOP_INSTALL_READY_RUNTIME_PREFIX)) {
    return '';
  }

  return canonicalValue;
}

export function resolveDesktopOpenClawInstallKeyFromManifest(manifest) {
  const openclawVersion = String(manifest?.openclawVersion ?? '').trim();
  const platformId = String(manifest?.platform ?? '').trim();
  const archId = String(manifest?.arch ?? '').trim();
  if (!openclawVersion || !platformId || !archId) {
    throw new Error('Bundled OpenClaw manifest is missing install key fields.');
  }

  return `${openclawVersion}-${platformId}-${archId}`;
}

export function normalizeDesktopInstallReadyLayout(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const mode = String(value?.mode ?? '').trim();
  const installKey = String(value?.installKey ?? '').trim();
  if (!mode || !installKey) {
    return null;
  }
  if (value?.reuseOnFirstLaunch !== true) {
    return null;
  }
  if (value?.requiresArchiveExtractionOnFirstLaunch !== false) {
    return null;
  }

  const manifestRelativePath = normalizeRelativePath(
    value?.manifestRelativePath,
    { expectedValue: DESKTOP_INSTALL_READY_LAYOUT_MANIFEST_RELATIVE_PATH },
  );
  const runtimeSidecarRelativePath = normalizeRelativePath(
    value?.runtimeSidecarRelativePath,
    {
      expectedValue: DESKTOP_INSTALL_READY_LAYOUT_RUNTIME_SIDECAR_RELATIVE_PATH,
      requireRuntimePrefix: true,
    },
  );
  const nodeEntryRelativePath = normalizeRelativePath(
    value?.nodeEntryRelativePath,
    { requireRuntimePrefix: true },
  );
  const cliEntryRelativePath = normalizeRelativePath(
    value?.cliEntryRelativePath,
    { requireRuntimePrefix: true },
  );

  if (
    !manifestRelativePath
    || !runtimeSidecarRelativePath
    || !nodeEntryRelativePath
    || !cliEntryRelativePath
  ) {
    return null;
  }

  return {
    mode,
    installKey,
    reuseOnFirstLaunch: true,
    requiresArchiveExtractionOnFirstLaunch: false,
    manifestRelativePath,
    runtimeSidecarRelativePath,
    nodeEntryRelativePath,
    cliEntryRelativePath,
  };
}

export function buildDesktopInstallReadyLayout({ manifest, mode } = {}) {
  const installKey = resolveDesktopOpenClawInstallKeyFromManifest(manifest);
  const installReadyLayout = normalizeDesktopInstallReadyLayout({
    mode,
    installKey,
    reuseOnFirstLaunch: true,
    requiresArchiveExtractionOnFirstLaunch: false,
    manifestRelativePath: DESKTOP_INSTALL_READY_LAYOUT_MANIFEST_RELATIVE_PATH,
    runtimeSidecarRelativePath: DESKTOP_INSTALL_READY_LAYOUT_RUNTIME_SIDECAR_RELATIVE_PATH,
    nodeEntryRelativePath: manifest?.nodeRelativePath,
    cliEntryRelativePath: manifest?.cliRelativePath,
  });

  if (!installReadyLayout) {
    throw new Error('Bundled OpenClaw manifest cannot produce an install-ready layout contract.');
  }

  return installReadyLayout;
}
