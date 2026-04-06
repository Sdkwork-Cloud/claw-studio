# Claw Studio V5 Standard Foundation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the workspace around `upgrade/claw-studio-v5` while preserving the original V5 business package design, replacing `sdkwork-claw-commons` with `sdkwork-claw-ui`, adding `sdkwork-claw-terminal`, and keeping the current Tauri desktop host as the native runtime layer.

**Architecture:** Use the V5 root app and V5-style `sdkwork-claw-*` feature packages as the source of truth. Re-home the useful parts of the current `shell`, `business`, and `infrastructure` packages into `sdkwork-claw-core`, `sdkwork-claw-i18n`, and the root app, keep `packages/claw-studio-desktop` as a host-only runtime package, and standardize shared components in `packages/sdkwork-claw-ui`.

**Tech Stack:** TypeScript, React, pnpm workspace, Vite, Tailwind CSS, shadcn/ui, Radix UI, Zustand, React Router, motion, Tauri 2, Rust

---

## Chunk 1: Reset The Workspace To The V5 Shape

### Task 1: Freeze The Migration Contract

**Files:**
- Create: `docs/plans/2026-03-14-claw-studio-v5-package-matrix.md`
- Create: `scripts/check-v5-standard-foundation.mjs`
- Modify: `.gitignore`
- Modify: `docs/plans/2026-03-14-claw-studio-v5-standard-foundation-design.md`

- [ ] **Step 1: Write the failing contract check**

Add `scripts/check-v5-standard-foundation.mjs` with initial assertions for:

- `backup/` is ignored
- `upgrade/` is ignored
- the target package list includes `sdkwork-claw-ui`
- the target package list includes `sdkwork-claw-terminal`
- the current obsolete package list is still present and therefore fails the check

- [ ] **Step 2: Run the contract check to verify it fails**

Run: `node scripts/check-v5-standard-foundation.mjs`

Expected: FAIL with assertions showing that the ignored-directory and package-shape contract is not yet fully implemented.

- [ ] **Step 3: Write the migration matrix and ignore rules**

Create `docs/plans/2026-03-14-claw-studio-v5-package-matrix.md` documenting:

- current package -> target V5 package mapping
- packages to delete
- packages to retain
- packages to create

Update `.gitignore` so local `backup/` and `upgrade/` directories remain in the working tree but are not committed.

- [ ] **Step 4: Re-run the contract check**

Run: `node scripts/check-v5-standard-foundation.mjs`

Expected: PASS for archive ignore rules and documented package contract, while later assertions remain pending until later tasks extend the script.

- [ ] **Step 5: Commit**

```bash
git add .gitignore docs/plans/2026-03-14-claw-studio-v5-package-matrix.md docs/plans/2026-03-14-claw-studio-v5-standard-foundation-design.md scripts/check-v5-standard-foundation.mjs
git commit -m "docs: define v5 standard foundation migration contract"
```

### Task 2: Replace The Root Workspace Surface With V5

**Files:**
- Modify: `package.json`
- Modify: `pnpm-workspace.yaml`
- Modify: `.env.example`
- Modify: `index.html`
- Modify: `metadata.json`
- Modify: `README.md`
- Modify: `server.ts`
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`
- Modify: `src/index.css`
- Modify: `tsconfig.json`
- Modify: `vite.config.ts`
- Modify: `turbo.json`
- Modify: `scripts/check-v5-standard-foundation.mjs`

- [ ] **Step 1: Extend the failing contract check for the root app**

Update `scripts/check-v5-standard-foundation.mjs` to assert that:

- root `package.json` matches the V5-style workspace layout
- root `src/main.tsx` bootstraps `sdkwork-claw-i18n`
- root `src/App.tsx` is the product composition point
- root scripts no longer depend on `@sdkwork/claw-studio-web`

- [ ] **Step 2: Run the contract check to verify it fails**

Run: `node scripts/check-v5-standard-foundation.mjs`

Expected: FAIL because the current root still reflects the intermediate workspace architecture.

- [ ] **Step 3: Port the V5 root app surface**

Replace the root app files with the authoritative `upgrade/claw-studio-v5` equivalents, then adapt only the parts needed to support the retained desktop host and new shared package names.

- [ ] **Step 4: Re-run the contract check**

Run: `node scripts/check-v5-standard-foundation.mjs`

Expected: PASS for the root workspace assertions.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml .env.example index.html metadata.json README.md server.ts src/App.tsx src/main.tsx src/index.css tsconfig.json vite.config.ts turbo.json scripts/check-v5-standard-foundation.mjs
git commit -m "feat: reset root workspace to the v5 app surface"
```

