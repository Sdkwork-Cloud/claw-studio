# Install Claw Product-First Navigation Redesign

**Context**

The current `Install Claw` page is already more compact than the earlier hero-led version, but it still frames the experience around `Install / Uninstall / Migrate` first and products second. That makes the page feel operationally complete while the actual mental model is still split: product choice lives only inside install, the header still occupies too much attention, and uninstall or migrate do not yet behave like true per-product workspaces.

The next refinement should treat the page as a product lifecycle console. Users should first pick the product they care about, then switch between install, uninstall, and migrate inside that product context. This reduces visual noise, makes the page easier to scan, and future-proofs the information architecture for more OpenClaw-like products.

**Goals**

- Make the selected product the first and strongest navigation decision.
- Reduce header noise so the primary focus stays on the active workspace.
- Preserve three clearly separated modes while moving mode switching into a lightweight top control.
- Let install, uninstall, and migrate all operate inside the current product context.
- Create a scalable shell that can accommodate more products without rethinking the page structure again.

**Non-Goals**

- Rebuild the route, backend installer bridge, or modal execution flow from scratch.
- Introduce a wizard or multi-step full-screen flow.
- Add new platform capabilities beyond what the current bridge can support.

**Approaches Considered**

1. Mode-first sidebar
   Put `Install / Uninstall / Migrate` in the left rail and keep product selection in the main area.
   Tradeoff: cleaner than today, but it optimizes for the smaller axis of change. As new products are added, the page would still need product pickers inside each workspace.

2. Product-first sidebar with lightweight mode tabs
   Use the sidebar for product selection, keep mode switching in a compact top tab row, and render a per-product lifecycle workspace in the main area.
   Tradeoff: slightly larger refactor, but it matches the product mental model and creates the cleanest path for future expansion.

3. Nested product cards inside each mode
   Keep the current top mode switch and show products as card groups inside install, uninstall, and migrate separately.
   Tradeoff: lowest engineering risk, but visually repetitive and still too noisy because product navigation is duplicated three times.

**Recommendation**

Use approach 2. The page should be product-first because product is the durable navigation object and lifecycle mode is a temporary filter inside that context.

**Design**

## 1. Information Architecture

- Left sidebar: product catalog
- Top header: current product identity, compact platform/detection status, lightweight mode tabs
- Main canvas: active workspace for the selected product and mode

This creates a simple mental sequence:

1. choose a product
2. choose what to do with it
3. execute the focused workflow

## 2. Sidebar Strategy

- The sidebar should feel like a quiet product rail, not a secondary dashboard.
- Each product item should show:
  - product name
  - one short descriptor
  - selected state
- The selected product should be visually obvious without using oversized decoration.
- The rail should remain stable across all three modes so users never lose orientation.

## 3. Header Strategy

- Remove the large mode hero treatment.
- Keep only:
  - current product name
  - one-line contextual description
  - compact status pills
  - mode tabs
- The header must orient quickly and then get out of the way.
- The dominant visual weight should move below the header into the workspace.

## 4. Install Workspace

- Install remains the conversion-focused mode.
- Show one recommended method region first, followed by secondary methods if present.
- Keep environment readiness visible but lightweight.
- Product selection must not repeat here because it already exists in the sidebar.
- The install CTA should remain the strongest button on the page.

## 5. Uninstall Workspace

- Uninstall should inherit the selected product context.
- Lead with detected installation status for the current product.
- Separate “detected environment” from “available removal actions.”
- Use a more restrained cautionary tone than install.
- If a product has limited uninstall automation, show that clearly inside the workspace instead of hiding the mode or breaking the navigation model.

## 6. Migrate Workspace

- Migrate should also inherit the selected product context.
- Treat it as a structured import surface:
  - detected source paths
  - manual source selection
  - ready-to-import summary
- Product-specific wording should make it clear what is being imported and where it will land.
- If product-specific sources cannot be detected, the manual source path should still keep the workspace useful.

## 7. Availability Model

- Every product can be selected in every mode.
- The workspace decides whether the current product has:
  - automated actions
  - manual guidance only
  - no detected source yet
- This keeps the navigation consistent while staying honest about platform capability.

## 8. Interaction Principles

- Product is sticky; mode is switchable.
- Header remains compact at all times.
- First visible action should always feel obvious.
- Supporting detail should be grouped into calm secondary surfaces.
- Visual contrast should come from action priority, not ornament.

**Implementation Direction**

- Promote product configuration into a lifecycle configuration:
  - install methods
  - uninstall methods
  - migration path strategy
  - availability copy
- Replace global uninstall and migration assumptions with per-product selectors.
- Add explicit structural markers for sidebar, minimal header, and per-mode workspaces so the contract test can protect this IA.

**Verification**

- Add install contract assertions for:
  - product-first sidebar shell
  - minimal workspace header
  - per-product install, uninstall, and migrate selectors
- Run `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`.
- Run `pnpm lint`.
- Run `pnpm build`.
