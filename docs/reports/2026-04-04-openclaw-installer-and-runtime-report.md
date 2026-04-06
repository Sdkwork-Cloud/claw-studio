# OpenClaw Installer And Runtime Integration Audit

Date: 2026-04-04
Updated: 2026-04-05

## Scope

Audit and polish the built-in `openclaw` integration in the Claw Studio desktop app so that:

- install-time preparation happens during installation instead of being deferred to normal startup
- normal startup reuses a prepared runtime instead of repeating heavyweight extraction or validation work
- the embedded runtime version is checked against the current repository release baseline
- remaining structural issues are documented with concrete follow-up recommendations

## Verified Current Embedded Version Baseline

The current repository release baseline is consistent for the embedded `openclaw` runtime itself:

- `config/openclaw-release.json`
  - `stableVersion`: `2026.4.2`
  - `nodeVersion`: `22.16.0`
- `packages/sdkwork-claw-desktop/src-tauri/resources/openclaw/manifest.json`
  - `openclawVersion`: `2026.4.2`
  - `nodeVersion`: `22.16.0`
- `packages/sdkwork-claw-desktop/src-tauri/resources/openclaw/runtime/.sdkwork-openclaw-runtime.json`
  - matches the same runtime manifest
- `packages/sdkwork-claw-desktop/src-tauri/resources/openclaw/runtime/package/node_modules/openclaw/package.json`
  - `version`: `2026.4.2`
- `packages/sdkwork-claw-desktop/src-tauri/resources/openclaw/runtime/node/node.exe --version`
  - `v22.16.0`

Conclusion:

- the embedded `openclaw` runtime shipped by the current source tree is aligned to the repository's intended release baseline
- the generic bundled runtime emission logic is now also aligned to the same shared Node baseline in source code and tests
- Windows bundled mirrors now stage into per-run mirror directories instead of mutating one long-lived mirror in place
- verified regenerated bundled output now reports generic bundled Node `22.16.0`

## Current Integration Path

The current desktop integration still spans a dedicated OpenClaw runtime path plus the generic bundled foundation path. Within the dedicated OpenClaw packaging path, the packaged release payload is now canonicalized around one release root:

1. `resources/openclaw`
   - dedicated built-in OpenClaw runtime payload
   - source tree contains an already prepared `runtime/` directory and runtime sidecar manifest
2. `generated/release/openclaw-resource`
   - canonical packaged OpenClaw release root for desktop installers
   - contains `manifest.json + runtime.zip`
3. `generated/br/o`
   - Windows package bridge used by the packaged desktop app
   - now aliases the canonical packaged release root instead of materializing a second OpenClaw payload
4. `generated/bundled`
   - separate generic bundled foundation/modules/runtimes sync path used during framework bootstrap

Effective runtime flow on desktop:

1. installer places the packaged app and Tauri resources
2. installer postinstall hook invokes internal app actions
3. normal app startup calls `activate_bundled_openclaw(...)`
4. startup ensures a managed install under the app runtime directory before gateway launch

Packaged platform closure is now explicitly split by operating system:

- Windows
  - packaged `resources/openclaw/` comes from the canonical `generated/release/openclaw-resource/` root through the Windows `generated/br/o` bridge and the stable short-path alias root
  - NSIS postinstall prewarms the managed runtime and then registers the CLI
  - both embedded CLI actions now receive `--install-root "$INSTDIR"` explicitly so the packaged installer root, runtime preparation root, and startup reuse root stay identical
- Linux
  - packaged `resources/openclaw/` is emitted from `generated/release/openclaw-resource/`
  - packaged payload is standardized to `manifest.json + runtime.zip`
  - `deb` and `rpm` now invoke `linux-postinstall-openclaw.sh` to prewarm the managed runtime during package installation
- macOS
  - packaged `resources/openclaw/` is also emitted from `generated/release/openclaw-resource/`
  - packaged payload remains `manifest.json + runtime.zip`
  - because drag-and-drop app installation has no NSIS-style installer hook, packaging now also stages a preexpanded managed runtime layout under `generated/release/macos-install-root/` and projects it into the app bundle at build time

That means all three supported desktop operating systems now avoid relying on normal startup as the primary place where heavyweight OpenClaw extraction happens.

## Root Causes And Issues Found

### 1. Installer preparation and CLI registration were coupled too tightly

The Windows installer already attempted to call:

- `Claw Studio.exe --register-openclaw-cli`