### Task 3: Materialize The V5 Package Tree

**Files:**
- Create or Replace: `packages/sdkwork-claw-account`
- Create or Replace: `packages/sdkwork-claw-apps`
- Create or Replace: `packages/sdkwork-claw-auth`
- Create or Replace: `packages/sdkwork-claw-center`
- Create or Replace: `packages/sdkwork-claw-channels`
- Create or Replace: `packages/sdkwork-claw-chat`
- Create or Replace: `packages/sdkwork-claw-community`
- Create or Replace: `packages/sdkwork-claw-core`
- Create or Replace: `packages/sdkwork-claw-devices`
- Create or Replace: `packages/sdkwork-claw-docs`
- Create or Replace: `packages/sdkwork-claw-extensions`
- Create or Replace: `packages/sdkwork-claw-github`
- Create or Replace: `packages/sdkwork-claw-huggingface`
- Create or Replace: `packages/sdkwork-claw-i18n`
- Create or Replace: `packages/sdkwork-claw-install`
- Create or Replace: `packages/sdkwork-claw-instances`
- Create or Replace: `packages/sdkwork-claw-market`
- Create or Replace: `packages/sdkwork-claw-settings`
- Create or Replace: `packages/sdkwork-claw-tasks`
- Create or Replace: `packages/sdkwork-claw-types`
- Remove: `packages/claw-studio-account`
- Remove: `packages/claw-studio-apps`
- Remove: `packages/claw-studio-business`
- Remove: `packages/claw-studio-channels`
- Remove: `packages/claw-studio-chat`
- Remove: `packages/claw-studio-claw-center`
- Remove: `packages/claw-studio-community`
- Remove: `packages/claw-studio-devices`
- Remove: `packages/claw-studio-distribution`
- Remove: `packages/claw-studio-docs`
- Remove: `packages/claw-studio-domain`
- Remove: `packages/claw-studio-extensions`
- Remove: `packages/claw-studio-github`
- Remove: `packages/claw-studio-huggingface`
- Remove: `packages/claw-studio-infrastructure`
- Remove: `packages/claw-studio-install`
- Remove: `packages/claw-studio-instances`
- Remove: `packages/claw-studio-market`
- Remove: `packages/claw-studio-settings`
- Remove: `packages/claw-studio-shared-ui`
- Remove: `packages/claw-studio-shell`
- Remove: `packages/claw-studio-tasks`
- Remove: `packages/claw-studio-web`
- Remove: `packages/cc-switch`
- Modify: `scripts/check-v5-standard-foundation.mjs`

- [ ] **Step 1: Extend the failing contract check for package topology**

Update `scripts/check-v5-standard-foundation.mjs` to assert that:

- all V5 package directories exist under `packages/`
- obsolete intermediate packages no longer exist
- `packages/claw-studio-desktop` remains present

- [ ] **Step 2: Run the contract check to verify it fails**

Run: `node scripts/check-v5-standard-foundation.mjs`

Expected: FAIL because the current package tree is still mixed between V5 and the previous migration.

- [ ] **Step 3: Copy the V5 package tree and remove obsolete package directories**

Copy the authoritative package contents from `upgrade/claw-studio-v5/packages`, then remove obsolete intermediate packages after their reusable code has been migrated or queued in later tasks.

- [ ] **Step 4: Re-run the contract check**

Run: `node scripts/check-v5-standard-foundation.mjs`

Expected: PASS for the package-topology assertions.

- [ ] **Step 5: Commit**

```bash
git add packages scripts/check-v5-standard-foundation.mjs
git commit -m "feat: restore the v5 package topology"
```

## Chunk 2: Rebuild The Shared Foundation Inside V5 Packages

### Task 4: Replace `sdkwork-claw-commons` With `sdkwork-claw-ui`

