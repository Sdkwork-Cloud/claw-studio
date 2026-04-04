# OpenClaw Mirror Design

Date: 2026-04-03
Status: In progress. Phase 1 private export/import, managed-runtime rebasing, runtime-diagnostic plus legacy fallback path rebasing, route-catalog restore, and post-restore verification are implemented; template and marketplace phases remain pending.
Scope: Claw Studio managed OpenClaw backup, restore, template sharing, and install-from-mirror

## 1. Problem

OpenClaw already has:

- a first-class local backup archive command
- a documented migration flow based on copying state + workspace
- clear state/workspace/auth/session storage conventions

OpenClaw does not yet provide a productized "mirror image" system for:

- one-click full restore into a fresh managed install
- selective export of agents, memory, skills, and config as a reusable template
- public marketplace sharing with secret-safe redaction
- install-time hydration of a new Claw Studio managed OpenClaw instance from a portable image

Claw Studio also has product-specific state that matters during restore/bootstrap:

- local proxy routes and provider routing catalog
- OpenClaw local-proxy projection rules
- instance metadata and workbench projections
- request logs, usage metrics, and optional message-record storage

The mirror feature must therefore sit above upstream backup semantics and add:

- stable manifesting
- portability rules
- secret policies
- install hydration
- marketplace metadata

## 2. Upstream Facts

These are the source facts the design must preserve.

### 2.1 State and config

- OpenClaw stores mutable runtime data under `OPENCLAW_STATE_DIR` (default `~/.openclaw`).
- `OPENCLAW_CONFIG_PATH` defaults to `OPENCLAW_STATE_DIR/openclaw.json`.
- The active workspace is separate from the state directory and is configured through `agents.defaults.workspace`.

### 2.2 Agent-specific state

- Auth profiles are per-agent:
  - `agents/<agentId>/agent/auth-profiles.json`
- Generated model registry is per-agent:
  - `agents/<agentId>/agent/models.json`
- Session state is per-agent:
  - `agents/<agentId>/sessions/sessions.json`
  - `agents/<agentId>/sessions/*.jsonl`

### 2.3 Workspace is memory

- Long-term memory and daily memory are workspace files:
  - `MEMORY.md`
  - `memory/YYYY-MM-DD.md`
- Prompt/bootstrap files also live in the workspace:
  - `AGENTS.md`
  - `SOUL.md`
  - `IDENTITY.md`
  - `USER.md`
  - `TOOLS.md`
  - `HEARTBEAT.md`
  - `BOOT.md`
  - `BOOTSTRAP.md`

### 2.4 Credentials and plugin state

- Credentials and provider/channel state live under the state directory:
  - `credentials/**`
  - `secrets.json`
  - `agents/<agentId>/agent/auth-profiles.json`
- Installed extensions live under:
  - `extensions/**`
- Shared skills may live under:
  - `skills/**` inside state

### 2.5 Upstream backup

- `openclaw backup create` creates a local `.tar.gz` archive
- it includes a root `manifest.json`
- it backs up:
  - state dir
  - active config path
  - oauth/credentials dir
  - discovered workspace dirs unless disabled
- `openclaw backup verify` validates:
  - exactly one root manifest
  - no traversal-style archive paths
  - all manifest-declared payloads exist in the tarball
- upstream restore is not a first-class CLI command
- upstream migration is documented as:
  - stop gateway
  - copy state dir + workspace
  - run doctor
  - restart gateway

## 3. Local Claw Studio Facts

### 3.1 Managed runtime boundary

Claw Studio already manages a bundled OpenClaw runtime with:

- `home_dir`
- `state_dir`
- `workspace_dir`
- `config_path`
- `gateway_port`
- `gateway_auth_token`

This is the right place to attach mirror export/import operations.

### 3.2 Workbench projection already surfaces mirror-relevant data

The current workbench snapshot already projects:

- providers
- channels
- cron jobs
- agents
- skills
- files
- memory
- tools

This gives Claw Studio a ready-made summary layer for mirror previews and publish forms.

### 3.3 Existing install/bootstrap seam

The current install/bootstrap flow already knows how to:

- locate `openclaw.json`
- sync a local external OpenClaw instance into Studio
- apply provider/channel config
- project local proxy config into OpenClaw
- initialize skills through the gateway

This is the correct seam for "install from mirror".

## 4. Mirror Goals

The mirror feature must support four product scenarios.

### 4.1 Full private backup

Exact recovery of a managed OpenClaw instance for the same user or a new machine.

Must preserve:

- config
- workspace
- memory
- agents
- sessions
- auth
- channel credentials
- plugin state
- optional Studio telemetry

