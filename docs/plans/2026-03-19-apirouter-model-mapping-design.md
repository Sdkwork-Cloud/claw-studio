# API Router Model Mapping Design

## Context

`/api-router` already has two primary tabs:

- `Unified API Key`
- `Route Config`

The user wants a third primary tab named `Model Mapping` that behaves like an operational management surface rather than a placeholder list. The same request also extends `Unified API Key` so each key can associate with exactly one model mapping.

## Product Decisions

- Add `Model Mapping` as a first-class top-level tab inside the existing API Router page.
- A single model mapping record can contain multiple mapping rules.
- Each mapping rule is a directed relation from one source model to one target model.
- Each unified API key can associate with exactly one model mapping.
- Effective time is a start/end range, not a single deadline.

## Option Review

### Option A: Put model mapping inside `Route Config`

- Pros: close to providers and channels
- Cons: conflicts with the requested tab structure and makes unified-key association awkward

### Option B: Build model mapping as a separate feature package now

- Pros: strongest long-term separation
- Cons: too heavy for the current repository shape, where API Router already owns related pages, services, and mock flows in one feature package

### Option C: Extend the existing API Router feature package

- Pros: best fit for the current architecture, fastest to ship cleanly, easiest to reuse existing manager/table/dialog patterns
- Cons: requires careful internal organization to avoid bloating the package

## Decision

Use Option C.

## Data Model

Add shared types in `@sdkwork/claw-types`:

- `ModelMapping`
- `ModelMappingRule`
- `ModelMappingModelRef`
- `ModelMappingCreate`
- `ModelMappingUpdate`
- `ModelMappingStatus`

Suggested shapes:

- `ModelMapping`
  - `id`
  - `name`
  - `description`
  - `status`
  - `effectiveFrom`
  - `effectiveTo`
  - `createdAt`
  - `rules`
- `ModelMappingRule`
  - `id`
  - `source`
  - `target`
- `ModelMappingModelRef`
  - `channelId`
  - `channelName`
  - `modelId`
  - `modelName`

Extend `UnifiedApiKey` with:

- `modelMappingId?: string`

Store model references as snapshots instead of only ids. This keeps table/detail rendering stable even if provider names change later.

## Data Source Strategy

Do not create a second hard-coded model catalog.

Instead:

- derive selectable models from `ProxyProvider.models`
- group them by `channelId`
- de-duplicate by `channelId + modelId`
- surface them through a model-mapping service helper

This keeps `Route Config` and `Model Mapping` in sync automatically.

## Page Structure

`ApiRouter` gets a new page tab:

- `Unified API Key`
- `Route Config`
- `Model Mapping`

The new tab renders a `ModelMappingManager` that mirrors the existing management pattern:

- top toolbar
- search input
- action buttons
- data table
- create/edit/detail/association dialogs

## Model Mapping List UX

Toolbar actions:

- `New Model Mapping`
- `Refresh`
- search by name, description, channel, or model name

Table columns:

1. `Name`
2. `Description`
3. `Status`
4. `Effective Time`
5. `Created Time`
6. `Actions`

Row actions:

- `Edit`
- `Delete`
- `Disable` or `Enable`
- `View Details`

Polish rules:

- show rule count and a compact preview inside the name cell
- show effective range in a readable two-line format
- give empty states clear next actions
- keep the visual language aligned with the existing API Router cards and tables

## Create/Edit Dialog UX

The dialog has two sections:

### Section 1: Basic information

- name
- description
- effective start date
- effective end date

### Section 2: Mapping rules

Each rule row shows:

- source model
- target model
- remove action

There are two add-entry flows:

- `Add source model`
- `Add target model`

Both open a selector dialog with:

- left side: channel list
- right side: model list for the selected channel

Interaction rules:

- a rule is incomplete until both source and target are chosen
- changing target model should be supported inline
- deleting a rule should be immediate
- duplicate source-target pairs should be blocked
- duplicate source model mappings within the same record should be blocked so one source model maps to one target model per record

## Detail Dialog UX

The detail dialog should show:

- basic information
- effective range
- current status
- full mapping rule list

This dialog is read-only and optimized for inspection.

## Unified API Key Association UX

Extend `UnifiedApiKeyTable` with one more action:

- `Associate Mapping`

This opens a selector dialog that:

- lists available model mappings
- supports search
- shows current association
- allows clearing the association

Because one key can only associate with one mapping:

- use a single-select list
- save immediately when the user confirms

Also expose current association in the unified key table with a compact badge or secondary text in the name column so operators can see linkage without opening the dialog.

## Service Layer

Add a dedicated service module in `sdkwork-claw-apirouter/src/services`:

- `modelMappingService.ts`
- `modelMappingFormService.ts`

Responsibilities:

- listing and filtering mappings
- create/update/delete/status mutation calls
- model catalog derivation from providers
- form normalization and validation

Extend `unifiedApiKeyService.ts` with:

- `assignModelMapping(id, modelMappingId)`

## Mock Backend

Extend `studioMockService` with:

- model mapping seed data
- CRUD methods for mappings
- mapping status updates
- unified-key association update

The mock backend should also support model catalog derivation from current proxy providers so the selector dialogs reflect real route-config inventory.

## Validation Rules

- name is required
- effective start and end are required
- end must be on or after start
- at least one complete rule is required
- each rule must have both source and target
- source and target must not be identical on the same channel/model pair
- duplicate source model within one mapping is not allowed

## Testing Strategy

Add focused tests for:

- model mapping service surface
- model mapping form normalization
- mock backend CRUD and association behavior
- unified key association mutation

Prefer service tests over UI snapshot tests because the repository already leans service-first in this package.

## Execution Note

The user explicitly delegated product and implementation decisions and asked not to be interrupted, so this design is treated as approved and moves directly into implementation.