**Files:**
- Create: `packages/sdkwork-claw-ui/package.json`
- Create: `packages/sdkwork-claw-ui/tsconfig.json`
- Create: `packages/sdkwork-claw-ui/src/index.ts`
- Create: `packages/sdkwork-claw-ui/src/lib/utils.ts`
- Create: `packages/sdkwork-claw-ui/src/lib/utils.test.ts`
- Create: `packages/sdkwork-claw-ui/src/components/Modal.tsx`
- Create: `packages/sdkwork-claw-ui/src/components/RepositoryCard.tsx`
- Create: `packages/sdkwork-claw-ui/src/components/index.ts`
- Create: `packages/sdkwork-claw-ui/src/components/ui/*`
- Modify: `packages/sdkwork-claw-account/src/**/*`
- Modify: `packages/sdkwork-claw-devices/src/**/*`
- Modify: `packages/sdkwork-claw-extensions/src/**/*`
- Modify: `packages/sdkwork-claw-github/src/**/*`
- Modify: `packages/sdkwork-claw-huggingface/src/**/*`
- Modify: `packages/sdkwork-claw-market/src/**/*`
- Modify: `packages/sdkwork-claw-settings/src/**/*`
- Remove: `packages/sdkwork-claw-commons`
- Modify: `scripts/check-v5-standard-foundation.mjs`

- [ ] **Step 1: Write the failing shared-UI tests**

Add:

- `packages/sdkwork-claw-ui/src/lib/utils.test.ts` for `cn`
- new assertions in `scripts/check-v5-standard-foundation.mjs` that no active package imports `sdkwork-claw-commons`

- [ ] **Step 2: Run the tests to verify they fail**

Run:

- `node --experimental-strip-types packages/sdkwork-claw-ui/src/lib/utils.test.ts`
- `node scripts/check-v5-standard-foundation.mjs`

Expected: FAIL because `sdkwork-claw-ui` does not exist and V5 packages still import `sdkwork-claw-commons`.

- [ ] **Step 3: Create `sdkwork-claw-ui` and migrate consumers**

Seed the new package from:

- `upgrade/claw-studio-v5/packages/sdkwork-claw-commons`
- useful pieces of the current `packages/claw-studio-shared-ui`

Then migrate active feature packages to import from `sdkwork-claw-ui`.

- [ ] **Step 4: Re-run the tests**

Run:

- `node --experimental-strip-types packages/sdkwork-claw-ui/src/lib/utils.test.ts`
- `node scripts/check-v5-standard-foundation.mjs`

Expected: PASS for shared-UI assertions.

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-ui packages/sdkwork-claw-account packages/sdkwork-claw-devices packages/sdkwork-claw-extensions packages/sdkwork-claw-github packages/sdkwork-claw-huggingface packages/sdkwork-claw-market packages/sdkwork-claw-settings scripts/check-v5-standard-foundation.mjs
git commit -m "feat: replace v5 commons with sdkwork-claw-ui"
```

### Task 5: Re-home Cross-Feature Logic Into `sdkwork-claw-core`, `sdkwork-claw-i18n`, And `sdkwork-claw-types`

**Files:**
- Modify: `packages/sdkwork-claw-core/package.json`
- Modify: `packages/sdkwork-claw-core/src/index.ts`
- Modify: `packages/sdkwork-claw-core/src/store/useAppStore.ts`
- Create: `packages/sdkwork-claw-core/src/store/useAppStore.test.ts`
- Create: `packages/sdkwork-claw-core/src/runtime/contracts.ts`
- Create: `packages/sdkwork-claw-core/src/runtime/registry.ts`
- Create: `packages/sdkwork-claw-core/src/runtime/registry.test.ts`
- Create: `packages/sdkwork-claw-core/src/runtime/index.ts`
- Modify: `packages/sdkwork-claw-i18n/package.json`
- Modify: `packages/sdkwork-claw-i18n/src/index.ts`
- Create: `packages/sdkwork-claw-i18n/src/index.test.ts`
- Modify: `packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `packages/sdkwork-claw-i18n/src/locales/zh.json`
- Modify: `packages/sdkwork-claw-types/package.json`
- Modify: `packages/sdkwork-claw-types/src/index.ts`
- Modify: `src/main.tsx`
- Modify: `scripts/check-v5-standard-foundation.mjs`

