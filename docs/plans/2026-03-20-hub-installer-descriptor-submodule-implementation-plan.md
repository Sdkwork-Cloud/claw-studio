# Hub Installer Descriptor + Submodule Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add first-class install/data/migration descriptors to `hub-installer`, push the upstream repo, convert Claw Studio to a real `hub-installer` submodule, and consume the new assessment metadata in the install UI.

**Architecture:** The upstream `hub-installer` registry manifest becomes the canonical product descriptor source. TypeScript validation, JSON Schema, and Rust serde types all parse the same descriptor structure. Rust assessment APIs expose those descriptors to Claw Studio, which renders them in the product lifecycle UI and guided install wizard. Claw Studio references the upstream repo through a git submodule so future updates stay pullable.

**Tech Stack:** TypeScript, Vitest, JSON Schema, Rust, Serde, Cargo, React, Tauri, pnpm, git submodules.

---

### Task 1: Lock the upstream contract with failing tests

**Files:**
- Modify: `D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/.codex-tools/tmp/hub-installer-remote/src/registry/builtin-installers.test.ts`
- Create: `D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/.codex-tools/tmp/hub-installer-remote/src/manifest/descriptors.test.ts`
- Create: `D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/.codex-tools/tmp/hub-installer-remote/rust/tests/product_descriptor_contract.rs`

**Step 1: Confirm the new tests are present and focused**

Run: `git status --short`
Expected: test files show as modified or new in the remote clone.

**Step 2: Run the targeted TypeScript tests and observe failure**

Run: `pnpm test -- src/manifest/descriptors.test.ts src/registry/builtin-installers.test.ts`
Expected: descriptor fields fail because `installation`, `dataLayout`, and `migration` are missing or undefined.

**Step 3: Run the targeted Rust contract test and observe failure**

Run: `cargo test --test product_descriptor_contract`
Expected: descriptor fields or assessment exposure fail until Rust types/engine are updated.

### Task 2: Add descriptor support to TypeScript manifest types and validation

**Files:**
- Modify: `D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/.codex-tools/tmp/hub-installer-remote/src/manifest/types.ts`
- Modify: `D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/.codex-tools/tmp/hub-installer-remote/src/manifest/validate.ts`

**Step 1: Write the minimal type additions**

Add interfaces for:

- installation method + alternatives
- directory descriptors
- data items
- migration strategies

**Step 2: Parse the descriptor fields in `validateManifest`**

Make `validateManifest()` preserve the new sections while validating enum-like fields and command arrays.

**Step 3: Re-run the descriptor TypeScript test**

Run: `pnpm test -- src/manifest/descriptors.test.ts`
Expected: PASS

### Task 3: Extend the JSON schema and documentation

**Files:**
- Modify: `D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/.codex-tools/tmp/hub-installer-remote/schemas/hub-installer.manifest.schema.json`
- Modify: `D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/.codex-tools/tmp/hub-installer-remote/docs/manifest-spec.md`
- Modify: `D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/.codex-tools/tmp/hub-installer-remote/README.md`

**Step 1: Add schema definitions for all new descriptor sections**

Keep them optional and strongly typed.

**Step 2: Document intended semantics**

Cover:

- supported automated method vs documented alternatives
- customizable directories
- data preservation policy
- manual vs automated migration

**Step 3: Re-run TypeScript tests that load manifests from the registry**

Run: `pnpm test -- src/registry/builtin-installers.test.ts`
Expected: still failing only because registry manifests are not filled yet.

### Task 4: Populate registry manifests with truthful product descriptors

**Files:**
- Modify: `D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/.codex-tools/tmp/hub-installer-remote/registry/software-registry.yaml`
- Modify: `D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/.codex-tools/tmp/hub-installer-remote/registry/manifests/openclaw.hub.yaml`
- Modify: `D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/.codex-tools/tmp/hub-installer-remote/registry/manifests/openclaw-pnpm.hub.yaml`
- Modify: `D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/.codex-tools/tmp/hub-installer-remote/registry/manifests/openclaw-source.hub.yaml`
- Modify: `D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/.codex-tools/tmp/hub-installer-remote/registry/manifests/openclaw-docker.hub.yaml`
- Modify: `D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/.codex-tools/tmp/hub-installer-remote/registry/manifests/codex.hub.yaml`
- Modify: `D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/.codex-tools/tmp/hub-installer-remote/registry/manifests/zeroclaw-source.hub.yaml`
- Modify: `D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/.codex-tools/tmp/hub-installer-remote/registry/manifests/ironclaw-source.hub.yaml`

**Step 1: Add descriptor content for ZeroClaw and IronClaw**

Encode:

- source-build primary method
- install/work/data directories
- real home/config/database data items
- OpenClaw migration strategy

**Step 2: Add descriptor content for OpenClaw and Codex**

