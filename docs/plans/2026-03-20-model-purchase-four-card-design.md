# Model Purchase Four-Card Design

## Goal

Turn the model purchase page into a clearer decision surface with one fixed free-membership card and three paid package cards, while keeping the billing-cycle switch focused on the paid options only.

## Problems In The Current Flow

- The page now prioritizes paid packages well, but it no longer gives users an obvious “start free” anchor.
- Users who are not ready to buy immediately need a first card that explains what they can get without paying.
- The billing switch must stay close to the paid-package comparison and must not imply that the free tier changes by month, quarter, or year.

## Approved Direction

### Layout

- Keep the left vendor sidebar.
- Keep a compact header on the right with vendor name, short vendor description, and the billing-cycle switch.
- Render four cards in the package area:
  - Card 1: fixed `Free Membership`
  - Card 2-4: paid packages for the selected billing cycle

### Free Membership Card

- The free card is always first.
- It does not show price or purchase CTA.
- It explains baseline member rights and gives users a low-friction starting point.
- It stays visually lighter than the paid recommendation card so it does not steal the purchase focus.

### Paid Cards

- The three paid cards continue to change when the user switches between monthly, quarterly, and yearly.
- Each paid card keeps the strongest decision order:
  - package name
  - price
  - purchase button
  - core package facts
  - benefits

### Billing-Cycle Logic

- The billing-cycle switch only affects the three paid cards.
- The free card never changes with cycle selection.
- This avoids the misleading impression that the free tier has monthly, quarterly, or yearly variants.

## Visual Rules

- Desktop: four cards in one row when space allows.
- Medium widths: two-by-two layout.
- Small widths: stacked layout.
- The paid “recommended” card keeps the strongest emphasis.
- The free card uses a lighter treatment and a “free” badge instead of a purchase CTA.

## Data And Component Changes

- Keep vendor pricing data in the catalog service.
- Add free-membership copy in i18n.
- Build a display-card list at the package-grid layer:
  - one free card
  - three paid cards from the selected cycle
- Render card variants by type:
  - `free`
  - `paid`

## Validation

- Remove `01.AI Yi` and `Baichuan` from the catalog.
- Keep `Zhipu` in the China lineup.
- Verify the package grid now renders a four-card structure.
- Verify the free card has no purchase button.
- Verify the paid cards still keep CTA directly below price.