That path also prepared the runtime as a side effect. The problem was that runtime preparation and CLI registration were bundled into one best-effort step. If that combined action failed or was deferred, the first normal launch still had to do heavyweight runtime work.

Impact:

- installation looked complete, but first launch could still perform runtime extraction/preparation
- runtime prep failure was hidden behind a CLI registration flow that had a different responsibility

### 2. Startup still performed deep runtime validation for prepared installs

For directory-backed bundled resources, the runtime reuse check always fell back to dependency sentinel scanning inside the OpenClaw package tree, even when:

- installed `manifest.json` matched
- runtime sidecar matched
- Node entrypoint existed
- OpenClaw CLI entrypoint existed

Impact:

- prepared installs still paid startup validation cost
- the app looked like it was still "processing" OpenClaw after installation

### 3. There is still a double-track bundled architecture

The desktop app currently mixes:

- dedicated `resources/openclaw` runtime activation
- generic `generated/bundled` resource seeding

These two flows are separate, use different resource shapes, and are not driven by a single release source of truth.

Impact:

- harder reasoning about what is prepared at build time versus install time versus first launch
- higher risk of version drift and duplicated work

### 4. Generic bundled Node drift came from the local shell environment instead of the shared runtime baseline

Root cause identified in `scripts/sync-bundled-components.mjs`:

- generic bundled Node metadata was emitted from `process.versions.node`
- generic bundled Node binary was copied from `process.execPath`

Impact before the fix:

- a developer machine running Node `22.20.0` could stamp `generated/bundled` with `22.20.0` even though the embedded OpenClaw runtime was pinned to Node `22.16.0`
- metadata and real bundled payload could silently drift away from the shared release config
- future debugging became harder because "bundled Node version" depended on the workstation shell instead of repository release metadata

### 5. Generic bundled sync failures are still swallowed during bootstrap

`FrameworkContext::bootstrap(...)` currently does:

- `let _ = sync_bundled_installation(app, &paths);`

Impact:

- bundled seeding failures can be silently ignored
- startup behavior becomes harder to diagnose because one resource pipeline can fail without surfacing a clear signal

### 6. Windows bundled mirror refresh originally mutated one long-lived mirror root in place

Observed during verification:

- `generated/bundled` resolves to the external junction `D:\.sdkwork-bc\claw-studio\bundled`
- refreshing the mirror hit transient `EPERM` errors against files such as `bundle-manifest.json`
- a direct attempt to create `runtimes/node/22.16.0` under that mirror also failed with access denied

Impact:

- the source logic is corrected, but a stale local mirror created before the fix can remain visible until the lock is cleared
- this does not change the root-cause fix, but it does prevent this specific workstation from fully regenerating the mirror artifacts in-place

### 7. Obsolete packaging artifacts were present in the workspace

During the audit, the repository still contained:

- `openclaw-2026.3.13.tgz`

Action taken:

- removed the stale root tarball from the repository
- added a release contract so future stale `openclaw-*.tgz` artifacts fail verification unless they match the current shared stable version

### 8. Cross-platform packaged installs were not yet closed around one release-artifact model

Before the current round of changes:

- Windows had the most complete installer-time story because NSIS could invoke embedded app actions
- Linux and macOS still lacked a fully documented packaged-resource contract around archive staging and install/build-time preparation
- Linux postinstall root discovery was also off by one directory level when deriving the install root from `resources/openclaw/manifest.json`, which could silently skip the intended prewarm step on installed packages
- Linux installer-time prewarm also still depended on the embedded binary inferring `install_root` from `current_exe().parent()`, which could drift from the packaged resource root when the launcher path and resource path were not adjacent

Impact:

- packaged OpenClaw handling could still drift per operating system
- Linux install-time prewarm was at risk of failing to locate the installed desktop binary reliably
- Linux install-time prewarm could still target the wrong managed runtime root even after manifest-based install-root discovery had succeeded
- macOS needed a different strategy from Windows because there is no equivalent drag-and-drop installer hook

## Implemented Fixes

### Fix 1. Added a dedicated installer-time runtime prewarm action

Implemented:

- new internal CLI flag: `--prepare-bundled-openclaw-runtime`
- new internal action that prepares the bundled runtime without doing shell shim registration

Files:

- `packages/sdkwork-claw-desktop/src-tauri/src/internal_cli.rs`
- `packages/sdkwork-claw-desktop/src-tauri/installer-hooks.nsh`

Behavior change:

1. installer now explicitly prewarms the managed OpenClaw runtime first
2. installer then performs CLI registration as a separate best-effort step
3. runtime preparation is no longer hidden inside CLI registration
4. the internal prepare/register CLI now accepts an explicit `--install-root` override, and the Linux postinstall hook forwards the resolved packaged install root into that CLI so managed runtime installation and resource lookup use the same root even when the launcher binary is not resource-adjacent

Result:

- installation does the expensive runtime preparation work at install time
- first user launch is no longer responsible for first-time extraction in the normal successful path

### Fix 2. Added a startup fast path for already prepared runtimes

Implemented in:

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`

Behavior change:

- if installed `manifest.json` matches the bundled runtime manifest
- and installed runtime sidecar `.sdkwork-openclaw-runtime.json` matches
- and bundled Node and OpenClaw CLI entrypoints exist

then startup now treats the managed runtime as complete immediately and skips the old dependency sentinel deep scan.

Current completeness rules:

- startup only reuses installs when the runtime sidecar is present and valid
- sidecar-less installs are now treated as incomplete and are rebuilt from the bundled runtime
- archive-backed installs follow the same rule instead of silently reusing manifest-only layouts

Result:

- prepared installs no longer do unnecessary heavyweight validation work on normal startup
- the app better matches the expected user experience: install once, launch directly

### Fix 3. Removed generic bundled Node drift from the local shell environment

Implemented in:

- `scripts/sync-bundled-components.mjs`
- `scripts/sync-bundled-components.test.mjs`

Behavior change:

- generic bundled Node metadata is now emitted from `DEFAULT_NODE_VERSION`
- generic bundled Node payload is no longer copied from `process.execPath`
- bundled sync now first inspects the prepared OpenClaw Node cache
- if the cache is not ready, bundled sync reuses the shared `prepareOpenClawRuntime(...)` flow
- if the cache still is not backfilled but the prepared `resources/openclaw` runtime is already verified, bundled sync now reuses that validated runtime directly
- if neither path yields the pinned Node runtime, bundling fails loudly instead of silently baking in the wrong binary

Result:

- the generic bundled channel now follows the same shared `openclaw-release.json` Node version baseline as the dedicated embedded runtime
- future version drift from developer workstation Node upgrades is blocked by test coverage and runtime validation

### Fix 4. Hardened Tauri packaged resource mapping for Windows

Implemented in:

- `packages/sdkwork-claw-desktop/src-tauri/tauri.conf.json`
- `scripts/tauri-dev-command-contract.test.mjs`

Behavior change:

- packaged Tauri resources now use directory roots instead of `/**/*` globs for bundled folders
- Windows bundle overlay contract now explicitly requires those directory roots

Result:

- fresh cargo/Tauri bundle preparation no longer fails at the old recursive glob resource boundary
- Windows bridge packaging is more stable and less sensitive to junction expansion behavior

### Fix 5. Reworked Windows bundled mirrors to use per-run mirror directories and configurable mirror roots

Implemented in:

- `scripts/sync-bundled-components.mjs`
- `scripts/sync-bundled-components.test.mjs`
- `scripts/run-windows-tauri-bundle.mjs`
- `scripts/run-windows-tauri-bundle.test.mjs`

Behavior change:

- Windows bundled sync now stages `generated/bundled` into a dedicated mirror directory such as `bundled-mirrors/bundled-<run-id>`
- repo junctions are updated after staged output has been written instead of exposing a half-written mirror up front
- NSIS fallback rewriting now prefers the currently resolved bridge target instead of assuming one fixed `...\bundled\` directory forever
- restricted environments can override the Windows short mirror base directory through `SDKWORK_WINDOWS_MIRROR_BASE_DIR`

Result:

- repeated bundled sync no longer depends on mutating the previously active mirror in place
- local verification succeeded by pointing the mirror base into a writable workspace cache, and the regenerated bundled manifest now records Node `22.16.0`
- Windows NSIS fallback now follows the active bundled mirror target even when the mirror path changes per run

### Fix 6. Bundled installation sync failures now emit explicit bootstrap logs

Implemented in:

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/context.rs`

Behavior change:

- framework bootstrap now initializes the desktop logger before running bundled installation sync
- successful bundled sync with seeded runtimes/components is recorded in the main log
- bundled sync failures are no longer silently discarded; they are recorded as warnings before bootstrap continues

Result:

- bundled seeding remains best-effort, but failure diagnosis is now materially better
- startup logs now reveal whether bundled runtimes/components were seeded or whether the sync failed

### Fix 7. Standardized packaged OpenClaw release artifacts and install-time preparation across operating systems

