import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..');
const foundationCheckSource = readFileSync(
  path.join(rootDir, 'scripts', 'check-desktop-platform-foundation.mjs'),
  'utf8',
);

assert.match(
  foundationCheckSource,
  /packages\/sdkwork-claw-desktop\/src-tauri\/tauri\.linux\.conf\.json/,
  'desktop platform foundation check must require the Linux Tauri bundle override config',
);
assert.match(
  foundationCheckSource,
  /packages\/sdkwork-claw-desktop\/src-tauri\/tauri\.macos\.conf\.json/,
  'desktop platform foundation check must require the macOS Tauri bundle override config',
);
assert.match(
  foundationCheckSource,
  /packages\/sdkwork-claw-desktop\/src-tauri\/linux-postinstall-openclaw\.sh/,
  'desktop platform foundation check must require the Linux OpenClaw postinstall hook script',
);
assert.match(
  foundationCheckSource,
  /'foundation\/components\/'/,
  'desktop platform foundation check must validate directory resource roots instead of recursive glob patterns',
);
assert.match(
  foundationCheckSource,
  /'generated\/bundled\/'/,
  'desktop platform foundation check must validate the generated bundled resource directory root',
);
assert.match(
  foundationCheckSource,
  /'\.\.\/dist\/'/,
  'desktop platform foundation check must validate the packaged frontend dist directory root',
);
assert.match(
  foundationCheckSource,
  /'resources\/openclaw\/'/,
  'desktop platform foundation check must validate the packaged OpenClaw resource directory root',
);
assert.match(
  foundationCheckSource,
  /generated\/release\/openclaw-resource\//,
  'desktop platform foundation check must validate the packaged archive-only OpenClaw release resource bridge',
);
assert.match(
  foundationCheckSource,
  /generated\/release\/macos-install-root\//,
  'desktop platform foundation check must validate the preexpanded macOS OpenClaw install-root layout',
);
assert.match(
  foundationCheckSource,
  /linux-postinstall-openclaw\.sh/,
  'desktop platform foundation check must validate the Linux postinstall hook reference',
);
assert.match(
  foundationCheckSource,
  /SDKWORK_CLAW_INSTALL_ROOT/,
  'desktop platform foundation check must require explicit Linux install-root override support for postinstall prewarm',
);
assert.match(
  foundationCheckSource,
  /RPM_INSTALL_PREFIX/,
  'desktop platform foundation check must require RPM relocatable install-root override support for postinstall prewarm',
);
assert.match(
  foundationCheckSource,
  /install-root forwarding into the embedded OpenClaw prewarm CLI/,
  'desktop platform foundation check must require Linux install-root forwarding into the embedded OpenClaw prewarm CLI',
);
assert.match(
  foundationCheckSource,
  /usr\/lib64\/\*\/resources\/openclaw\/manifest\.json/,
  'desktop platform foundation check must require Linux lib64 OpenClaw manifest discovery coverage',
);
assert.match(
  foundationCheckSource,
  /Linux postinstall prewarm soft-failure fallback/,
  'desktop platform foundation check must reject Linux postinstall soft-failure prewarm fallbacks',
);
assert.match(
  foundationCheckSource,
  /Windows NSIS prewarm failure abort/,
  'desktop platform foundation check must require Windows NSIS installer abort semantics for OpenClaw prewarm failures',
);
assert.match(
  foundationCheckSource,
  /Windows NSIS explicit install-root forwarding into the embedded OpenClaw prewarm CLI/,
  'desktop platform foundation check must require Windows NSIS install-root forwarding for OpenClaw prewarm',
);
assert.match(
  foundationCheckSource,
  /Windows NSIS explicit install-root forwarding into the embedded OpenClaw CLI registration flow/,
  'desktop platform foundation check must require Windows NSIS install-root forwarding for OpenClaw CLI registration',
);
assert.match(
  foundationCheckSource,
  /\['bridge-web-dist', 'web-dist', \['generated', 'br', 'w'\], true\]/,
  'desktop platform foundation check must validate the Windows NSIS web-dist bridge rewrite contract with resolved-target support',
);
assert.match(
  foundationCheckSource,
  /\['bridge-openclaw', 'openclaw', \['generated', 'br', 'o'\], false\]/,
  'desktop platform foundation check must validate the Windows NSIS OpenClaw bridge rewrite contract against the stable short-path alias root',
);

console.log('ok - desktop platform foundation check covers cross-platform OpenClaw packaging constraints');