- [ ] **Step 1: Write the failing core and i18n tests**

Add:

- `packages/sdkwork-claw-core/src/store/useAppStore.test.ts`
- `packages/sdkwork-claw-core/src/runtime/registry.test.ts`
- `packages/sdkwork-claw-i18n/src/index.test.ts`

Cover:

- persisted app preferences
- runtime registry configuration and lookup
- i18n bootstrap exposing at least English and Chinese resources

- [ ] **Step 2: Run the tests to verify they fail**

Run:

- `node --experimental-strip-types packages/sdkwork-claw-core/src/store/useAppStore.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-core/src/runtime/registry.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-i18n/src/index.test.ts`

Expected: FAIL because the V5 baseline does not yet contain the re-homed current workspace logic.

- [ ] **Step 3: Re-home the reusable logic**

Move:

- global app-store behavior from the current `claw-studio-business`
- runtime facade and runtime contract logic from the current `claw-studio-business` and `claw-studio-infrastructure`
- i18n bootstrap from the current `claw-studio-infrastructure`

into V5-aligned packages without recreating the old package split.

- [ ] **Step 4: Re-run the tests**

Run:

- `node --experimental-strip-types packages/sdkwork-claw-core/src/store/useAppStore.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-core/src/runtime/registry.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-i18n/src/index.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-core packages/sdkwork-claw-i18n packages/sdkwork-claw-types src/main.tsx scripts/check-v5-standard-foundation.mjs
git commit -m "feat: re-home shared core and i18n logic into v5 packages"
```

## Chunk 3: Preserve The Desktop Host And Add Terminal Capability

### Task 6: Convert `claw-studio-desktop` Into A Host-Only Tauri Package

**Files:**
- Modify: `packages/claw-studio-desktop/package.json`
- Modify: `packages/claw-studio-desktop/src-tauri/tauri.conf.json`
- Modify: `packages/claw-studio-desktop/src/desktop/tauriBridge.ts`
- Modify: `packages/claw-studio-desktop/src-tauri/src/commands/mod.rs`
- Modify: `packages/claw-studio-desktop/src-tauri/src/commands/process_commands.rs`
- Modify: `packages/claw-studio-desktop/src-tauri/src/commands/job_commands.rs`
- Modify: `packages/claw-studio-desktop/src-tauri/src/framework/services/process.rs`
- Modify: `packages/claw-studio-desktop/src-tauri/src/framework/services/jobs.rs`
- Create: `packages/claw-studio-desktop/src-tauri/src/commands/terminal_commands.rs`
- Create: `packages/claw-studio-desktop/src-tauri/src/framework/services/terminal.rs`
- Create: `scripts/check-v5-desktop-host.mjs`

- [ ] **Step 1: Write the failing host checks**

Create `scripts/check-v5-desktop-host.mjs` with assertions for:

- `claw-studio-desktop` no longer depends on the removed `claw-studio-shell`
- Tauri config points to the root V5 frontend surface
- runtime bridge exports V5-compatible process/job APIs

- [ ] **Step 2: Run the host checks to verify they fail**

Run: `node scripts/check-v5-desktop-host.mjs`

Expected: FAIL because the desktop package still reflects the previous workspace architecture.

- [ ] **Step 3: Rewire the desktop package as host-only**

Keep `packages/claw-studio-desktop` as the native host package, but remove its dependency on the old shell structure and wire it to the V5 root app and new core runtime contracts.

- [ ] **Step 4: Re-run the host checks**

Run: `node scripts/check-v5-desktop-host.mjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/claw-studio-desktop scripts/check-v5-desktop-host.mjs
git commit -m "feat: preserve desktop as a host-only v5 runtime package"
```

### Task 7: Add `sdkwork-claw-terminal` And The Shared Terminal Contract