Encode:

- recommended method and alternatives
- config/auth/channel/log/sqlite data items
- custom directory capabilities and Windows/WSL notes where relevant

**Step 3: Re-run bundled registry tests**

Run: `pnpm test -- src/registry/builtin-installers.test.ts`
Expected: PASS

### Task 5: Add descriptor support to Rust manifest parsing and assessment output

**Files:**
- Modify: `D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/.codex-tools/tmp/hub-installer-remote/rust/src/manifest.rs`
- Modify: `D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/.codex-tools/tmp/hub-installer-remote/rust/src/engine.rs`
- Modify: `D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/.codex-tools/tmp/hub-installer-remote/rust/src/lib.rs`

**Step 1: Add serde structs mirroring the TypeScript descriptor model**

Keep field names and semantics aligned.

**Step 2: Extend `InstallAssessmentResult`**

Expose:

- `installation`
- `data_items`
- `migration_strategies`

**Step 3: Populate those fields inside `inspect_loaded_manifest()`**

Render variable-based paths where appropriate and clone descriptor metadata into the assessment result.

**Step 4: Re-run the Rust contract test**

Run: `cargo test --test product_descriptor_contract`
Expected: PASS

### Task 6: Verify and publish the upstream `hub-installer` repo

**Files:**
- Verify all modified files under `D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/.codex-tools/tmp/hub-installer-remote`

**Step 1: Run upstream verification**

Run: `pnpm test`
Expected: PASS

Run: `pnpm build`
Expected: PASS

Run: `cargo test`
Expected: PASS or explicitly documented environment-related failures only.

**Step 2: Commit the upstream repo**

Run:

```bash
git add .
git commit -m "feat: add structured product descriptors"
```

Expected: clean commit in the remote clone.

**Step 3: Push to upstream main**

Run: `git push origin main`
Expected: succeeds if credentials are available.

### Task 7: Convert Claw Studio to a real `hub-installer` submodule

**Files:**
- Modify: `D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/.gitmodules`
- Replace directory with submodule: `D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer`

**Step 1: Preserve local parent-repo work**

Check current dirty files and avoid touching unrelated changes.

**Step 2: Remove the detached vendored directory and add the submodule**

Point it to `https://github.com/Sdkwork-Cloud/hub-installer`.

**Step 3: Confirm submodule linkage**

Run: `git submodule status`
Expected: the hub-installer path resolves to the pushed upstream commit.

### Task 8: Consume descriptor fields in Claw Studio contracts, Tauri, and UI

**Files:**
- Modify: `D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/packages/sdkwork-claw-infrastructure/src/platform/contracts/installer.ts`
- Modify: `D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/packages/sdkwork-claw-desktop/src-tauri/src/commands/run_hub_install.rs`
- Modify: `D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/packages/sdkwork-claw-install/src/pages/install/Install.tsx`
- Modify: `D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/packages/sdkwork-claw-install/src/components/OpenClawGuidedInstallWizard.tsx`
- Modify: `D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/packages/sdkwork-claw-i18n/src/locales/en.json`
- Modify: `D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/packages/sdkwork-claw-i18n/src/locales/zh.json`
- Modify: `D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio/scripts/sdkwork-install-contract.test.ts`

**Step 1: Extend the shared TS contract**

Add TypeScript interfaces for installation, data items, and migration strategies.

**Step 2: Extend the Tauri bridge serialization**

Map Rust assessment descriptor fields into camelCase JSON for the frontend.

**Step 3: Update the install UI**

Render:

- primary method and alternatives
- custom directory capability
- data preservation/removal summary
- migration strategies, preview/apply commands, warnings

Keep the existing guided flow and product-first visual structure intact.

**Step 4: Update contract tests**

Assert that Claw Studio now depends on descriptor data from the submodule rather than static page-only copy.

### Task 9: Run parent verification and prepare final git state

**Files:**
- Verify all touched parent-repo files under `D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/claw-studio`

**Step 1: Run focused parent tests**

Run: `node scripts/sdkwork-install-contract.test.ts`
Expected: PASS

**Step 2: Run workspace verification as far as practical**

Run: `pnpm lint`
Expected: PASS

Run: `pnpm build`
Expected: PASS, or document unrelated pre-existing blockers if encountered.

**Step 3: Commit the parent repo**

Run:

```bash
git add .gitmodules packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer packages/sdkwork-claw-install packages/sdkwork-claw-infrastructure packages/sdkwork-claw-i18n scripts/sdkwork-install-contract.test.ts docs/plans/2026-03-20-hub-installer-descriptor-submodule-design.md docs/plans/2026-03-20-hub-installer-descriptor-submodule-implementation-plan.md
git commit -m "feat: upgrade hub installer integration"
```

Expected: parent repo commit captures only relevant files plus the submodule pointer.