Implemented in:

- `scripts/prepare-openclaw-runtime.mjs`
- `packages/sdkwork-claw-desktop/src-tauri/tauri.linux.conf.json`
- `packages/sdkwork-claw-desktop/src-tauri/tauri.macos.conf.json`
- `packages/sdkwork-claw-desktop/src-tauri/linux-postinstall-openclaw.sh`

Behavior change:

- packaged release staging now emits a generic archive-only OpenClaw resource root at `generated/release/openclaw-resource/`
- that packaged resource root contains `manifest.json + runtime.zip` instead of a fully expanded `runtime/` tree
- Linux `deb` and `rpm` packaging now wires a postinstall hook that invokes `--prepare-bundled-openclaw-runtime`
- the Linux postinstall hook now resolves the install root correctly from the bundled resource manifest before locating the installed desktop binary
- macOS packaging now additionally stages a preexpanded managed runtime layout at `generated/release/macos-install-root/` and maps it into the app bundle so first launch does not need to perform the archive extraction path

Result:

- packaged OpenClaw resources now follow one archive-oriented release shape on Linux and macOS, while Windows keeps its NSIS bridge archive flow
- Linux packaged installs now have an installer-time prewarm path instead of depending on first launch
- macOS packaged apps now ship with the managed runtime already expanded into the bundle because that is the strongest available alternative to an installer hook
- the user-facing expectation is now consistent across platforms: installation or packaging does the heavyweight OpenClaw preparation, not the first normal launch

### Fix 8. Made desktop release bundling explicitly layer platform-specific Tauri config with generated bundle overlay config

Implemented in:

- `scripts/run-desktop-release-build.mjs`
- `scripts/run-windows-tauri-bundle.mjs`
- `scripts/release-flow-contract.test.mjs`
- `scripts/run-windows-tauri-bundle.test.mjs`

Behavior change:

- Linux release bundling now explicitly passes `src-tauri/tauri.linux.conf.json` before the generated bundle overlay config
- macOS release bundling now explicitly passes `src-tauri/tauri.macos.conf.json` before the generated bundle overlay config
- Windows NSIS bundling now explicitly passes `src-tauri/tauri.windows.conf.json` before the generated bundle overlay config
- release command construction no longer relies only on implicit platform-specific Tauri config lookup for the packaged OpenClaw resource strategy

Result:

- the cross-platform OpenClaw packaging contract is now visible in the build command itself instead of being partly implicit
- future release-flow debugging is easier because the final config layering is explicit per operating system
- Windows, Linux, and macOS now follow one consistent desktop bundle configuration model

### Fix 9. Added a dedicated OpenClaw release-asset verifier at the preparation ownership boundary

Implemented in:

- `scripts/verify-desktop-openclaw-release-assets.mjs`
- `scripts/prepare-openclaw-runtime.mjs`
- `package.json`

Behavior change:

- the prepare pipeline now verifies the prepared source resource root under `resources/openclaw/`
- it also verifies that packaged release staging emits `generated/release/openclaw-resource/manifest.json + runtime.zip` without a stray expanded `runtime/` tree
- macOS verification additionally checks the staged managed install-root layout under `generated/release/macos-install-root/`
- `prepare-openclaw-runtime.mjs` now runs this verification before reporting success, so incomplete packaged assets fail during prepare instead of slipping into runtime
- desktop and release-flow automation now include a dedicated verifier test to keep this contract pinned

Result:

- packaging mistakes around OpenClaw are now caught at the artifact boundary owned by the prepare script
- startup is less likely to fall back into heavyweight recovery paths because release artifacts are validated before installers or bundles are considered ready
- macOS now has an explicit artifact-level guard for the preexpanded managed runtime strategy instead of relying only on build-step assumptions

### Fix 10. Made desktop bundle entrypoints refuse to package when OpenClaw release assets have not been verified

Implemented in:

- `scripts/run-desktop-release-build.mjs`
- `scripts/run-windows-tauri-bundle.mjs`
- `scripts/run-desktop-release-build.test.mjs`
- `scripts/run-windows-tauri-bundle.test.mjs`

Behavior change:

- `run-desktop-release-build.mjs` now runs `verify-desktop-openclaw-release-assets.mjs` synchronously before `bundle` and `all` phases
- the preflight resolves the effective target triple or native host platform/architecture before validation, so Linux, macOS, and Windows bundle entrypoints all validate the correct OpenClaw artifact set
- `run-windows-tauri-bundle.mjs` now also runs the same verifier before invoking `tauri build`, so the direct Windows NSIS helper can no longer bypass OpenClaw release-asset checks

