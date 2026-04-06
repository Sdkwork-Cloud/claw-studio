# Community Online Services Extension Design

## Context

The current classifieds refactor already turns `Community` into a recruitment-first entry point with retained `news`.
What is still missing is a deeper `services` lane that reflects the kinds of work that can be scoped, sold, and delivered fully online.
The user explicitly asked to add legal services and to broaden coverage to other online-deliverable services without waiting for more questions.

## Product Goal

Keep `Community` recruitment-first, but expand the `services` category into a structured online-services matrix led by legal services and followed by other services that can usually be completed remotely end to end.

The extension should satisfy four goals:

1. `services` stops feeling generic and becomes a credible commercial catalog.
2. Legal services become a first-class service line, not just a tag hidden in one card.
3. The publish flow can express remote delivery specifics instead of only location and budget.
4. The detail page and landing page surface enough metadata to make remote services understandable at a glance.

## Online-Deliverable Service Scope

The best fit for this release is the set of services that are commonly consultative, document-based, digital, or automation-driven:

- Legal services
- Tax and finance support
- Brand and design work
- Software development and automation
- Marketing and content production
- Translation and localization
- Remote operations support
- Training and consulting

This keeps the scope broad enough to feel comprehensive while staying realistic for a seeded marketplace.

## Options Considered

### Option A: Add legal services as one more seeded post

Pros:
- Minimal code change
- Fastest path

Cons:
- Does not solve the broader “online services” requirement
- Leaves `services` structurally vague
- Easy for legal services to disappear in the feed

### Option B: Expand `services` into an online service matrix

Pros:
- Matches the user request directly
- Preserves the current top-level IA
- Lets the app show legal services plus a fuller remote-service catalog
- Gives OpenClaw clearer service-side assistance hooks

Cons:
- Requires service model, page, and locale updates
- Adds a little more structured data to seeded posts and composer

### Option C: Create multiple new top-level categories for each service domain

Pros:
- Maximum discoverability at top level
- Feels more like a huge horizontal marketplace

Cons:
- Weakens the recruitment-first strategy
- Makes the first screen denser and noisier
- Introduces more navigation complexity than this release needs

## Decision

Choose Option B.

Keep the existing top-level categories intact and deepen the `services` lane into an online-services matrix.
This preserves the recruitment-first home while making `services` commercially credible and much more useful.

## Data Model Changes

Extend `CommunityPost` and create/update DTOs with service-specific fields:

- `serviceLine`
- `deliveryMode`
- `turnaround`

Recommended service-line enum:

- `legal`
- `tax`
- `design`
- `development`
- `marketing`
- `translation`
- `operations`
- `training`

Recommended delivery modes:

- `online`
- `hybrid`
- `onsite`

These additions are enough to model legal consultation, remote tax filings, design packages, localization work, automation delivery, and similar services without overbuilding a full marketplace schema.

## Landing Page Changes

The `Community` landing page should keep its current recruitment-first framing and add service depth in two ways:

1. Add an online-service matrix block that appears when the `services` tab is active.
2. Add a right-rail services section that highlights remote-service inventory even outside the `services` view.

The service matrix should call out the major online service lines, with legal services in the first slot.
Each item should feel like a sellable category, not a vague label.

## Publish Flow Changes

When the user selects the `services` category in `NewPost`, the composer should expose:

- service line
- delivery mode
- turnaround expectation

This keeps the generic structure for other listing types while giving service publishers a better remote-delivery shape.

## Detail Page Changes

Service detail pages should show the new service metadata alongside existing listing fields:

- service line
- delivery mode
- turnaround

This makes remote services legible without requiring the user to read the full description first.

## Seed Content Strategy

The seeded data should stop at a representative but broad commercial set.
Recommended seeded service entries:

- legal contract review and compliance support
- remote bookkeeping and tax filing
- landing page or AI workflow development
- brand system and presentation design
- translation and localization support
- remote operations or customer-success support

This gives the service feed enough breadth to feel intentional and supports the “comprehensive online services” requirement.

## OpenClaw Positioning

OpenClaw should not be framed only as a hiring assistant.
For services it should also be able to:

- structure service briefs
- polish delivery scope
- prepare quote variants
- organize client follow-up

That positioning belongs in service cards, publishing guidance, and detail-page assistant CTAs.

## Testing Strategy

Add or extend tests so they verify:

1. service entries can carry `serviceLine`, `deliveryMode`, and `turnaround`
2. legal services exist in the seeded service inventory
3. service search can discover legal/online services
4. the landing page exposes a service-matrix surface
5. the publish page exposes service-specific fields
6. the detail page renders service metadata
7. locale files cover the new keys in both `en` and `zh`

## Success Criteria

This extension is complete when:

- legal services are visibly present in the product
- `services` feels like a structured online-service marketplace lane
- remote-delivery metadata exists in data, composer, list, and detail views
- recruitment remains the primary business focus
- `news` remains intact
