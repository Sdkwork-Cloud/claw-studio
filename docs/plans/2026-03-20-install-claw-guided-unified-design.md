# Install Claw Guided Unified Design

**Date:** 2026-03-20

## Goal

Refactor the `install claw` page into a product-first install workspace with a compact left product sidebar, a simplified right content area, segmented `icon + text` lifecycle tabs, adaptive install-method cards, and a modal-based guided installer that performs real installation through `hub-installer`.

## User Experience

The page keeps three modes:

- `安装`: show only the supported install methods for the selected product. Each method stays compact, visually comparable, and ends with the unchanged primary CTA `立即安装`.
- `迁移`: stay simple and truthful. Show only the detected/manual migration sources plus the direct migrate action.
- `卸载`: stay simple and truthful. Show only install-method-specific uninstall targets plus the direct uninstall action.

Install mode is the only rich workflow. Clicking `立即安装` opens a modal wizard. The page itself should not expand into an inline stepper.

## Approved Interaction Model

### Page Layout

- Left sidebar: concise product list for `OpenClaw`, `ZeroClaw`, and `IronClaw`.
- Right header: segmented tabs with `icon + text` for `安装`, `迁移`, and `卸载`.
- Right body:
  - install mode: adaptive method-card grid
  - migrate mode: compact migration cards
  - uninstall mode: compact uninstall cards

No extra marketing blocks, long summaries, or secondary shells should remain on the page.

### Install Modal

The modal is the canonical install experience for every product and every install method.

It must use these five steps:

1. `安装依赖`
   - inspect dependencies with `installerService.inspectHubInstall`
   - show dependency list
   - show which dependencies are already ready
   - install missing dependencies one by one with `runHubDependencyInstall`
   - stream progress and show completed checkmarks
2. `安装 {{product}}`
   - execute the real install with `runHubInstall`
   - stream real progress with `subscribeHubInstallProgress`
3. `进行配置`
   - large-model config:
     - choose model `channel`
     - configure `apiKey`
     - configure `baseUrl`
     - choose `model`
   - instant-messaging config:
     - choose which channels to bind
     - fill required channel fields
4. `初始化`
   - choose `package` and `skill` from a popup selector
   - install selections onto the configured instance
5. `安装成功`
   - show concise success state
   - confirm action routes to `/chat`

## Official Logic Alignment

The install choices and dependency expectations should mirror official OpenClaw install guidance and local manifest truth:

- Windows should continue to prioritize WSL for OpenClaw when supported.
- Docker, npm, pnpm, and source installs should remain exposed only when the host and manifest support them.
- Source-only products must not pretend to support package-manager installs.
- Dependency checks must reflect real requirements from `hub-installer` manifests rather than hard-coded UI assumptions.

Reference sources:

- Official docs: [Installation | OpenClaw](https://openclawdoc.com/docs/getting-started/installation/)
- Official docs: [OpenClaw Setup](https://docs.openclaw.ai/start/setup)
- Runtime truth: `packages/sdkwork-claw-desktop/src-tauri/vendor/hub-installer/registry/manifests/*.hub.yaml`

## Architecture

### Page Responsibilities

`Install.tsx` should only own:

- selected product and mode
- runtime detection and install-method assessments
- adaptive method-card rendering
- uninstall and migration flows
- opening and closing the guided install modal

### Guided Install Responsibilities

A dedicated modal component should own:

- 5-step install state
- dependency remediation
- real install execution
- configuration form state
- initialization selection popup
- success routing

### Unified Bootstrap Data

The configuration and initialization steps must not scatter catalog data across the install feature.

Because `sdkwork-claw-install` cannot depend directly on sibling feature packages under repository boundary rules, the install feature should define a small internal aggregation service backed by the same shared `studioMockService` data used by:

- provider channel/provider catalogs
- Channels configuration records
- Marketplace pack/skill catalogs

This keeps the install feature aligned with the same authoritative data without violating package-layer boundaries.

## Configuration Model

### LLM Configuration

The wizard should:

- load the provider channel catalog
- load existing proxy providers grouped by channel
- infer suggested base URL and model list from the selected channel's providers
- allow direct editing of `apiKey`, `baseUrl`, and selected `model`
- create or update a proxy provider record
- upsert the chosen provider into the selected runtime instance

### Instant Messaging Configuration

The wizard should:

- load the selected instance's channel list
- allow selecting multiple channels to bind
- render required fields only for selected channels
- save config for each selected channel
- mark selected channels enabled/connected when configuration succeeds

## Initialization Model

Initialization should use a popup selector rather than an oversized inline marketplace view.

The popup should:

- switch between `Packages` and `Skills`
- support multi-select
- surface concise metadata only
- return selections back to the wizard step

The wizard step should then install:

- selected packs first
- selected standalone skills second
- dedupe skills already included by packs

## Success Behavior

Step five replaces the old verification-heavy finish state.

It should:

- clearly show that installation succeeded
- summarize the chosen runtime instance, model channel, selected model, bound IM channels, and initialization count
- set the configured instance as the active instance
- navigate to `/chat` after confirm

## Visual Direction

- Keep the page itself visually minimal.
- Keep install cards concise and scannable.
- Use adaptive columns for install methods based on count.
- Use a high-polish modal with strong hierarchy:
  - left step rail on desktop
  - stacked layout on smaller screens
  - meaningful progress styling
  - clear success feedback
- Avoid dense explanatory copy. The interface should feel obvious without reading paragraphs.

## Testing Strategy

- Update install-page model tests for adaptive grid and 5-step metadata.
- Replace the current inline-stepper contract expectations with modal-wizard expectations.
- Add service tests for the unified bootstrap/config/init flow.
- Re-run install package contract checks, build, and targeted service tests.

## Risks

- The previous inline install flow already diverged from user requirements and must be fully removed.
- Chinese locale keys are currently corrupted in the install area and must be repaired carefully without damaging unrelated keys.
- The chat experience depends on the active runtime being selected correctly after installation.

## Success Criteria

- `立即安装` opens a modal guided installer again.
- All products use the same 5-step wizard structure.
- Dependency checks and install actions run through real `hub-installer` APIs.
- Configuration uses unified underlying catalogs rather than duplicated data.
- Initialization uses a popup package/skill selector.
- Uninstall and migration remain simple and non-step-based.
- The install page is substantially cleaner and easier to understand than the current broken version.