Result:

- the release flow no longer depends on callers remembering to run `prepare-openclaw` first
- manual or scripted bundle invocations now fail fast if OpenClaw packaged assets are stale, incomplete, or target-mismatched
- this closes the remaining easy bypass where a bundle command could otherwise package a broken OpenClaw payload and push the failure back to installer/runtime phases

### Fix 11. Added lifecycle cleanup for versioned Windows bundled mirrors

Implemented in:

- `scripts/sync-bundled-components.mjs`
- `scripts/sync-bundled-components.test.mjs`

Behavior change:

- after switching the active `generated/bundled` junction to the newly staged Windows mirror, bundled sync now prunes stale `bundled-mirrors/bundled-*` directories
- cleanup is conservative: the active mirror is always retained, and a small rollback window of recent historical mirrors is preserved
- pruning is best-effort and logs warnings instead of failing the whole sync if a stale mirror is still locked

Result:

- Windows mirror staging stays stable without growing unbounded over time
- the active mirror model remains intact, but long-lived workspaces are less likely to accumulate confusing stale mirror directories
- release troubleshooting gets simpler because the mirror set now converges toward the current active target plus a limited recent history

### Fix 12. Added integrity-aware runtime sidecars and removed sidecar-less startup reuse

Implemented in:

- `scripts/prepare-openclaw-runtime.mjs`
- `scripts/prepare-openclaw-runtime.test.mjs`
- `scripts/verify-desktop-openclaw-release-assets.mjs`
- `scripts/verify-desktop-openclaw-release-assets.test.mjs`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`

Behavior change:

- prepared runtime sidecars now carry `runtimeIntegrity.schemaVersion = 1`
- the sidecar snapshot includes hashes and sizes for the bundled Node entrypoint, OpenClaw CLI entrypoint, the OpenClaw package manifest, and the selected supplemental runtime package sentinels
- Rust startup now distinguishes three states explicitly: sidecar missing, sidecar match, and sidecar mismatch
- a present-but-mismatched sidecar no longer falls back to the removed dependency-sentinel compatibility branch
- a missing sidecar now also forces reinstall for both directory-backed and archive-backed managed runtime installs
- the macOS staged-layout verifier now validates that the staged sidecar extends the bundled manifest and carries the integrity snapshot instead of incorrectly requiring raw JSON equality with `manifest.json`

Result:

- startup reuse is now fast and integrity-aware instead of fast but over-trusting
- damaged installs and sidecar-less installs are rebuilt before launch instead of being silently reused
- cross-platform release verification now matches the actual sidecar schema used by the runtime

### Fix 13. Added packaged desktop installer smoke verification on top of the release asset manifest

Implemented in:

- `scripts/release/smoke-desktop-installers.mjs`
- `scripts/release/local-release-command.mjs`
- `package.json`

Behavior change:

- desktop release smoke now reads `artifacts/release/desktop/<platform>/<arch>/release-asset-manifest.json`
- the smoke flow first runs `verifyDesktopOpenClawReleaseAssets(...)`, so OpenClaw packaged resource validation remains the precondition for installer smoke
- Windows smoke creates dry-run `hub-installer` plans for emitted `.exe` and `.msi` installers
- Linux smoke creates dry-run `hub-installer` plans for emitted `.deb`, `.rpm`, and `.appimage` packages
- macOS smoke creates dry-run `hub-installer` plans for emitted `.dmg` installers and additionally requires a packaged `.app.zip` or `.app.tar.gz` companion archive to still be present
- the release command surface now exposes `smoke desktop` and the root workspace exposes `pnpm release:smoke:desktop`

Result:

- packaged desktop artifacts are now checked at the installer boundary instead of only at prepare/build-time staging boundaries
- cross-platform release verification now proves that the emitted desktop artifact set is structurally installable for the current target platform
- the remaining gap is narrowed to real installer execution and first-launch smoke, not release-manifest integrity or installer-shape drift

### Fix 14. Made desktop packaging emit persistent smoke evidence and made release finalization consume it

Implemented in:

- `scripts/release/smoke-desktop-installers.mjs`
- `scripts/release/desktop-installer-smoke-contract.mjs`
- `scripts/release/local-release-command.mjs`
- `scripts/release/finalize-release-assets.mjs`

Behavior change:

- successful desktop installer smoke now writes `installer-smoke-report.json` beside each desktop partial manifest under `artifacts/release/desktop/<platform>/<arch>/`
- the smoke report records the target platform, architecture, manifest path, installable artifact relative paths, companion archive relative paths, and summarized dry-run install plans
- `package desktop` now automatically runs installer smoke immediately after packaging the desktop artifacts instead of leaving smoke as a separate optional step
- `finalize-release-assets.mjs` now refuses to finalize a release when a desktop partial manifest is present but the matching smoke report is missing
- finalization also refuses stale smoke evidence by verifying that the smoked installable artifact set still matches the current desktop partial manifest

Result:

- desktop smoke is now part of the packaging closure instead of a manual follow-up
- release finalization now has persistent evidence that the packaged desktop installers were structurally smoked
- the remaining gap is no longer “did anyone remember to run smoke?”; it is strictly the absence of real installer execution and first-launch smoke

### Fix 15. Collapsed the Windows packaged OpenClaw payload onto the canonical release root while preserving short-path NSIS handling

Implemented in:

- `scripts/prepare-openclaw-runtime.mjs`
- `scripts/sync-bundled-components.mjs`
- `scripts/run-windows-tauri-bundle.mjs`
- `scripts/prepare-openclaw-runtime.test.mjs`
- `scripts/run-windows-tauri-bundle.test.mjs`

Behavior change:

- `generated/release/openclaw-resource/` is now the canonical packaged OpenClaw payload root for desktop release staging
- after packaged release artifacts are staged, Windows now creates or refreshes the stable short-path alias root under `SDKWORK_WINDOWS_MIRROR_BASE_DIR/openclaw` as a junction to that canonical packaged release root
- `generated/br/o` remains the repo-local Tauri bridge, but it now points at the stable short-path alias instead of depending on a second independently staged OpenClaw archive payload
- the Windows NSIS retry path no longer resolves `generated/br/o` back to the final long packaged release directory during source rewriting; it stays on the stable short alias root
- bundled component sync now also reasserts that Windows alias before wiring bridge roots, so the packaged OpenClaw bridge stays repairable even if the alias was removed between prepare and bundle phases

Result:

- Windows no longer keeps a second archive-only OpenClaw payload alongside `generated/release/openclaw-resource/`
- short-path NSIS resilience is preserved without introducing a second packaged OpenClaw source of truth
- the remaining architectural split is now above the packaged release root level: dedicated OpenClaw runtime preparation still coexists with the generic `generated/bundled` bootstrap path

## Tests Added Or Updated

### Rust

- `packages/sdkwork-claw-desktop/src-tauri/src/internal_cli.rs`
  - `detects_internal_prepare_bundled_openclaw_runtime_action`
  - `internal_prepare_runtime_prewarms_managed_install_without_touching_shell_shims`
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs`
  - `reuses_existing_install_when_matching_runtime_sidecar_is_present`
  - `reinstalls_existing_install_when_runtime_sidecar_integrity_mismatch_is_detected`
  - `reinstalls_existing_install_when_runtime_sidecar_is_missing`
  - `reinstalls_archived_install_when_runtime_sidecar_is_missing`

