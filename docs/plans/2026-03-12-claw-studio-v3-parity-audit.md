# Claw Studio V3 Parity Audit

## Baseline

- Source of truth: `upgrade/claw-studio-v3`
- Target: `packages/*` workspace packages plus `claw-studio-shell` composition layer
- Constraint: all cross-package imports and exports stay at package root only

## Verified Parity Areas

- Routes: current `claw-studio-shell` route table still exposes the full v3 route surface, including `account`, `extensions`, settings, docs, market, chat, install, instances, community, github, huggingface, and claw center.
- Feature packages: `account`, `extensions`, `apps`, `channels`, `chat`, `claw-center`, `community`, `devices`, `docs`, `github`, `huggingface`, `install`, `instances`, `market`, `settings`, and `tasks` all exist in the workspace.
- Shared stores: `useAppStore`, `useChatStore`, `useInstanceStore`, `useLLMStore`, and `useTaskStore` are present in `@sdkwork/claw-studio-business`.
- Service surface: v3 feature services are present, with workspace-only additions such as tests and platform orchestration services living outside the v3 baseline.

## Drift Fixed In This Pass

- `packages/claw-studio-shell/src/components/Sidebar.tsx`
  - restored `react-i18next` usage so shell navigation copy follows the v3 translation contract
- `packages/claw-studio-account/src/pages/account/Account.tsx`
  - restored v3 translation key usage for titles, actions, status copy, and modal controls
- `packages/claw-studio-settings/src/pages/settings/Settings.tsx`
  - realigned billing tab order, billing icon, sidebar width, title sizing, and search input styling with the v3 page
- `packages/claw-studio-settings/src/pages/settings/GeneralSettings.tsx`
  - restored v3 startup preference loading and persistence through `settingsService.getPreferences` / `updatePreferences`
- `packages/claw-studio-settings/src/pages/settings/Shared.tsx`
  - restored the v3 controlled toggle contract so settings toggles sync external state and invoke page-level persistence callbacks
- `packages/claw-studio-settings/src/pages/settings/NotificationSettings.tsx`
  - restored v3 notification preference loading and persistence, replacing hardcoded toggle state with `settingsService`-backed preferences
- `packages/claw-studio-settings/src/pages/settings/DataPrivacySettings.tsx`
  - restored v3 privacy preference loading, persistence, and export/delete action feedback instead of hardcoded toggles
- `packages/claw-studio-settings/src/pages/settings/SecuritySettings.tsx`
  - restored v3 security preference loading, login alerts, two-factor toggle behavior, revoke-session feedback, and cleaned corrupted placeholder/session copy
- `packages/claw-studio-settings/src/pages/settings/AccountSettings.tsx`
  - restored the v3 avatar-action success feedback and aligned settings-page service imports to the local services barrel boundary
- `packages/claw-studio-settings/src/pages/settings/ApiKeysSettings.tsx`
  - restored the v3 API key usage column and empty-state column span while keeping settings-page service imports behind the local barrel
- `packages/claw-studio-shell/src/application/providers/ThemeManager.tsx`
  - restored the v3 `system` theme listener so live OS theme changes update the shell without refresh
- `packages/claw-studio-shell/src/components/commandPaletteCommands.ts`
  - removed non-v3 account/extensions shortcuts so the command palette navigation surface matches the upgrade baseline again
- `packages/claw-studio-shell/src/components/CommandPalette.tsx`
  - restored the v3 keyboard-hint footer symbols after shell refactoring so the palette UI matches the upgrade baseline
- `packages/claw-studio-shell/src/components/GlobalTaskManager.tsx`
  - restored the v3 `scrollbar-hide` task list affordance so the task panel matches the original shell behavior more closely
- `packages/claw-studio-infrastructure/src/i18n/index.ts`
  - replaced hand-maintained resource objects with locale JSON files copied from `upgrade/claw-studio-v3/src/locales`
- `packages/claw-studio-market/src/pages/market/Market.tsx`
  - restored the v3 `myskills` surface, active-instance awareness, and installed-skill management workflow
- `packages/claw-studio-market/src/pages/market/SkillDetail.tsx`
  - restored the v3 installed-state handling, local download affordances, and instance install/uninstall flow
- `packages/claw-studio-market/src/pages/market/SkillPackDetail.tsx`
  - restored the v3 installed-skill filtering and selective pack-install workflow
