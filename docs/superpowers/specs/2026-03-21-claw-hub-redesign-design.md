# Claw Hub Redesign Design

## Goal

Turn `claw hub` into a lighter, clearer discovery surface that matches the reference image's calm catalog feel while preserving the real product abilities that already exist in Claw Studio: search, categorization, skill detail, pack detail, multi-instance install, and installed-skill management.

## Current Problem

The current `packages/sdkwork-claw-market/src/pages/Market.tsx` page is feature-complete but cognitively heavy.

1. The page starts with a large marketing hero that dominates the viewport before users reach the actual catalog.
2. The primary navigation splits discovery into four tabs (`packages`, `skills`, `myskills`, `sdkwork`), which makes users choose an internal data model instead of following a simple browse/install flow.
3. The visual language is darker, denser, and more promotional than the reference image, so the page feels more like a launch surface than a practical workbench.
4. Important actions such as install and uninstall are available, but the surrounding information architecture makes them feel more complex than they need to be.

## Desired Behavior

1. The default page should feel like a straightforward skill library.
2. The top level should only expose two mental models:
   - discover skills
   - manage my skills
3. Skill packs should still exist, but they should become curated shortcuts near the top of the discovery view instead of a separate primary tab.
4. Search and category filtering should stay visible and lightweight.
5. Cards should read quickly: icon, title, short description, a small amount of metadata, and one clear action.
6. Installation and instance-selection flows should remain intact, but they should sit behind focused actions and modals instead of occupying homepage real estate.

## Architecture

The redesign stays inside the existing feature boundary.

- `packages/sdkwork-claw-market/src/pages/Market.tsx` remains the page entry and owns UI state plus query wiring.
- New pure presentation helpers under `packages/sdkwork-claw-market/src/pages/` will own filtering, category derivation, featured selection, and ranking.
- Existing services stay authoritative for skills, packs, instances, and installed skills.
- Detail routes (`/market/:id`, `/market/packs/:id`) remain unchanged.

This keeps the repository dependency flow intact:

- shell routes to market
- market consumes feature services and shared UI
- hosts remain thin

## Design Decisions

### Interaction Model

The homepage becomes a two-view surface:

- `discover`: default view focused on browsing and installing skills
- `installed`: a lighter management view for skills already installed on the active instance

This mirrors the reference image's "library / my library" model and removes the need to understand internal catalog types up front.

### Discovery Layout

The discovery view uses four stacked layers:

1. compact header with title, short subtitle, search, and create action
2. two-segment primary toggle for `discover` and `installed`
3. thin guidance copy plus horizontal category chips
4. content area with:
   - featured skill packs as curated shortcuts
   - spotlight official/recommended skills
   - the main skill library list

The main list should be the dominant content, not a hero banner.

### Visual Direction

The page should move from dark promotional gradients to a bright, editorial catalog aesthetic:

- warm off-white canvas
- white cards with fine borders
- stronger typography hierarchy
- restrained accent color
- light hover elevation
- horizontal list cards closer to the reference image

The result should feel premium through restraint rather than through oversized decoration.

### Filtering Strategy

Category filters should be derived from real skill data, but they should prefer the existing canonical order when categories match current data:

- All
- Productivity
- Development
- System
- AI Models
- Utilities

Unexpected categories from backend data should still appear after the preferred list.

### Skill Pack Treatment

Skill packs remain important, but they stop being a first-class top-tab.

- show only a small featured strip in the discovery view
- keep detail routing for deeper exploration
- keep install-pack modal behavior intact

This preserves capability while reducing choice overload.

### Installed View

The installed view should feel operational, not empty or punitive.

- reuse the same card rhythm as discovery
- show active-instance context
- keep uninstall action accessible
- provide a polished empty state when nothing is installed

## Error Handling

1. No instances available: keep the existing install modal warning state.
2. No active instance in installed view: show a clear empty-state explanation instead of broken controls.
3. No search results: show lightweight empty states tied to the current view.

## Testing

The redesign should add pure-function presentation tests before UI changes:

1. category derivation preserves preferred order and appends custom categories
2. discovery filtering respects keyword and category
3. featured pack selection prefers highest-value packs
4. installed view filtering stays independent from discovery view data

After that, package contract checks should be updated to reflect the new two-view model.
