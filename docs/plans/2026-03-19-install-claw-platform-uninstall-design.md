# Install Claw Platform-Aware Install, Uninstall, And Migration Design

**Context**

The current `Install Claw` page still behaves like a static installer gallery. It does not adapt to the current operating system, still exposes obsolete local-install semantics for OpenClaw, and offers no first-class uninstall or migration flow for previously installed OpenClaw runtimes and data.

**Goals**

- Add top-level `Install`, `Uninstall`, and `Migrate` tabs inside the existing install surface.
- Filter install methods by the detected operating system.
- Remove the old local/recommended OpenClaw install path from the visible UI.
- Keep OpenClaw install options focused on `WSL` on Windows, `Docker`, `npm`, `pnpm`, `Source`, and a disabled `Cloud` placeholder.
- Support uninstalling existing OpenClaw installations from the desktop app.
- Provide a real migration interaction that can scan old OpenClaw content and import configuration plus related data into Claw Studio.

**Approaches Considered**

1. Static UI only
   Keep the page mostly static and add manual uninstall and migration help cards.
   Tradeoff: fast to ship, but it does not satisfy OS-aware rendering or real uninstall and migration support.

2. Runtime-aware UI plus desktop-managed install and uninstall, with frontend-managed migration
   Detect the current runtime platform in the React page, filter visible methods, add uninstall mode through the desktop installer bridge, and use existing runtime/filesystem APIs for migration scanning and copy operations.
   Tradeoff: touches frontend, infrastructure, Tauri bridge, and registry manifests, but gives a coherent product experience without inventing another migration backend layer yet.

3. Split install, uninstall, and migration into separate routes
   Move the three actions into different pages and keep each route smaller.
   Tradeoff: more route and navigation churn for little product benefit right now.

**Recommendation**

Use approach 2. It keeps the current route stable, matches the requested UX, and lets the desktop app own installation and removal while reusing existing filesystem capabilities for migration.

**Design**

- Add a top tab switcher for `Install`, `Uninstall`, and `Migrate`.
- Keep product tabs in `Install` mode.
- In `Install` mode:
  - Detect the runtime OS from `getRuntimePlatform().getRuntimeInfo()`.
  - Filter OpenClaw methods based on host OS.
  - Replace the old recommended/local OpenClaw card with an explicit Windows-only `WSL install` card backed by a dedicated registry manifest.
  - Keep `Docker`, `npm`, `pnpm`, and `Source`.
  - Show `Cloud install` as a disabled coming-soon card.
  - Keep ZeroClaw and IronClaw limited to the methods we can actually support today.
- In `Uninstall` mode:
  - Focus on OpenClaw only for this iteration.
  - Read the local install record for `openclaw` and surface the detected installation if present.
  - Offer uninstall actions for known OpenClaw methods so the user can still remove older installs even when detection is incomplete.
- In `Migrate` mode:
  - Scan common OpenClaw directories and the local install record.
  - Let the user review detected config, workspace, logs, and cache sources.
  - Allow choosing a custom source directory if auto-detection misses the old install.
  - Copy selected content into Claw Studio-managed destinations and summarize what was imported, skipped, or missing.
- Reuse one shared progress surface language style so install and uninstall remain consistent, while migration gets a simple in-page progress and result summary.

**Backend Changes**

- Extend installer contracts with uninstall request/result types.
- Add `runHubUninstall` to infrastructure and the desktop bridge.
- Add a Tauri `run_hub_uninstall` command backed by the vendored hub-installer Rust engine.
- Add or complete uninstall lifecycles for OpenClaw manifests.
- Add a dedicated Windows WSL OpenClaw manifest and registry entry.
- Reuse existing runtime/filesystem APIs for migration instead of adding a new command for this iteration.

**Verification**

- Extend the install contract test to enforce runtime-aware UI, install/uninstall/migrate tabs, WSL install, cloud placeholder, migration interactions, and uninstall bridge support.
- Run `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`.
- Run `pnpm lint`.
- Run `pnpm build`.