### 4.2 Portable private migration

Restore on a different host with managed path rebasing and post-import repair.

Must additionally handle:

- path rebasing
- version skew
- plugin reinstall/refresh
- gateway doctor/repair

### 4.3 Shareable template

Publish a reusable OpenClaw setup without leaking secrets or private transcripts.

Must preserve:

- agent definitions
- workspace prompts
- curated memory if explicitly included
- skills and extension requirements
- provider route topology and model preferences

Must exclude by default:

- API keys
- OAuth tokens
- channel credentials
- raw session transcripts
- request logs
- message logs
- local secrets payloads

### 4.4 Install from mirror

Bootstrap a new Claw Studio managed OpenClaw instance from a mirror as part of install flow.

## 5. Options Considered

### Option A: Reuse upstream backup tarball only

Description:

- call `openclaw backup create`
- store the resulting archive
- restore by unpacking it and copying files back

Pros:

- minimal implementation
- closest to upstream behavior

Cons:

- no public-sharing story
- no redaction model
- no market metadata
- no install-time configuration guidance
- poor cross-platform rebasing
- no separation between private backup and reusable template

Decision:

- not sufficient

### Option B: Claw Studio custom archive only

Description:

- ignore upstream backup format
- build a new custom bundle from raw filesystem discovery

Pros:

- full control

Cons:

- duplicates upstream logic
- high drift risk as OpenClaw storage evolves
- larger maintenance burden

Decision:

- rejected

### Option C: Hybrid layered mirror

Description:

- preserve upstream backup semantics as a base component
- wrap them in a higher-level mirror manifest and component model
- add redacted projection, install recipe, and market metadata

Pros:

- aligned with upstream storage reality
- supports both private restore and public templates
- keeps future restore logic compatible with upstream backup changes
- gives Claw Studio a stable publish/import layer

Cons:

- more moving parts than a raw tarball

Decision:

- recommended

## 6. Recommended Design

## 6.1 Mirror classes

Use one mirror format with three export modes.

### `full-private`

Purpose:

- disaster recovery
- same-user migration

Includes by default:

- full state
- config
- workspaces
- sessions
- auth
- credentials
- plugins
- optional Studio logs and request history

Publishability:

- local/private only

### `portable-private`

Purpose:

- move to another machine or another managed instance

Includes:

- same as full-private

Behavior:

- restore requires path rebasing and repair actions

Publishability:

- private only

### `template-share`

Purpose:

- publish to market
- bootstrap new installs

Includes by default:

- redacted config projection
- agent definitions
- workspace prompt files
- selected memory files
- skill manifests and installation references
- extension/plugin requirements
- provider routes and model selection policy

Excludes by default:

- auth profiles
- channel credentials
- sessions
- transcripts
- secrets payloads
- logs
- Studio telemetry

Publishability:

- public, unlisted, or team-private

## 6.2 Container format

Top-level file extension:

- `.ocmirror`

Top-level container:

- ZIP

Reason:

- easy metadata preview without full extract
- good fit for marketplace thumbnails and small manifest reads
- heavy payloads can still be stored as tar-based inner components

Payload strategy:

- metadata files at the ZIP root
- content-addressed components under `components/`

Layout:

```text
mirror.json
projection.json
README.md
preview/cover.png
preview/screenshots/*
components/<component-id>.tar.gz
components/<component-id>.json
```

## 6.3 Mirror manifest

`mirror.json` is the canonical control document.

Required fields:

- `schemaVersion`
- `mirrorId`
- `mode`
- `createdAt`
- `createdBy`
- `title`
- `summary`
- `source`
- `compatibility`
- `exportPolicy`
- `installRecipe`
- `components`
- `requirements`
- `verification`
- `market`

### Source section

Must record:

- OpenClaw version
- Claw Studio version
- platform
- architecture
- source runtime kind
- source state layout assumptions

### Compatibility section

Must record:

- minimum supported OpenClaw version
- tested OpenClaw version
- whether `openclaw doctor --fix` is required after import
- platform portability class:
  - `same-platform-only`
  - `cross-platform-config-only`
  - `cross-platform-template`

### Export policy section

Must record:

- include/exclude flags for:
  - sessions
  - transcripts
  - auth
  - credentials
  - logs
  - request history
  - message records
  - memory
  - workspaces
  - skills
  - plugins
- whether payload is encrypted
- whether publish-to-market is allowed

### Install recipe section

Must record the target behaviors, not source absolute paths.

Examples:

- managed runtime required
- rebuild local proxy projection after import
- run doctor after hydrate
- install missing extensions before start
- regenerate `models.json`

## 6.4 Components