### Script contract

- `scripts/check-desktop-platform-foundation.test.mjs`
  - locks the desktop foundation check to the new cross-platform OpenClaw packaging contract
  - requires Linux/macOS Tauri overlays and the Linux postinstall hook to stay present
  - requires directory resource roots in the base Tauri config instead of recursive globs
- `scripts/tauri-dev-command-contract.test.mjs`
  - asserts NSIS installer hooks invoke `--prepare-bundled-openclaw-runtime`
  - asserts runtime prewarm happens before `--register-openclaw-cli`
  - asserts Linux/macOS Tauri bundle overrides map the packaged OpenClaw archive root correctly
  - asserts Linux package outputs wire the OpenClaw postinstall hook
  - asserts macOS bundle outputs project the preexpanded managed runtime layout into the app bundle
- `scripts/release-flow-contract.test.mjs`
  - asserts Linux/macOS desktop release bundling explicitly layers platform-specific Tauri config before the generated bundle overlay config
  - asserts `check:release-flow` includes the desktop installer smoke suite and that the root workspace exposes `release:smoke:desktop`
  - hardens release closure verification against the current Windows `spawnSync(process.execPath)` `EPERM` limitation by falling back to direct module execution
- `scripts/release/smoke-desktop-installers.test.mjs`
  - verifies Windows installer smoke creates dry-run plans only after OpenClaw asset verification
  - verifies Linux installer smoke covers every emitted installable desktop package
  - verifies macOS installer smoke plans the `.dmg` and requires a packaged app-archive companion
  - rejects macOS release manifests that would ship only a `.dmg` without a reusable packaged app archive
  - verifies successful smoke writes `installer-smoke-report.json` with the smoked artifact set