**Files:**
- Create: `packages/sdkwork-claw-terminal/package.json`
- Create: `packages/sdkwork-claw-terminal/tsconfig.json`
- Create: `packages/sdkwork-claw-terminal/src/index.ts`
- Create: `packages/sdkwork-claw-terminal/src/Terminal.tsx`
- Create: `packages/sdkwork-claw-terminal/src/components/*`
- Create: `packages/sdkwork-claw-terminal/src/services/terminalService.ts`
- Create: `packages/sdkwork-claw-terminal/src/services/terminalService.test.ts`
- Modify: `packages/sdkwork-claw-core/src/runtime/contracts.ts`
- Modify: `packages/sdkwork-claw-core/src/runtime/index.ts`
- Modify: `packages/sdkwork-claw-core/src/components/Sidebar.tsx`
- Modify: `src/App.tsx`
- Modify: `scripts/check-v5-standard-foundation.mjs`

- [ ] **Step 1: Write the failing terminal tests**

Add `packages/sdkwork-claw-terminal/src/services/terminalService.test.ts` covering:

- terminal session creation through the runtime contract
- output subscription wiring
- graceful fallback when terminal sessions are unavailable

Also add contract assertions in `scripts/check-v5-standard-foundation.mjs` for the terminal package and route.

- [ ] **Step 2: Run the tests to verify they fail**

Run:

- `node --experimental-strip-types packages/sdkwork-claw-terminal/src/services/terminalService.test.ts`
- `node scripts/check-v5-standard-foundation.mjs`

Expected: FAIL because `sdkwork-claw-terminal` and the shared terminal runtime contract do not yet exist.

- [ ] **Step 3: Create the package and wire the route**

Add the new terminal package, expose a first-class route from the root app, and use the shared runtime contract instead of calling Tauri commands directly from feature UI.

- [ ] **Step 4: Re-run the tests**

Run:

- `node --experimental-strip-types packages/sdkwork-claw-terminal/src/services/terminalService.test.ts`
- `node scripts/check-v5-standard-foundation.mjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-terminal packages/sdkwork-claw-core src/App.tsx scripts/check-v5-standard-foundation.mjs
git commit -m "feat: add sdkwork-claw-terminal feature package"
```

## Chunk 4: Finish Feature Migration And Remove The Old Architecture

### Task 8: Port Remaining V5 Feature Packages And Normalize Shared Imports

**Files:**
- Modify: `packages/sdkwork-claw-account/src/**/*`
- Modify: `packages/sdkwork-claw-apps/src/**/*`
- Modify: `packages/sdkwork-claw-auth/src/**/*`
- Modify: `packages/sdkwork-claw-center/src/**/*`
- Modify: `packages/sdkwork-claw-channels/src/**/*`
- Modify: `packages/sdkwork-claw-chat/src/**/*`
- Modify: `packages/sdkwork-claw-community/src/**/*`
- Modify: `packages/sdkwork-claw-devices/src/**/*`
- Modify: `packages/sdkwork-claw-docs/src/**/*`
- Modify: `packages/sdkwork-claw-extensions/src/**/*`
- Modify: `packages/sdkwork-claw-github/src/**/*`
- Modify: `packages/sdkwork-claw-huggingface/src/**/*`
- Modify: `packages/sdkwork-claw-install/src/**/*`
- Modify: `packages/sdkwork-claw-instances/src/**/*`
- Modify: `packages/sdkwork-claw-market/src/**/*`
- Modify: `packages/sdkwork-claw-settings/src/**/*`
- Modify: `packages/sdkwork-claw-tasks/src/**/*`
- Create: `scripts/check-v5-route-surface.mjs`

- [ ] **Step 1: Write the failing route and export check**

Create `scripts/check-v5-route-surface.mjs` to assert:

- every V5 route is mounted from `src/App.tsx`
- every active feature package resolves through its package-barrel export
- no active feature package imports removed intermediate packages

- [ ] **Step 2: Run the route and export check to verify it fails**

Run: `node scripts/check-v5-route-surface.mjs`

Expected: FAIL because the copied V5 packages still need import normalization and route assembly updates.

- [ ] **Step 3: Port and normalize the feature packages**

Port the remaining feature pages and services from the V5 snapshot, then normalize imports so shared UI comes from `sdkwork-claw-ui`, shared runtime comes from `sdkwork-claw-core`, and no feature depends on removed intermediate packages.

- [ ] **Step 4: Re-run the route and export check**