The initial component taxonomy should be:

### `openclaw-backup`

Purpose:

- private restore base layer

Format:

- upstream-style `.tar.gz`

Contains:

- full upstream backup payload and manifest

Used in:

- `full-private`
- `portable-private`

### `config-projection`

Purpose:

- searchable preview
- diff
- publish summary
- install wizard preflight

Format:

- JSON

Contains:

- redacted config summary
- agents summary
- providers summary
- channels summary
- skills and plugin requirements

Used in:

- all mirror modes

### `workspace-archive`

Purpose:

- import prompt files, memory, and workspace-local skills

Format:

- `.tar.gz`

Contains:

- selected workspace tree(s)

Used in:

- `template-share`
- optionally alongside private restore for preview/diff

### `studio-routing`

Purpose:

- restore local proxy route catalog
- re-project OpenClaw provider config through Studio local proxy

Format:

- JSON

Contains:

- provider routing records
- model selections
- route order and health metadata

Used in:

- all mirror modes exported from Claw Studio

### `extensions-lock`

Purpose:

- deterministic plugin reinstall

Format:

- JSON

Contains:

- plugin ids
- versions
- install sources
- config snippets

Used in:

- all modes

### Optional components

- `request-log-archive`
- `message-record-archive`
- `usage-stats`
- `screenshots`
- `notes`

These are Studio extensions, not upstream OpenClaw primitives.

## 7. Path Model

Absolute source paths from upstream backup manifests must never be used as restore targets.

The mirror system must normalize everything to logical anchors:

- `stateRoot`
- `configFile`
- `workspace.main`
- `workspace.<agentId>`
- `agentDir.<agentId>`
- `sharedSkills`
- `extensionsRoot`
- `credentialsRoot`
- `sessions.<agentId>`

During export:

- map source absolute paths to anchors
- keep raw absolute paths only inside private diagnostic sections if needed

During import:

- resolve anchors against the target managed instance
- rewrite known config path fields:
  - `agents.defaults.workspace`
  - `agents.list[].workspace`
  - `agents.list[].agentDir`
  - plugin load paths when they point inside mirrored roots
  - skill extra dirs when they point inside mirrored roots

Do not attempt broad text replacement inside arbitrary Markdown files.

## 8. Secret Model

## 8.1 Secret classes

Secrets are divided into:

- OpenClaw config secrets
- auth profiles
- channel credentials
- `secrets.json`
- Studio route credentials and upstream provider tokens

## 8.2 Publish rules

### Public market

Allowed:

- template-share mirrors only

Blocked:

- any mirror containing:
  - auth profiles
  - channel credentials
  - raw sessions
  - request logs
  - unredacted `secrets.json`

### Private export

Allowed:

- all mirror modes

Recommended:

- encrypted by default

## 8.3 Redaction implementation

For config redaction, reuse upstream-style config sensitivity rules instead of inventing a new secret detector.

Claw Studio should adapt the upstream `redact-snapshot` logic to produce:

- a publish-safe projection
- a restore-safe write-back model for redacted fields

## 8.4 Encryption

Private mirrors should support:

- per-mirror data encryption key
- AES-GCM payload encryption
- key wrapped by:
  - OS keyring for local-only backups
  - optional passphrase for portable sharing

Public template mirrors are not encrypted; they are sanitized instead.

## 9. Restore Semantics

## 9.1 Full/private restore

Target:

- new managed instance
- or explicit destructive replace of an existing managed instance after safety snapshot

Flow:

1. validate mirror manifest and component digests
2. if the archive carries `managed-assets.json`, validate every inventoried managed skill/plugin payload in staging before any restore step
3. verify mode is restorable into the requested target
4. stop the managed OpenClaw gateway
5. create a safety snapshot of the current managed instance
6. hydrate state/workspace/components into staging
7. rebase config paths to target managed roots
8. restore Studio route catalog
9. regenerate local proxy projection into `openclaw.json`
10. install/repair plugins and skills
11. run `openclaw doctor --fix`
12. refresh `models.json`
13. restart gateway
14. run post-restore verification

## 9.2 Template import

Target:

- empty managed install
- or merge into a fresh install wizard flow

Flow:

1. validate mirror
2. create missing managed workspace/agent dirs
3. apply config projection merge
4. restore agent definitions and workspace files
5. restore route catalog and re-project local proxy config
6. install required skills/plugins
7. create unresolved-secret checklist
8. run doctor
9. start gateway
10. open verification screen

## 9.3 No generic merge for full sessions/auth

Do not support deep merge of private sessions and auth into an arbitrary existing instance in v1.

Reason:

- high risk of inconsistent session references
- auth precedence drift
- plugin/channel state conflicts

Use replace semantics for private restore.

## 10. Install-From-Mirror Flow

The existing install wizard should gain a new step:

- `Import Mirror`

Recommended order:

1. dependencies
2. install
3. import mirror
4. configure
5. initialize
6. success

Behavior:

- if a template mirror is chosen, the configure step is prefilled from the mirror
- if a full/private mirror is chosen, configure step becomes a verification/review step

Important rule:

Claw Studio should not trust stale archived provider URLs and API keys as final OpenClaw runtime config.
Instead:

1. import the Studio provider route catalog from the mirror
2. rebuild the OpenClaw local-proxy projection from those routes
3. write the managed OpenClaw projection into `openclaw.json`

This keeps fresh installs aligned with the Studio local proxy system.

## 11. Marketplace Model

## 11.1 Market object type

Add a new market artifact type:

- `mirror-template`

This is not the same as a skill pack.

It represents:

- a reusable OpenClaw blueprint
- optional screenshots and documentation
- required plugins, routes, and secrets

## 11.2 Publish payload

Market publish should upload:

- mirror manifest
- redacted projection
- approved components
- cover and screenshots
- metadata:
  - title
  - summary
  - tags
  - category
  - author
  - supported platforms
  - required providers
  - required plugins
  - install complexity

## 11.3 Import UX

Import screen should show:

- what will be created
- what secrets are still required
- what plugins and skills will be installed
- whether sessions/memory are included
- portability class
- compatibility status

## 11.4 Safety gate

Before public publish:

- run secret scan
- run path privacy scan
- run transcript/session inclusion scan
- block publish if private components remain

## 12. Studio-Specific Augmentation

Claw Studio should version its own augmentation namespace inside the mirror:

- `studio.routing`
- `studio.requestLogs`
- `studio.messageRecords`
- `studio.instanceMetadata`

This must stay separate from the upstream OpenClaw namespace:

- `openclaw.config`
- `openclaw.state`
- `openclaw.workspace`
- `openclaw.sessions`
- `openclaw.auth`

That split keeps the format understandable and lets us export a plain OpenClaw-compatible backup later if needed.

## 13. Repository Mapping

The implementation should follow current repo layering.

### Native desktop

Add native archive and restore services under:

- `packages/sdkwork-claw-desktop/src-tauri/src/framework/services/`

Suggested modules:

- `openclaw_mirror.rs`
- `openclaw_mirror_export.rs`
- `openclaw_mirror_import.rs`
- `openclaw_mirror_manifest.rs`

Responsibilities:

- filesystem export/import
- ZIP read/write
- inner tar handling
- digest verification
- encryption
- stop/start gateway
- run doctor / runtime repair

### Core domain

Add mirror domain services under:

- `packages/sdkwork-claw-core/src/services/`

Suggested modules:

- `openClawMirrorService.ts`
- `openClawMirrorPolicyService.ts`
- `openClawMirrorPreviewService.ts`
- `openClawMirrorImportPlanService.ts`

Responsibilities:

- plan generation
- policy validation
- publish-safe projection
- import diff and conflict reporting

### Install flow

Extend:

- `packages/sdkwork-claw-install/src/services/openClawBootstrapService.ts`
- `packages/sdkwork-claw-install/src/services/installBootstrapService.ts`

Responsibilities:

- install-from-mirror orchestration
- post-install hydration
- unresolved-secret workflow

### Market flow

Extend:

- `packages/sdkwork-claw-market/`
- `packages/sdkwork-claw-core/src/services/clawHubService.ts`

Responsibilities:

- mirror template browse/import/publish
- compatibility and requirements display

### Types

Add mirror contracts to:

- `packages/sdkwork-claw-types/`

## 14. Phased Delivery

## Phase 1: Private mirror core

Deliver:

- export `full-private`
- import `full-private`
- safety snapshot
- post-import doctor
- local manifest preview

Current implementation status on 2026-04-03:

- shipped:
  - export `full-private`
  - import `full-private`
  - archive-entry preflight validation for traversal-style or absolute `.ocmirror` ZIP paths before extraction
  - archive-entry preflight rejection for duplicate normalized ZIP entry paths before extraction
  - archive-entry preflight rejection for ZIP entries outside the allowed mirror root layout (`manifest.json`, optional root metadata files, and `components/**`) before extraction
  - manifest-carried SHA-256 digests for exported mirror components
  - import-time SHA-256 digest validation for mirrored component payloads before restore when digest metadata is present
  - import-time component `byteSize` and `fileCount` validation for mirrored component payloads before restore when manifest statistics are present
  - manifest-carried SHA-256 digests for private root metadata files such as `runtime.json` and `managed-assets.json`
  - import-time metadata file size and SHA-256 validation for private root metadata files before restore when manifest metadata records are present
  - import-time consistency validation between `manifest.runtime` and `runtime.json` for mirrored runtime identity summary fields when runtime diagnostics are present
  - manifest validation rejection for unsupported component ids or mismatched component `id/kind/relativePath` descriptor triples before restore
  - import-time rejection for unclaimed files under `components/**` that are not owned by any declared component payload before restore
  - manifest validation rejection for unsupported metadata file ids and incomplete standard metadata file sets before restore
  - manifest validation rejection for duplicate component ids before restore
  - manifest validation rejection for duplicate component payload relative paths before restore
  - manifest validation rejection for traversal-style or otherwise unsafe component and metadata `relativePath` values before restore
  - safety snapshot before restore
  - managed runtime restore for `components/config/openclaw.json`
  - managed runtime restore for `components/state/**`
  - managed runtime restore for `components/workspace/**`
  - private archive runtime-path diagnostics via `runtime.json`
  - private archive managed asset inventory via `managed-assets.json` for concrete managed skill/plugin entries restored by the mirror
  - private import prefers exact `runtime.json` diagnostics, and falls back to legacy managed-layout heuristics for older archives that predate runtime diagnostics
  - private import prefers exact `managed-assets.json` verification for concrete managed skill/plugin assets, and falls back to managed-root heuristics for older archives that predate asset inventory
  - private import fail-fast validation for `managed-assets.json` during staging so corrupted archives are rejected before restore, while older archives without asset inventory continue to rely on post-restore managed-root heuristics
  - private import rejects `managed-assets.json` entries whose `relativePath` escapes the canonical managed roots (`skills/**`, `extensions/**`, `.openclaw/extensions/**`) before restore
  - managed runtime config rebasing after import for gateway mode/bind/port/auth and agent workspace or agentDir roots
  - managed `skills.load.extraDirs` rebasing after import when entries point back into the mirrored managed roots
  - managed `plugins.load.paths` rebasing after import when entries point back into the mirrored managed roots
  - managed `plugins.installs.*.{sourcePath,installPath}` rebasing after import when entries point back into the mirrored managed roots
  - proactive repair of missing managed local plugin install roots when the restored mirror still contains a valid managed `sourcePath`
  - Studio route catalog export for `components/studio-routing/provider-center.json`
  - Studio route catalog restore during import
  - local proxy restart and managed OpenClaw provider reprojection after import
  - local manifest preview for `.ocmirror`
  - post-import `openclaw doctor --fix --non-interactive --yes` for automation-safe managed repair
  - post-restore verification result with deterministic checks for:
    - managed config
    - managed state
    - managed workspace
    - managed skill filesystem assets owned by the mirror
    - managed plugin filesystem assets owned by the mirror
    - Provider Center catalog
    - local proxy health/projection
    - managed OpenClaw provider projection
    - requested gateway state
- pending:
  - broader plugin/skill reinstall or update flows beyond local managed source-path repair

No market support yet.

## Phase 2: Template mirror

Deliver:

- `template-share` export
- redacted config projection
- workspace and agent import
- route catalog restore
- install-from-mirror in guided install

## Phase 3: Marketplace

Deliver:

- publish/import `mirror-template`
- screenshots and metadata
- secret-safe publish validation
- compatibility badges and requirements

## Phase 4: Studio telemetry augmentation

Deliver:

- optional request-log archive
- optional message-record archive
- optional usage snapshots

Private mirrors only by default.

## 15. Non-Goals for v1

- merging private sessions from one live instance into another live instance
- public sharing of auth-bearing backups
- arbitrary path rewriting inside user-authored Markdown or arbitrary plugin payloads
- restoring platform-specific sandboxes across different operating systems
- guaranteeing cross-platform compatibility for full/private mirrors

## 16. Final Recommendation

Build mirror as a hybrid, layered format:

- upstream-aligned backup semantics at the payload layer
- Claw Studio manifest, redaction, and install recipe at the control layer
- strict split between private restore mirrors and public template mirrors

Most important product decision:

- private backup and public sharing are not the same artifact policy
- use one format, but different mirror modes

Most important technical decision:

- on import, restore the Studio route catalog first, then regenerate OpenClaw provider projection through the local proxy system instead of trusting stale archived provider credentials in `openclaw.json`

This keeps the mirror feature aligned with:

- upstream OpenClaw storage and backup conventions
- current Claw Studio managed runtime architecture
- current local proxy and bootstrap flow