- `packages/claw-studio-instances/src/pages/instances/Instances.tsx`
  - restored the v3 active-instance badges, lifecycle controls, and token/cost summary affordances
- `packages/claw-studio-community/src/pages/community/Community.tsx`
  - restored the v3 scroll-shell layout behavior
- `packages/claw-studio-business/src/services/marketService.ts`
  - restored the v3 local-download helpers and `device_id` / selective `skill_ids` installation payloads
- `packages/claw-studio-web/server.ts`
  - restored the v3 selective pack-install route contract so pack installs can target specific skills
- `packages/claw-studio-settings/src/services/settingsService.ts`
  - moved the v3 settings preferences/profile contract into the settings feature package so settings business logic is owned locally instead of through `business`
- `packages/claw-studio-settings/src/services/apiKeyService.ts`
  - moved the v3 API key contract into the settings feature package so settings-only service logic no longer leaks through `business`
- `packages/claw-studio-market/src/services/mySkillService.ts`
  - moved the installed-skill contract into the market feature package so the v3 `myskills` workflow is owned by the package that renders it
- `packages/claw-studio-shell/src/application/providers/AppProviders.tsx`
  - switched shell i18n bootstrap to the infrastructure package so low-level setup stays in the infrastructure boundary
- `packages/claw-studio-install/src/services/installPathService.ts`
  - switched file-selection behavior to the infrastructure package so install pages consume platform helpers from the correct layer
- `packages/claw-studio-install/src/services/installerService.ts`
  - switched installer execution to the infrastructure package so install pages no longer depend on `business` for platform execution helpers
- `packages/claw-studio-business/src/index.ts`
  - slimmed the business barrel down to shared stores, hooks, update/runtime services, and the small set of genuinely cross-feature services
- `scripts/check-arch-boundaries.mjs`
  - now fails if `business` re-exports feature-local services such as settings, tasks, channels, devices, or market installed-skill helpers

## Structural Differences That Are Intentional

- v3 page-local claw-center product cards now live under `packages/claw-studio-claw-center/src/components/products`, not under `src/pages`; this is a package organization change, not a functional delta.
- Workspace-only tests, update services, runtime services, and platform abstractions extend the repository beyond v3 but do not replace v3-facing feature behavior.

## Package Ownership Decisions

- `@sdkwork/claw-studio-business` now acts as the shared state and orchestration layer, not the default home for feature-local services.
- Feature-owned services now live with the feature that renders and evolves them: settings owns settings/API-key services, market owns installed-skill state helpers, and feature pages keep importing their own local service barrels.
- `@sdkwork/claw-studio-infrastructure` owns low-level bootstrap and platform helpers such as i18n initialization, file dialogs, and installer execution.
- `@sdkwork/claw-studio-shell` remains a composition layer. It may depend on infrastructure for bootstrap concerns, but it does not own feature business logic.

## Guardrails

- `packages/claw-studio-infrastructure/src/i18n/index.test.ts` locks locale resources to the copied v3 JSON files
- `packages/claw-studio-settings/src/services/settingsService.test.ts` locks the restored settings preferences contract in the settings package
- `packages/claw-studio-market/src/services/mySkillService.test.ts` locks the restored installed-skill service contract in the market package
- `scripts/v3-parity-ui-contract.test.ts` guards shell/account/settings parity wiring, plus market, skill detail, skill pack detail, instances, community, market-service, and selective pack-install parity
- `scripts/root-import-boundaries.test.ts` and `scripts/root-package-exports.test.ts` keep root-only package consumption enforced
- `scripts/check-arch-boundaries.mjs` now also prevents `business` from becoming a second service monolith again

## Verification Notes

- Source verification passed in the workspace via `scripts/root-import-boundaries.test.ts`, `scripts/root-package-exports.test.ts`, `scripts/check-arch-boundaries.mjs`, `packages/claw-studio-settings/src/services/settingsService.test.ts`, `packages/claw-studio-market/src/services/mySkillService.test.ts`, and `scripts/v3-parity-ui-contract.test.ts`.
- Full `pnpm lint` and `pnpm build` were re-verified in the isolated copy `C:\Users\admin\.codex\memories\claw-studio-verify-20260312` after syncing the latest package-boundary changes and reinstalling dependencies there.
- The primary workspace still has externally locked files under `node_modules/.pnpm`, so reinstalling dependencies in place is currently an environment issue rather than a source parity issue.