- `scripts/release/local-release-command.test.mjs`
  - asserts `smoke desktop` resolves to a first-class `smoke:desktop` mode
  - asserts the local release helper dispatches installer smoke through the dedicated command surface
  - asserts `package:desktop` now runs smoke immediately after packaging the desktop artifacts
- `scripts/release/finalize-release-assets.test.mjs`
  - verifies finalization rejects desktop assets when installer smoke evidence is missing
  - verifies finalization rejects stale smoke evidence when the smoked artifact set no longer matches the current desktop partial manifest
- `scripts/verify-desktop-openclaw-release-assets.test.mjs`
  - verifies Windows archive-only packaged OpenClaw resources
  - verifies macOS staged install-root layouts including the integrity-bearing runtime sidecar
  - rejects packaged OpenClaw release roots that regress back to an expanded `runtime/` tree
  - locks `prepare-openclaw-runtime.mjs` to verify release assets before printing success
- `scripts/prepare-openclaw-runtime.test.mjs`
  - verifies Windows short-path OpenClaw alias sync points to the canonical packaged release root instead of creating a second packaged payload
- `scripts/run-desktop-release-build.test.mjs`
  - verifies bundle-capable phases build an OpenClaw release-asset preflight plan
  - verifies the desktop release runner executes that preflight before spawning the bundle command
- `scripts/run-windows-tauri-bundle.test.mjs`
  - verifies the direct Windows NSIS bundler exports and runs the same OpenClaw release-asset preflight
  - verifies `generated/br/o` NSIS fallback rewrites stay on the stable short-path alias even when the bridge resolves to the canonical packaged release root
- `scripts/sync-bundled-components.test.mjs`
  - verifies stale Windows bundled mirrors are pruned while retaining the active mirror and a small rollback window
- `scripts/openclaw-release-contract.test.mjs`
  - rejects stale root `openclaw-*.tgz` artifacts that do not match the shared stable version
  - rejects stale `2026.3.13` fixture baselines and requires shared bundled version constants
- `scripts/sync-bundled-components.test.mjs`
  - rejects generic bundled Node version emission from `process.versions.node`
  - rejects generic bundled Node payload staging from `process.execPath`
  - verifies bundled sync prefers a validated prepared Node cache
  - verifies bundled sync falls back to a validated prepared `resources/openclaw` runtime when cache backfill is unavailable
  - verifies bundling fails loudly if the pinned Node runtime still cannot be proven
  - verifies Windows bundled output uses per-run mirror directories
  - verifies the Windows bundled mirror base directory can be overridden for restricted environments
- `scripts/run-windows-tauri-bundle.test.mjs`
  - verifies Windows desktop release bundling explicitly layers `tauri.windows.conf.json` before the generated bundle overlay config
  - verifies NSIS fallback can resolve the current bundled mirror target dynamically
  - verifies direct `dist` and `resources/openclaw` replacements honor the configured Windows mirror base directory
- `packages/sdkwork-claw-desktop/src-tauri/src/framework/context.rs`
  - `bundled_install_sync_report_logs_seeded_components_and_runtimes`
  - `bundled_install_sync_failure_logs_warning`

## Residual Risks

### 1. The remaining split is now activation-level, not packaged-release-root-level

The current change has already made `generated/release/openclaw-resource/` the canonical packaged OpenClaw payload root, and Windows short-path bridges now alias to it. The remaining split is between:

- dedicated `resources/openclaw` source/runtime preparation
- generic `generated/bundled` runtime and component seeding during framework bootstrap

Recommendation:

- keep `generated/release/openclaw-resource/` as the only packaged OpenClaw payload root
- next, converge the dedicated OpenClaw runtime preparation path and the generic bundled activation path onto a clearer single runtime ownership model

### 2. Generic bundled sync failures are still non-fatal during framework bootstrap

The runtime version choice is now correct, and bootstrap now logs bundled sync success/failure explicitly. However, bundled seeding still remains non-fatal by design.

Recommendation:

- keep the new warning logs
- consider adding a visible diagnostics surface or health flag when bundled sync fails repeatedly

### 3. Packaged installer smoke is structural, not execution-level

The new smoke layer now proves that release manifests, OpenClaw packaged assets, and emitted installer/package files are consistent enough to build dry-run install plans, and release finalization now requires persisted smoke evidence. It still does not execute real installer binaries or launch the installed app.