Run: `node scripts/check-v5-route-surface.mjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sdkwork-claw-account packages/sdkwork-claw-apps packages/sdkwork-claw-auth packages/sdkwork-claw-center packages/sdkwork-claw-channels packages/sdkwork-claw-chat packages/sdkwork-claw-community packages/sdkwork-claw-devices packages/sdkwork-claw-docs packages/sdkwork-claw-extensions packages/sdkwork-claw-github packages/sdkwork-claw-huggingface packages/sdkwork-claw-install packages/sdkwork-claw-instances packages/sdkwork-claw-market packages/sdkwork-claw-settings packages/sdkwork-claw-tasks src/App.tsx scripts/check-v5-route-surface.mjs
git commit -m "feat: port v5 feature packages onto the new shared foundation"
```

### Task 9: Delete Obsolete Intermediate Architecture Artifacts

**Files:**
- Remove: `packages/claw-studio-account`
- Remove: `packages/claw-studio-apps`
- Remove: `packages/claw-studio-business`
- Remove: `packages/claw-studio-channels`
- Remove: `packages/claw-studio-chat`
- Remove: `packages/claw-studio-claw-center`
- Remove: `packages/claw-studio-community`
- Remove: `packages/claw-studio-devices`
- Remove: `packages/claw-studio-distribution`
- Remove: `packages/claw-studio-docs`
- Remove: `packages/claw-studio-domain`
- Remove: `packages/claw-studio-extensions`
- Remove: `packages/claw-studio-github`
- Remove: `packages/claw-studio-huggingface`
- Remove: `packages/claw-studio-infrastructure`
- Remove: `packages/claw-studio-install`
- Remove: `packages/claw-studio-instances`
- Remove: `packages/claw-studio-market`
- Remove: `packages/claw-studio-settings`
- Remove: `packages/claw-studio-shared-ui`
- Remove: `packages/claw-studio-shell`
- Remove: `packages/claw-studio-tasks`
- Remove: `packages/claw-studio-web`
- Remove: `packages/cc-switch`
- Modify: `scripts/check-v5-standard-foundation.mjs`
- Modify: `scripts/check-v5-route-surface.mjs`

- [ ] **Step 1: Extend the failing cleanup checks**

Update the contract scripts so they fail if any obsolete intermediate package remains referenced or present.

- [ ] **Step 2: Run the cleanup checks to verify they fail**

Run:

- `node scripts/check-v5-standard-foundation.mjs`
- `node scripts/check-v5-route-surface.mjs`

Expected: FAIL because the old intermediate packages are still present or referenced.

- [ ] **Step 3: Remove obsolete package directories and dead references**

Delete the removed architecture packages only after their necessary code has been migrated, then clean remaining references from package manifests, imports, scripts, and docs.

- [ ] **Step 4: Re-run the cleanup checks**

Run:

- `node scripts/check-v5-standard-foundation.mjs`
- `node scripts/check-v5-route-surface.mjs`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove the obsolete intermediate workspace architecture"
```

### Task 10: Verify The Standard Foundation End To End

**Files:**
- Modify as needed: `package.json`
- Modify as needed: `packages/claw-studio-desktop/package.json`
- Modify as needed: `scripts/check-v5-standard-foundation.mjs`
- Modify as needed: `scripts/check-v5-desktop-host.mjs`
- Modify as needed: `scripts/check-v5-route-surface.mjs`

- [ ] **Step 1: Run the focused contract checks**

Run:

- `node scripts/check-v5-standard-foundation.mjs`
- `node scripts/check-v5-desktop-host.mjs`
- `node scripts/check-v5-route-surface.mjs`

Expected: PASS

- [ ] **Step 2: Run the targeted TypeScript tests**

Run:

- `node --experimental-strip-types packages/sdkwork-claw-ui/src/lib/utils.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-core/src/store/useAppStore.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-core/src/runtime/registry.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-i18n/src/index.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-terminal/src/services/terminalService.test.ts`

Expected: PASS

- [ ] **Step 3: Run workspace verification**

Run:

- `pnpm install`
- `pnpm lint`
- `pnpm build`

Expected: PASS

- [ ] **Step 4: Run desktop-host verification**

Run:

- `cargo test --manifest-path packages/claw-studio-desktop/src-tauri/Cargo.toml`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: verify the v5 standard foundation migration"
```