Recommendation:

- add CI or release smoke jobs that execute a real installer/package per platform in a disposable environment
- verify that installer-time preparation actually runs and that first launch skips OpenClaw extraction on the produced installation

### 4. macOS still needs a built-bundle execution check

The current strategy is still correct for drag-and-drop app delivery. The new verifier plus installer smoke now check that the staged install-root layout exists, that the emitted `.dmg` is structurally plannable, and that a packaged app archive companion is present. That still does not prove the finished signed app bundle launches cleanly with the preexpanded runtime intact.

Recommendation:

- keep the macOS-target prepare step mandatory in release automation
- keep the new staged-layout verifier in the prepare path
- add a real macOS bundle smoke test that inspects or launches the finished `.app` output, not just the staged input layout

## Recommended Next Iteration Order

### Priority 1. Collapse the remaining dual activation model above the canonical packaged release root

Target outcome:

- keep one canonical packaged OpenClaw release root
- reduce the remaining mental split between dedicated `resources/openclaw` runtime preparation and generic `generated/bundled` activation
- decide whether generic bundled activation should consume more of the same OpenClaw runtime metadata and ownership model

### Priority 2. Extend planner-level installer smoke into execution-level installer smoke

Target outcome:

- Linux packages prove the postinstall prewarm path end to end
- macOS bundles prove the staged install-root layout survives into the final `.app`
- Windows installers prove NSIS prewarm happened before first user launch

Suggested direction:

- add disposable package-install smoke jobs for `.deb` and `.rpm`
- add a macOS bundle inspection or launch smoke test on a real bundle artifact
- add a Windows installer smoke test that asserts first launch does not extract OpenClaw again

### Priority 3. Unify bundled Node version ownership

Target outcome:

- `openclaw-release.json`
- OpenClaw resource manifest
- generic bundled runtime manifest

should all be emitted from the same version source.

### Priority 4. Stop swallowing bundled sync failures

Target outcome:

- if generic bundled seeding fails, startup should log it clearly and expose the failure path instead of ignoring it

### Priority 5. Keep obsolete runtime tarballs out of the repository

Target outcome:

- eliminate stale artifact confusion during release maintenance
- keep the new release contract in place so old tarballs do not reappear silently

### Priority 6. Add real packaged-install smoke tests per operating system

Target outcome:

- prove that Windows NSIS, Linux `deb/rpm`, and macOS app bundles all ship a launch-ready OpenClaw runtime
- catch packaging regressions before release instead of after installation

Suggested direction:

- Windows: install the NSIS package and assert that first launch does not trigger OpenClaw extraction
- Linux: install a generated `deb` or `rpm` in a disposable environment and assert the postinstall prewarm ran successfully
- macOS: inspect the built app bundle and verify the preexpanded managed runtime exists under the bundled install-root layout

## Final Assessment

The main user-facing problem has been addressed:

- install-time runtime preparation is now a first-class installer step
- prepared installs are now reused on startup without repeating heavyweight work
- the packaged OpenClaw resource format is now standardized around archive staging for cross-platform distribution
- Windows short-path OpenClaw packaging now aliases to the same canonical packaged release root instead of materializing a second archive payload
- release artifacts are now verified at prepare time so incomplete packaged OpenClaw layouts fail before installer/bundle handoff
- bundle entrypoints now refuse to package when OpenClaw release assets have not been verified for the active target
- Windows bundled mirror staging now self-prunes stale per-run mirrors instead of accumulating them indefinitely
- Linux and macOS now have dedicated package/build-time strategies instead of falling back to startup extraction
- startup now refuses to reuse sidecar-less or integrity-mismatched managed runtimes
- macOS staged-layout verification now understands the integrity-bearing sidecar schema instead of validating the wrong contract
- desktop release automation now also has a packaged-installer smoke layer that dry-runs install planning against the emitted Windows/Linux/macOS artifacts
- desktop packaging now persists smoke evidence and release finalization refuses unsmoked or stale-smoke desktop artifacts

The embedded runtime version in the current repository is already aligned to the intended OpenClaw baseline:

- OpenClaw `2026.4.2`
- Node `22.16.0`

The remaining work is now primarily architectural and environment hardening:

- collapse the remaining activation-model split between dedicated OpenClaw runtime preparation and generic bundled seeding
- extend the new planner-level installer smoke into real installer execution and first-launch smoke
- tighten generic bundled sync failure surfacing for operators
