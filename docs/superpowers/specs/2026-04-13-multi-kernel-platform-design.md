# Multi-Kernel Platform Design

## Status

Approved design baseline for implementation planning.

## Incremental Convergence Notes

- The shared instance-detail route now resolves kernel detail modules through a dedicated registry contract instead of assuming the OpenClaw page for every runtime.
- OpenClaw detail remains preserved as the existing workbench implementation behind module selection rather than through a visual redesign.
- Hermes now has a dedicated detail module that surfaces external-runtime policy, connectivity endpoints, capabilities, data access, and artifact evidence through the same routed entry.
- Unsupported kernels now render a standard fallback instead of borrowing the OpenClaw detail experience.
- Kernel definitions and kernel package profiles are now directory-driven JSON catalogs with config-owned ordering, removing hardcoded file-name lists from release automation while preserving stable OpenClaw-first packaging defaults.
- The local release wrapper now resolves and forwards `packageProfileId` through desktop packaging and smoke entrypoints, so `openclaw-only`, `hermes-only`, and `dual-kernel` package selection is available through the standard local release surface instead of only the low-level build scripts.
- Release plan generation and GitHub release workflows now carry an explicit `packageProfileId` input and output, and OpenClaw-specific preparation runs only when the selected package profile actually includes OpenClaw.
- Desktop release manifests, installer smoke reports, and finalized release metadata now use the generic `kernelInstallContracts` container instead of the OpenClaw-biased `openClawInstallerContract` field, so future kernels can add install-contract metadata without another schema rename.
- Desktop installer smoke metadata now groups install-readiness evidence under `kernelInstallReadiness.<kernelId>` instead of a top-level `installReadyLayout` field, so future kernels can add their own readiness proofs without reshaping the public desktop smoke contract again.
- Built-in kernel instance `version` semantics are now aligned to the active runtime selection or active runtime provenance first; staged newer installs and bundled payload metadata are fallback evidence only and must not overwrite the instance record version before activation.

## Goal

Turn Claw Studio into a standard multi-kernel platform that can host OpenClaw, Hermes Agent, and future kernels without reworking the desktop host, instance model, packaging model, or instance detail UI architecture for each new kernel.

## Hard Constraints

- No temporary compatibility layer. The platform can hard-cut to the new standard because the current system is not live for external users.
- Do not redesign the current OpenClaw instance detail page. Preserve its current page structure, sections, and interaction model.
- Add Hermes-specific instance detail support without forcing OpenClaw into a rewritten UI.
- Node.js must never be bundled with the desktop application.
- Python must never be bundled with the desktop application.
- `uv` must never be bundled with the desktop application.
- Hermes must be integrated from the official `nousresearch/hermes-agent` codebase and official operating constraints.
- Windows support for Hermes is limited to WSL2-backed or remote Linux operation. Native Windows local Hermes execution is out of scope because official Hermes documentation does not support it.
- The platform must support multiple kernels and multiple concurrent kernel instances.
- The platform must stay high-cohesion and low-coupling. Avoid speculative abstractions and avoid OpenClaw-specific behavior leaking into shared contracts.

## External Source Facts

- OpenClaw latest stable target for this design: `v2026.4.11`, published on 2026-04-12.
- Hermes official requirements currently state:
  - Python 3.11+
  - optional Node.js 18+ for some capabilities
  - Linux, macOS, and WSL2 support
  - no native Windows local support
- Sources:
  - `https://github.com/openclaw/openclaw/releases`
  - `https://github.com/nousresearch/hermes-agent`
  - `https://hermes-agent.nousresearch.com/docs/getting-started/quickstart/`
  - `https://hermes-agent.nousresearch.com/docs/getting-started/installation/`
  - `https://hermes-agent.nousresearch.com/docs/developer-guide/architecture/`

## Problem Statement

The current desktop architecture has strong OpenClaw-specific assumptions:

- runtime state is modeled around OpenClaw
- startup evidence is OpenClaw-oriented
- bundled runtime preparation assumes bundled Node.js
- detail UI assumes an OpenClaw workbench model
- authority state is named and shaped around a single kernel

Those assumptions make future kernel additions expensive and risky. Adding Hermes directly on top of the current structure would create long-term debt by duplicating lifecycle logic, projection logic, packaging logic, and instance detail logic.

## Design Outcome

The target system is a minimal but complete Kernel Platform with these properties:

- the desktop host manages kernels through one standard authority model
- each kernel integrates through a focused adapter
- external language runtimes are treated as platform prerequisites, not bundled assets
- packaging is profile-driven and can include one or many kernels
- instance detail remains a single routed page with kernel-specific modules
- OpenClaw keeps its current detail experience intact
- Hermes gets its own detail module and lifecycle model
- future kernels plug in through the same contracts

## Core Principles

### 1. Platform Over Runtime

Claw Studio is a kernel platform, not an OpenClaw shell.

### 2. Adapter Over Special Case

Every kernel integrates through a standard adapter. No new kernel may patch desktop core logic with runtime-specific branches outside the adapter boundary.

### 3. Projection Over Guessing

Frontend and feature packages only consume standardized kernel projections. They do not derive lifecycle facts by recombining raw fields.

### 4. External Runtime Over Bundled Language

The application governs kernels, not language distributions. Node.js, Python, and `uv` are external requirements.

### 5. Instance Over Singleton

The unit of runtime execution is a `KernelInstance`, not a single global runtime.

### 6. Profile Over Hardcode

Bundling and enablement are controlled through explicit package profiles.

### 7. Doctor Before Start

A kernel cannot start until its external requirements and installation model pass doctor checks.

### 8. Evidence Before Success

An activation or upgrade only counts as successful when structured startup and health evidence is recorded.

## Standard Object Model

The platform standardizes on seven objects.

### KernelDefinition

Describes a kernel type.

Required fields:

- `kernelId`
- `displayName`
- `vendor`
- `launcherKind`
- `platformSupport`
- `runtimeRequirements`
- `installStrategy`
- `managementTransport`
- `capabilityMatrix`
- `sourceMetadata`

### KernelInstall

Describes one installed version or source realization of a kernel.

Required fields:

- `kernelId`
- `installKey`
- `versionLabel`
- `sourceKind`
- `sourceRef`
- `installRoot`
- `managedConfigRoot`
- `createdAt`
- `status`
- `health`

Rules:

- `installRoot` and `managedConfigRoot` are authority-owned location references and may resolve to local paths, WSL-backed paths, or remote-managed locations depending on deployment mode

### KernelInstance

Describes one running or runnable instance.

Required fields:

- `kernelId`
- `instanceId`
- `instanceProfileId`
- `installKey`
- `workspaceRoot`
- `stateRoot`
- `configPath`
- `lifecycle`
- `activationStage`
- `health`
- `endpoint`
- `capabilities`

Rules:

- `instanceProfileId` identifies the instance-scoped launch or configuration profile applied to that instance
- `instanceProfileId` must not reuse package-profile identifiers such as `openclaw-only`, `hermes-only`, or `dual-kernel`
- `workspaceRoot`, `stateRoot`, and `configPath` are authority-owned location references and may resolve to local paths, WSL-backed paths, or remote-managed locations depending on deployment mode

### KernelDoctorReport

Describes whether a machine can host a kernel and why.

Required fields:

- `kernelId`
- `status`
- `checks`
- `missingRequirements`
- `degradedCapabilities`
- `recommendedActions`

### KernelProjection

Standardized frontend-safe summary of a kernel and its instances.

Required fields:

- `kernel`
- `installs`
- `instances`
- `defaultInstanceId`
- `doctor`
- `capabilitySummary`
- `actions`

Rules:

- `defaultInstanceId` is a required field but may be `null` when the kernel currently has no eligible default instance
- `defaultInstanceId` represents only the kernel-level fallback instance for that projection and must not encode capability-specific routing preferences
- a valid `KernelProjection` may contain zero `instances` while still surfacing install state, doctor state, and kernel actions for an enabled kernel

### KernelPackageProfile

Defines what a desktop package includes.

Required fields:

- `profileId`
- `displayName`
- `includedKernelIds`
- `defaultEnabledKernelIds`
- `bundledAssets`
- `doctorRules`

Rules:

- `defaultEnabledKernelIds` must be a subset of `includedKernelIds`
- `includedKernelIds` defines which kernels ship in the package, while `defaultEnabledKernelIds` defines first-run enablement before doctor and platform gating are applied
- `bundledAssets` may include pinned kernel install inputs and desktop support assets, but must never include bundled Node.js, Python, or `uv` runtimes

### Release Profile vs Kernel Package Profile Boundary

Release packaging orchestration and kernel inclusion policy are separate concerns.

Rules:

- `KernelPackageProfile.profileId` identifies kernel inclusion policy such as `openclaw-only`, `hermes-only`, or `dual-kernel`
- existing release automation may continue to use a release-profile identifier for build matrix selection, artifact naming, and distribution policy
- release-profile identity and kernel-package-profile identity must not be treated as the same field even if one release currently ships exactly one kernel package profile
- whenever both concepts appear in the same manifest, API, or script boundary, they must use explicit names such as `releaseProfileId` and `packageProfileId`
- kernel-platform machine state, installer prerequisites, first-run enablement, and capability routing depend on `packageProfileId`, not on release automation profile identifiers
- desktop build and release script entrypoints must resolve `packageProfileId` explicitly for every packaged artifact
- no build may infer `packageProfileId` from `releaseProfileId` alone or from legacy bundled-component catalogs

### KernelDetailModule

Defines how a kernel renders detail content inside the shared instance detail page.

Required fields:

- `kernelId`
- `chrome`
- `supports(detail)`
- `buildNavigation(detail)`
- `renderContent(context)`

## Minimal Shared Contracts

Each kernel adapter must implement exactly eight top-level operations.

- `doctor`
- `install`
- `upgrade`
- `activate`
- `start_instance`
- `stop_instance`
- `probe_instance`
- `project`

Management operations such as tool invocation, config reads, and config writes belong under the kernel's `managementTransport` boundary. They are not promoted into separate top-level lifecycle APIs.

This keeps the shared contract small and avoids adapter sprawl.

## Kernel Identity And Transport Standard

Future kernels must not require global shared-type rewrites.

Rules:

- `kernelId` is an opaque platform string, not a closed shared enum
- shared frontend and backend contracts must not hardcode a global union of every concrete kernel id
- transport identifiers are adapter-owned strings namespaced by the owning kernel
- adding a new kernel must not require editing a shared global transport union to keep the platform compiling
- current closed unions such as `StudioRuntimeKind` and `StudioInstanceTransportKind` are legacy-shaped and must be replaced by extensible shared types or catalog-backed lookups during the hard cut

## Package and Module Boundaries

### TypeScript Workspace Packages

Standardize on two shared kernel-platform packages plus one concrete package per kernel.

The first OpenClaw plus Hermes phase introduces four kernel-facing workspace packages.

#### `@sdkwork/claw-kernel-types`

Responsibilities:

- stable DTOs
- kernel-neutral shared enums
- projection types
- doctor report types
- package profile types

Forbidden:

- runtime-specific business logic
- HTTP clients
- UI rendering
- closed concrete kernel-id, runtime-kind, or transport-kind enums that must grow whenever a new kernel is added

#### `@sdkwork/claw-kernel-core`

Responsibilities:

- kernel catalog
- profile resolver
- instance registry
- capability routing
- detail module registry
- projection orchestration

Forbidden:

- OpenClaw-specific logic
- Hermes-specific logic
- direct desktop bridge commands

#### `@sdkwork/claw-kernel-openclaw`

Responsibilities:

- OpenClaw adapter contract implementation
- OpenClaw package profile descriptors
- OpenClaw doctor rules
- OpenClaw config translation
- OpenClaw detail module registration metadata

Forbidden:

- generic kernel registry logic
- Hermes logic

#### `@sdkwork/claw-kernel-hermes`

Responsibilities:

- Hermes adapter contract implementation
- Hermes package profile descriptors
- Hermes doctor rules
- Hermes WSL2 or remote launcher integration
- Hermes detail module registration metadata

Forbidden:

- generic kernel registry logic
- OpenClaw logic

### Kernel Package Internal Template Standard

Future kernels must start from one small, repeatable package shape instead of copying OpenClaw internals.

Minimum internal ownership units per concrete kernel package:

- `src/definition.ts` for static kernel metadata and capability declaration
- `src/packageProfiles.ts` for package-profile descriptors and bundled-asset inputs
- `src/doctor.ts` or `src/doctor/` for runtime requirement checks and doctor report assembly
- `src/adapter.ts` or `src/adapter/` for lifecycle and management transport integration
- `src/projection.ts` or `src/projection/` for `BaseDetail` and `KernelModulePayload` assembly
- `src/detailModule.tsx` or `src/detail/` for kernel detail module registration
- `src/index.ts` for the approved package-root public surface

Rules:

- future kernels may expand an ownership unit into a folder, but they must not merge multiple ownership units back into one platform-wide shared file
- cross-kernel imports between `@sdkwork/claw-kernel-openclaw`, `@sdkwork/claw-kernel-hermes`, and future kernel packages are forbidden
- host and feature packages consume kernel packages through package-root exports only
- OpenClaw and Hermes may have different internal complexity, but they must still present the same top-level package shape to the rest of the platform

### Rust Desktop Host Modules

Under `packages/sdkwork-claw-desktop/src-tauri/src/framework`, standardize on:

- `kernels/mod.rs`
- `kernels/registry.rs`
- `kernels/authority.rs`
- `kernels/projection.rs`
- `kernels/adapters/mod.rs`
- `kernels/adapters/openclaw.rs`
- `kernels/adapters/hermes.rs`

These adapter files are the initial baseline, not a permanent closed set. Future kernels add new adapter files under `kernels/adapters/` without redesigning the host module layout.

OpenClaw-specific runtime code that remains useful should move behind the OpenClaw adapter boundary. Shared helper utilities may be extracted into neutral helper modules, but no long-term desktop core module should remain OpenClaw-named if its responsibility is now platform-wide.

### Kernel Package vs Desktop Component Boundary

The kernel platform and the desktop component catalog are separate standards.

Rules:

- `KernelDefinition` and `KernelPackageProfile` own kernel inclusion, doctor policy, install metadata, and instance authority
- `foundation/components/component-registry.json` and `DesktopBundledComponentsInfo` are reserved for desktop support components that are not kernel installs
- `openclaw` and `hermes` must not remain long-term entries in the generic bundled component catalog
- desktop support components may still describe proxy, supervisor, or helper services, but they must not become the source of truth for kernel lifecycle or kernel packaging
- kernel profile validation and desktop component validation run independently

### Host Diagnostics vs Kernel Projection Boundary

Desktop host diagnostics are not the kernel platform contract.

Rules:

- host-facing diagnostic payloads such as `DesktopKernelInfo` may continue to exist for desktop inspection and troubleshooting
- host diagnostic payloads must not be the source of truth for instance routing, kernel enablement, install selection, or detail-module rendering
- OpenClaw-shaped host fields such as `open_claw_runtime`, `desktop_startup_evidence`, or bundled component snapshots are legacy diagnostics, not long-term shared feature contracts
- feature packages consume standardized kernel projections and detail-module payloads, not raw desktop host diagnostics

### Projection Assembly Rule

Projection assembly is a platform responsibility.

Rules:

- host diagnostics, machine state, doctor output, and adapter probes are normalized in the projection layer before reaching feature packages
- no feature package may depend on a one-to-one field mapping from `DesktopKernelInfo`
- if host diagnostics contain OpenClaw-only data, the projection layer either translates it into kernel-neutral shared diagnostics or isolates it inside the OpenClaw module payload
- Hermes projection assembly must follow the same normalization path and must not introduce a second direct-to-frontend host diagnostic contract

## Configuration Standard

Split configuration into three layers only.

### 1. Kernel Definition Config

Directory:

- `config/kernels/<kernelId>.json`
- `config/kernels/openclaw.json`
- `config/kernels/hermes.json`

The concrete OpenClaw and Hermes files are initial baseline examples. Future kernels add additional files under the same directory pattern without changing the configuration model.

Purpose:

- immutable kernel metadata
- supported platforms
- required external runtimes
- install strategy descriptors
- capability declarations

### 2. Package Profile Config

Directory:

- `config/kernel-profiles/<packageProfileId>.json`
- `config/kernel-profiles/openclaw-only.json`
- `config/kernel-profiles/hermes-only.json`
- `config/kernel-profiles/dual-kernel.json`

The three concrete profile files are the first required presets for the OpenClaw plus Hermes phase. Future package profiles extend the same directory pattern.

Purpose:

- which kernels ship in a product package
- which adapters, pinned source assets, and doctor rules are included
- which kernels are enabled by default

### 3. Machine Runtime State

Stored under machine state roots managed by the desktop host.

Purpose:

- current installs
- active install keys
- fallback install keys
- instance registry
- startup evidence
- doctor history
- rollback records

Package profiles must not carry machine policy. Machine runtime state must not redefine static kernel metadata.

### Legacy State Cutover Rule

The steady-state platform reads only the standardized kernel state model.

Rules:

- legacy singleton files such as `openclaw_authority_file`, `openclaw_migrations_file`, and `openclaw_runtime_upgrades_file` are input to a one-time development migration only
- after successful migration, steady-state runtime code must not keep dual-read or fallback logic for the legacy file set
- migration must be idempotent: if the new standardized state already exists, the migration no-ops
- migration must rewrite the target standardized state atomically rather than partially merging legacy and new layouts

### Canonical Machine State File Contracts

Kernel-neutral state filenames are part of the standard.

Rules:

- no canonical machine state filename may encode a concrete kernel name
- `registry.json` records `layoutVersion`, `packageProfileId`, `enabledKernelIds`, persisted kernel default instances, and capability preference metadata
- `installs.json` records `KernelInstall` entries keyed by `kernelId` and `installKey`
- `instances.json` records `KernelInstance` entries keyed by `kernelId` and `instanceId`, plus stable display metadata
- `doctors.json` records the latest `KernelDoctorReport` per `kernelId` and last-check timestamps
- `upgrades.json` records active and fallback install selection plus last upgrade outcomes per `kernelId`
- `startup-evidence/<kernelId>/<instanceId>.json` records per-instance startup evidence and latest activation outcome
- standardized files are the only steady-state source of truth for install selection, instance lifecycle, and startup evidence
- default instance selection and capability preference metadata are owned only by `registry.json`; per-instance records must not duplicate or shadow them

## Directory Layout Standard

Standardize machine state directories by kernel.

Example layout:

```text
machine/state/kernels/
  registry.json
  installs.json
  instances.json
  doctors.json
  upgrades.json
  startup-evidence/
    <kernelId>/
      <instanceId>.json
  <kernelId>/
    installs/
    configs/
    state/
```

The concrete OpenClaw and Hermes state roots are baseline examples of the `<kernelId>/` pattern, not a permanent closed directory list.

Rules:

- every kernel gets an isolated state root
- every instance gets a dedicated config and state root
- active and fallback install keys are recorded centrally
- no kernel may write its canonical state into another kernel's root

### Parallel Instance Execution Standard

Multi-kernel support requires explicit multi-instance isolation.

Rules:

- every lifecycle operation other than package-level install or upgrade is keyed by `kernelId` and `instanceId`
- one shared install may back multiple instances, but shared installs are treated as immutable inputs after activation
- config files, logs, sockets, pid files, caches, and startup evidence are instance-scoped
- no adapter may rely on a single global active runtime per kernel
- instance failure, stop, or restart for one kernel instance must not implicitly stop sibling instances from the same kernel

## Packaging Standard

Only three package profiles are supported in the first platform standard.

These are first-release packaged presets, not a permanent closed union for all future kernels.

Rules:

- `KernelPackageProfile.profileId` remains an extensible identifier rather than a hardcoded global enum
- future kernels may introduce new package profiles by adding profile config and manifest data without redesigning the host, registry model, or detail-module architecture
- the initial three profiles are the only required presets for the OpenClaw plus Hermes phase and remain the compatibility baseline for this design

### `openclaw-only`

Contains:

- OpenClaw adapter
- OpenClaw pinned source asset or tarball metadata
- OpenClaw doctor rules

Does not contain:

- Hermes adapter
- Node.js runtime
- Python runtime
- `uv`

### `hermes-only`

Contains:

- Hermes adapter
- Hermes pinned source asset or source metadata
- Hermes doctor rules
- WSL2 or remote integration support metadata

Does not contain:

- OpenClaw adapter
- Node.js runtime
- Python runtime
- `uv`

### `dual-kernel`

Contains:

- OpenClaw adapter
- Hermes adapter
- both kernels' pinned source assets or source metadata
- both kernels' doctor rules

Does not contain:

- Node.js runtime
- Python runtime
- `uv`

Packaging verification must fail immediately if bundled artifacts contain Node.js, Python, or `uv` binaries.

### Package Profile Manifest Contract

Every packaged desktop artifact must publish one deterministic package-profile manifest.

Initial carrier:

- `generated/bundled/foundation/components/bundle-manifest.json`

Required fields:

- `packageProfileId`
- `includedKernelIds`
- `defaultEnabledKernelIds`
- `requiredExternalRuntimes`
- `optionalExternalRuntimes`
- `launcherKinds`
- `kernelPlatformSupport`

Rules:

- installer UX, prerequisite checks, doctor bootstrap messaging, and first-run enablement must read package-profile kernel inclusion from the package-profile manifest, not infer it from `component-registry.json`
- `component-registry.json` may continue to describe desktop support components during migration, but it is not the source of truth for which kernels ship in `openclaw-only`, `hermes-only`, or `dual-kernel`
- the package-profile manifest must explicitly declare that Node.js, Python, and `uv` are external requirements when relevant rather than bundled package contents
- `optionalExternalRuntimes` is package-scoped and must exclude any runtime already present in `requiredExternalRuntimes`
- `kernelPlatformSupport.<kernelId>` must preserve kernel-specific host restrictions such as Hermes on Windows being `wsl2OrRemoteOnly`
- desktop installer smoke and equivalent packaged-artifact verification must fail when persisted package-profile manifest metadata drifts from the active kernel package profile catalog
- when release finalization condenses per-artifact package manifests into a top-level release manifest, each emitted artifact record must retain its source package-profile metadata so downstream release tooling does not need to reopen sidecar manifests to recover kernel inclusion and platform constraints
- `openclaw-only`, `hermes-only`, and `dual-kernel` must differ through manifest data and included kernel assets, not through divergent host-only business logic paths
- manifest `defaultEnabledKernelIds` must be a subset of manifest `includedKernelIds`
- if release automation accepts a `releaseProfileId`, it must either also require `packageProfileId` or deterministically derive it from a release-profile mapping that is explicit in source control rather than implicit in host defaults

### Pinned Asset Semantics

Pinned kernel assets are allowed only as deterministic install inputs.

Rules:

- a pinned asset may be a source snapshot, tarball, lockfile set, wheel index reference, or commit metadata
- a pinned asset must not be a bundled language runtime, a bundled `uv` binary, or a pre-provisioned Python or Node.js distribution
- OpenClaw package inputs may carry source metadata or tarballs, but installation and execution resolve through external Node.js
- Hermes package inputs may carry source metadata or source snapshots, but dependency resolution and environment creation resolve through external Python and external `uv`

## External Runtime Requirement Standard

### OpenClaw

Required:

- external Node.js version supported by the OpenClaw target

Optional:

- package managers or other local tooling required by the chosen install strategy

Forbidden:

- bundled `node.exe`
- bundled Node.js archives inside desktop release assets

### Hermes

Required:

- Python 3.11+
- external `uv`
- WSL2 or remote Linux execution path on Windows

Optional:

- Node.js 18+ for Hermes features that require it

Forbidden:

- bundled Python
- bundled `uv`
- native Windows local Hermes execution

## Launcher Model Standard

Keep launcher kinds intentionally small.

Allowed launcher kinds:

- `externalLocal`
- `externalWslOrRemote`

### `externalLocal`

Used by OpenClaw.

Characteristics:

- launches on the host machine
- depends on externally installed language runtime
- supports local process lifecycle control

### `externalWslOrRemote`

Used by Hermes.

Characteristics:

- launches through WSL2 or remote Linux transport
- desktop host manages readiness and projections, not native Windows local process execution
- can still surface logs, config state, doctor output, and lifecycle actions through the adapter

No third launcher kind should be added until a real kernel requires it.

## Lifecycle State Machine Standard

### Install Lifecycle

- `detected`
- `requirementsMissing`
- `installing`
- `installed`
- `activationFailed`
- `activated`
- `upgradeFailed`
- `rollbackReady`

### Instance Lifecycle

- `inactive`
- `starting`
- `ready`
- `degraded`
- `stopped`
- `failed`

### Activation Stages

- `resolveRequirements`
- `prepareInstall`
- `validateInstall`
- `activateInstall`
- `prepareConfig`
- `startProcess`
- `verifyEndpoint`
- `projectInstance`
- `ready`

Every kernel instance must project both its lifecycle and its current activation stage. UI may render both, but lifecycle remains the higher-level summary.

### Shared Lifecycle Projection Rule

Lifecycle projection stays platform-neutral.

Rules:

- shared lifecycle projection uses the standardized lifecycle and activation-stage vocabulary from this spec
- shared lifecycle fields must not depend on OpenClaw-only enums such as `StudioBuiltInOpenClawActivationStage`
- kernel-specific substage chains may be exposed as adapter-owned diagnostics or module payloads
- OpenClaw built-in startup diagnostics may show finer-grained historical stages, but those stages are not promoted into the long-term shared lifecycle contract

## Doctor Standard

Every kernel adapter must expose structured doctor checks with:

- `checkId`
- `label`
- `status`
- `actual`
- `expected`
- `detail`
- `remediation`

### OpenClaw Doctor Minimum Checks

- external Node.js present
- Node.js version in supported range
- pinned OpenClaw source or tarball available
- install root writable
- config root writable
- health probe endpoint contract available after startup

### Hermes Doctor Minimum Checks

- platform supported
- if Windows, WSL2 available or remote target configured
- Python 3.11+ present
- `uv` present
- optional Node.js present or explicitly degraded
- Hermes source checkout available
- instance roots writable

## Kernel Projection Standard

Frontend-safe kernel projection must expose:

- kernel definition
- install summary
- doctor summary
- instance summaries
- lifecycle actions
- capability summary
- diagnostics summary

Frontend must not read raw authority state files or raw kernel config files to derive UI behavior.

### Projection Extension Rule

Shared projections stay kernel-neutral.

Rules:

- kernel-specific detail payloads are carried as adapter-owned module payloads resolved under the owning kernel package
- platform-shared types must not permanently carry OpenClaw-only detail fields such as managed OpenClaw config insights or fixed OpenClaw workbench section unions
- OpenClaw-specific workbench payloads stay inside the OpenClaw module boundary
- Hermes-specific detail payloads stay inside the Hermes module boundary
- legacy shared types such as `StudioWorkbenchSnapshot`, `InstanceWorkbenchSnapshot`, and `InstanceWorkbenchSectionId` must converge to either kernel-owned module types or kernel-neutral base-detail helpers

### Base Detail Contract

The shared detail base remains intentionally small.

Rules:

- shared detail data covers only instance summary, lifecycle, health, storage, connectivity, observability, data access, artifacts, capability summaries, official runtime notes, and generic console or action affordances
- shared detail data must not become a dumping ground for kernel-specific workbench or environment structures
- detail loading resolves `baseDetail` first and adapter-owned `modulePayload` second, or an equivalent two-layer contract with the same separation
- a module payload failure may degrade kernel-specific sections, but it must not invalidate the shared route, instance identity, or generic diagnostics rendering

### Legacy Detail DTO Decomposition Rule

Current shared detail DTOs must converge by ownership.

Rules:

- `StudioInstanceDetailRecord.instance`, `health`, `lifecycle`, `storage`, `connectivity`, `observability`, `dataAccess`, `artifacts`, `capabilities`, and `officialRuntimeNotes` map to the long-term shared base-detail layer
- `StudioInstanceDetailRecord.workbench` is legacy-shaped and must converge into kernel-owned module payloads instead of remaining a permanent shared field
- OpenClaw managed config state, managed channels, provider workbench state, skill workbench state, and built-in startup affordances belong to the OpenClaw module boundary
- Hermes environment inspection, WSL2 or remote readiness state, remote runtime metadata, and Hermes-specific management affordances belong to the Hermes module boundary
- shared detail helpers may compute counts, badges, and generic diagnostics from base detail, but they must not require every kernel to implement an OpenClaw-style workbench payload

### Console And Management Affordance Standard

Shared management affordances must remain extensible.

Rules:

- the shared base-detail layer may expose generic management actions and generic console availability metadata
- concrete console kinds must not remain a closed global enum such as `openclawControlUi`
- a kernel-specific console surface may be modeled as an adapter-owned action or module payload when it is not broadly reusable across kernels
- adding Hermes or future kernels must not require growing a permanent shared closed union of kernel-specific console kinds

### Config And Secret Handling Rule

Shared detail must separate configuration metadata from kernel-managed secrets.

Rules:

- shared base detail may expose generic connectivity hints, writability state, and data-access routes for configuration surfaces
- raw mutable kernel config structures do not belong to the shared base-detail contract
- values such as `workspacePath`, `corsOrigins`, `autoUpdate`, `logLevel`, managed provider config, and other kernel-specific config summaries belong to kernel-owned module payloads or authoritative config files exposed through data-access routes
- raw secret material such as `authToken`, passwords, API keys, or remote credentials must not remain long-term fields on shared detail DTOs
- if a kernel needs to indicate that a secret-backed management surface exists, shared detail exposes availability metadata or secret-source metadata, not the resolved secret value

### Formal Shared Detail Interfaces

The target contract is small and explicit.

`BaseDetail` contains:

- `instance`: stable identity and presentation metadata such as `kernelId`, `instanceId`, display name, deployment mode, transport id, status, version, and non-secret host or endpoint labels
- `lifecycle`: shared lifecycle state, activation stage, ownership, writability, controllability, and generic lifecycle notes
- `health`: score, summary status, and shared health checks
- `storage`: storage binding summary and durability traits
- `connectivity`: generic endpoint descriptors, transport id, exposure, and auth mode metadata
- `observability`: log availability, generic log locations, and last-seen metadata
- `dataAccess`: authoritative routes for config, logs, files, memory, tasks, tools, models, and storage access
- `artifacts`: generic artifact references such as config files, log files, workspace directories, runtime directories, endpoints, and dashboards
- `capabilities`: kernel-neutral capability summaries
- `runtimeNotes`: official runtime notes and operator-facing constraints
- `management`: generic lifecycle actions, generic console availability metadata, and generic diagnostics affordances

`KernelModulePayload` contains:

- kernel-owned sections, navigation metadata, workbench data, module-specific diagnostics, kernel-specific config summaries, and kernel-specific management affordances

`KernelManagementAction` contains:

- a stable action id
- user-facing label metadata
- enablement state
- a scope of `shared` or `kernelModule`
- optional diagnostic or confirmation metadata

`KernelConsoleAvailability` contains:

- `available`
- optional `entryUrl`
- optional `autoLoginUrl`
- auth mode metadata
- source metadata
- human-readable reason when unavailable

### Example Shared Contract Shapes

The following shapes are illustrative target contracts for the hard cut.

```ts
type KernelId = string;
type KernelTransportId = string;

interface BaseDetail {
  instance: {
    kernelId: KernelId;
    instanceId: string;
    displayName: string;
    deploymentMode: string;
    transportId: KernelTransportId;
    status: string;
    version: string;
    isBuiltIn?: boolean;
    hostLabel?: string | null;
  };
  lifecycle: {
    owner: string;
    lifecycle: string;
    activationStage?: string | null;
    configWritable: boolean;
    lifecycleControllable: boolean;
    notes: string[];
  };
  health: {
    score: number;
    status: string;
    checks: Array<{ id: string; label: string; status: string; detail: string }>;
  };
  storage: {
    status: string;
    provider: string;
    namespace: string;
  };
  connectivity: {
    transportId: KernelTransportId;
    endpoints: Array<{
      id: string;
      kind: string;
      status: string;
      url?: string | null;
      exposure: string;
      authMode: string;
    }>;
  };
  observability: {
    status: string;
    logAvailable: boolean;
    logLocations: string[];
    lastSeenAt?: number | null;
  };
  dataAccess: {
    routes: Array<{
      id: string;
      scope: string;
      mode: string;
      status: string;
      target?: string | null;
      readonly: boolean;
      authoritative: boolean;
    }>;
  };
  artifacts: Array<{
    id: string;
    kind: string;
    status: string;
    location?: string | null;
  }>;
  capabilities: Array<{ id: string; status: string; detail: string }>;
  runtimeNotes: Array<{ title: string; content: string; sourceUrl?: string }>;
  management: {
    actions: KernelManagementAction[];
    consoleAvailability?: KernelConsoleAvailability | null;
    diagnostics: Array<{ id: string; label: string; value: string; severity?: string }>;
  };
}

interface KernelManagementAction {
  id: string;
  label: string;
  enabled: boolean;
  scope: 'shared' | 'kernelModule';
  reason?: string | null;
  confirmationLabel?: string | null;
}

interface KernelConsoleAvailability {
  available: boolean;
  entryUrl?: string | null;
  autoLoginUrl?: string | null;
  authMode: string;
  source: string;
  reason?: string | null;
}

interface KernelModulePayload {
  kernelId: KernelId;
  moduleType: string;
  navigation: Array<{ id: string; label: string; visible: boolean }>;
  sections: Record<string, unknown>;
  diagnostics: Array<{ id: string; label: string; value: string; severity?: string }>;
  managementActions: KernelManagementAction[];
}
```

OpenClaw module payload example responsibilities:

- current workbench sections
- managed config summaries
- managed channels
- provider, tool, memory, skill, task, and agent workbench data
- built-in startup diagnostics and retry affordances

Hermes module payload example responsibilities:

- environment section data
- WSL2 or remote target readiness data
- Hermes config summaries
- Hermes capability and runtime diagnostics
- Hermes-specific management actions

### Legacy-To-Target Mapping Matrix

The hard cut follows this ownership mapping.

- `StudioInstanceRecord.runtimeKind` maps to `BaseDetail.instance.kernelId`
- `StudioInstanceRecord.transportKind` maps to `BaseDetail.instance.transportId` and `BaseDetail.connectivity.transportId`
- `StudioInstanceDetailRecord.config.port`, `baseUrl`, and `websocketUrl` collapse into `BaseDetail.connectivity` endpoint metadata
- `StudioInstanceDetailRecord.config.sandbox`, `autoUpdate`, `logLevel`, `corsOrigins`, and `workspacePath` move to kernel-owned module payloads or authoritative config access routes
- `StudioInstanceDetailRecord.config.authToken` leaves shared detail entirely and becomes adapter-owned secret handling or secret-source metadata
- `StudioInstanceDetailRecord.lifecycle.lastActivationStage` maps to the shared activation stage only when it fits the standardized vocabulary; otherwise it becomes kernel-specific diagnostics
- `StudioInstanceDetailRecord.consoleAccess` converges to `BaseDetail.management.consoleAvailability` plus optional kernel-module actions
- `StudioInstanceDetailRecord.workbench` converges to `KernelModulePayload`
- `InstanceWorkbenchSnapshot` converges to an OpenClaw-owned module view model, not a permanent cross-kernel shared type
- `DesktopKernelInfo.open_claw_runtime` decomposes into `KernelInstall`, `KernelInstance`, shared diagnostics, and OpenClaw module diagnostics
- `DesktopKernelInfo.desktop_startup_evidence` decomposes into shared startup evidence plus optional kernel-specific diagnostics
- `DesktopKernelInfo.bundled_components` remains desktop support-component diagnostics and does not become kernel projection state

### Shared Summary Ownership Rule

Shared summaries may reuse shared detail only.

Rules:

- generic management summaries such as lifecycle owner, deployment mode, config authority route, and generic console availability may be derived from `BaseDetail`
- OpenClaw-specific bundled-startup alerts, detailed activation substage rendering, and OpenClaw workbench-derived management summaries belong to the OpenClaw module boundary
- Hermes-specific environment and WSL2 or remote readiness summaries belong to the Hermes module boundary

### Single-Branch Hard-Cut Migration Order

The migration order is a development-sequencing tool only. It does not authorize a shipped compatibility layer.

Rules:

- execute in one branch with one target contract
- temporary compile-time scaffolding is allowed while the branch is in flight
- no released build may ship dual long-term contracts for old shared DTOs and new kernel-platform DTOs

Recommended order:

1. `packages/sdkwork-claw-types`
   Replace closed kernel and transport unions, define the new shared base-detail contracts, and mark legacy shared DTOs as migration-only.
2. `packages/sdkwork-claw-desktop` and `packages/sdkwork-claw-desktop/src-tauri`
   Normalize machine state, projection assembly, doctor output, and desktop diagnostics boundaries.
3. `packages/sdkwork-claw-infrastructure`
   Replace raw `StudioInstanceDetailRecord` and `DesktopKernelInfo` assumptions in platform contracts and bridges with standardized kernel projections.
4. `packages/sdkwork-claw-instances`
   Introduce detail module registry, preserve OpenClaw detail via module registration, and add Hermes detail module without redesigning the OpenClaw page.
5. OpenClaw module consumers
   Migrate `sdkwork-claw-chat`, `sdkwork-claw-agent`, `sdkwork-claw-core`, `sdkwork-claw-settings`, `sdkwork-claw-channels`, and OpenClaw-specific helpers away from shared `workbench` assumptions and onto OpenClaw module contracts.
6. Cross-instance and read-only consumers
   Migrate `sdkwork-claw-center`, `sdkwork-claw-dashboard`, and other summary-oriented packages to consume standardized base detail and capability routing only.
7. Release and bundling scripts
   Migrate `scripts/release`, `scripts/run-desktop-release-build.mjs`, `scripts/sync-bundled-components.mjs`, `scripts/prepare-openclaw-runtime.mjs`, and related verification scripts so release automation and packaged-asset validation align with `packageProfileId`, external runtime policy, and the hard cut away from bundled language runtimes.
8. Cleanup
   Remove legacy shared DTOs, OpenClaw-only shared enums, and direct desktop diagnostic dependencies once all packages compile against the new platform contracts.

### Affected Package Appendix

The current repo areas most directly affected by the hard cut are:

- `packages/sdkwork-claw-types`
- `packages/sdkwork-claw-desktop`
- `packages/sdkwork-claw-infrastructure`
- `packages/sdkwork-claw-instances`
- `packages/sdkwork-claw-chat`
- `packages/sdkwork-claw-agent`
- `packages/sdkwork-claw-core`
- `packages/sdkwork-claw-settings`
- `packages/sdkwork-claw-channels`
- `packages/sdkwork-claw-center`
- `packages/sdkwork-claw-dashboard`
- `scripts/release`
- desktop bundling and verification scripts under `scripts/`

The first-pass migration hotspots visible in the current codebase are:

- shared DTO declarations in `packages/sdkwork-claw-types/src/index.ts`
- desktop diagnostic bridges in `packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts` and `packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel.rs`
- shared platform contracts in `packages/sdkwork-claw-infrastructure/src/platform/contracts/studio.ts`
- OpenClaw workbench shaping in `packages/sdkwork-claw-instances/src/services/instanceWorkbenchSnapshotSupport.ts`
- shared instance detail orchestration in `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`
- desktop release profile and asset packaging logic in `scripts/release/release-profiles.mjs` and `scripts/release/package-release-assets.mjs`
- desktop bundle preparation and legacy bundled-runtime scripts such as `scripts/run-desktop-release-build.mjs`, `scripts/sync-bundled-components.mjs`, and `scripts/prepare-openclaw-runtime.mjs`

## Capability Routing Standard

Capability routing is platform-owned logic in `@sdkwork/claw-kernel-core`.

Routing inputs:

- requested capability
- kernel availability
- doctor state
- instance lifecycle
- profile policy
- user override

Routing outputs:

- selected kernel instance
- routing reason
- degraded status if applicable

Initial capability vocabulary:

- `chat`
- `tools.invoke`
- `tasks.cron`
- `skills`
- `files.local`
- `memory`
- `config.manage`
- `provider.routing`

This vocabulary can expand, but only through `@sdkwork/claw-kernel-types`.

### Capability Preference Resolution Rule

Capability routing must stay deterministic when multiple eligible instances exist.

Rules:

- routing precedence is: explicit user override for the requested action, then persisted capability preference, then persisted kernel default instance, then deterministic best-available instance selection
- persisted capability preference and persisted kernel default instance belong to standardized machine-state default-selection metadata, not feature-local UI state
- feature-local concepts such as the current detail page, highlighted list row, or `activeInstanceId` convenience state must not become the source of truth for capability routing unless the user explicitly performs a routing-override action
- if a preferred instance is disabled, removed, unsupported by the current package profile, or fails doctor or lifecycle gating, routing must ignore that preference, emit a routing reason, and fall through to the next standard precedence tier
- deterministic best-available selection must consider only instances whose kernel is enabled in the current package profile and whose lifecycle and doctor state satisfy the requested capability

## Error Code Standard

Use stable kernel-platform error codes.

Examples:

- `KERNEL_REQUIREMENT_MISSING`
- `KERNEL_PLATFORM_UNSUPPORTED`
- `KERNEL_INSTALL_SOURCE_MISSING`
- `KERNEL_INSTALL_INVALID`
- `KERNEL_ACTIVATION_FAILED`
- `KERNEL_ENDPOINT_UNREACHABLE`
- `KERNEL_INSTANCE_PROJECTION_FAILED`
- `KERNEL_MANAGEMENT_TRANSPORT_FAILED`

Error codes must be kernel-agnostic. Human-readable details may contain kernel-specific context.

## Security Standard

- no kernel is allowed to self-register unmanaged roots outside the authority-declared owned roots
- no kernel may mutate another kernel's install root or config root
- no packaged profile may carry embedded language runtimes
- every kernel action that launches or upgrades a process must record structured evidence
- external command execution must remain allowlisted by desktop policy

## Instance Detail Standard

### Non-Negotiable Constraint

The current OpenClaw instance detail page design must not be redesigned.

### Page Entry Standard

`packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx` remains the only route entry for instance detail.

### UI Architecture Standard

Use:

- one shared detail page entry
- one shared shell
- one kernel detail resolver
- one kernel-specific detail module per kernel

### OpenClaw Detail Rule

The current OpenClaw detail implementation remains the canonical OpenClaw detail experience. It is not rewritten for abstraction's sake.

OpenClaw detail continues to use:

- existing page structure
- existing sections
- existing workbench chrome
- existing component composition

The platform only wraps or registers it as the OpenClaw detail module.

### Hermes Detail Rule

Hermes gets a dedicated detail module with its own sections. It must plug into the same routed page, but it does not need to mimic the OpenClaw workbench model.

Recommended Hermes sections:

- `overview`
- `environment`
- `config`
- `capabilities`
- `logsDiagnostics`

### Shared Detail Shell Responsibilities

- route resolution
- loading state
- not-found state
- module mount context
- optional common header, action, and diagnostics affordances that do not force identical layouts across kernels

Rules:

- shared shell affordances are opt-in per detail module and must not be injected when they would alter a kernel's preserved visual hierarchy

### Shell vs Module Boundary

The shared route entry is not a mandate for one universal detail layout.

Rules:

- the shared shell does not own a global section enum for every kernel
- OpenClaw may continue to own `InstanceDetailWorkbenchChrome`, its current section navigation, and its current section composition inside the OpenClaw detail module
- Hermes may render a different section and navigation model inside the same route entry
- module registration decides which shared wrappers are reused and which kernel-owned layout components render directly
- when the registered OpenClaw module preserves the current detail experience, the shared shell must not prepend or wrap it with an additional global header, action bar, or diagnostics rail that changes the current page hierarchy
- `chrome: sharedWorkbench` exists to reuse the current OpenClaw header and workbench composition through registration, not to redesign that composition under a new shell-owned layout

### Detail Module Context Contract

Kernel detail modules receive structured context instead of reaching into host-global state.

Rules:

- the module render context includes `kernelId`, `instanceId`, shared `baseDetail`, adapter-owned `modulePayload`, lifecycle actions, and diagnostics affordances
- kernel-specific polling, subscriptions, and startup refresh logic belong to the owning kernel detail module or its controller layer, not to the shared route shell
- OpenClaw built-in startup refresh behavior is treated as OpenClaw module behavior, not a shared-instance-detail behavior
- Hermes environment probing, WSL2 readiness refresh, and remote endpoint polling belong to the Hermes module boundary

### Detail Controller And Local State Ownership Rule

Rendering ownership and local interaction ownership must stay aligned.

Rules:

- kernel-specific section state, dialog state, draft form state, selection state, lazy-load state, reload handlers, and mutation runners belong to the owning kernel detail module or module-scoped controller hooks
- the shared route shell may own only route-level loading, not-found, module resolution, and kernel-neutral shared affordances
- no future kernel may add kernel-specific `useState`, polling timers, or mutation orchestration directly into `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`
- OpenClaw may preserve its current local interaction model, but that state must move under the OpenClaw module boundary as a wrapper/controller extraction rather than remain a permanent shared-page responsibility
- module-local state must be keyed and reset by `instanceId` so switching between parallel instances does not leak selections, drafts, or pending mutation UI across instances

### Detail Module Registration Contract

The registry contract is small and deterministic.

Rules:

- the detail module registry key is `kernelId`, and there is exactly one active registration per kernel
- each registration declares `chrome` as either `sharedWorkbench` or `kernelOwned` so the shared shell can choose wrappers without hardcoded per-kernel branching
- registry lookup may lazy-load the implementation, but registration metadata must stay stable enough for synchronous route resolution
- detail module registration consumes standardized `BaseDetail` plus adapter-owned `KernelModulePayload`; it must not depend on raw backend DTO shapes
- `supports(detail)` is only a compatibility guard for the registered kernel module, not a second routing system with multiple competing modules for one kernel
- when a kernel has no registered detail module, the shell renders a standard unsupported-kernel fallback instead of reusing another kernel's detail page

### Kernel Detail Module Responsibilities

- kernel-specific section definitions
- kernel-specific content rendering
- kernel-specific management affordances

### Forbidden Detail Coupling

- no kernel-specific branching spread across generic detail shell components
- no future kernel may copy `InstanceDetail.tsx` into a new page route
- no kernel-specific module may reach into another kernel's private detail state

## Componentization Standard For Instance Detail

Keep componentization intentionally small.

Shared reusable components remain available:

- `InstanceDetailHeader`
- `InstanceDetailWorkbenchChrome`
- `InstanceDetailSectionContent`
- shared badges and section availability helpers

New modular additions:

- one shared detail-shell bridge at the instance-detail feature boundary
- one detail module registry owned by `@sdkwork/claw-kernel-core`
- one exported concrete detail module from each concrete kernel package

The first OpenClaw module is a registration wrapper around the current implementation, not a redesign.

### Detail Module Packaging Boundary

Kernel detail modules are kernel-owned code, not shared feature code.

Rules:

- `packages/sdkwork-claw-instances` owns the routed page entry, shared shell composition, and shared presentational components only
- `@sdkwork/claw-kernel-core` owns the registry contract and module resolution API
- `@sdkwork/claw-kernel-openclaw` exports the OpenClaw detail module registration and wrapper/controller bridge around the current OpenClaw detail implementation
- `@sdkwork/claw-kernel-hermes` exports the Hermes detail module registration and Hermes-specific detail implementation
- future kernels export their own detail modules from their own kernel packages rather than adding concrete module files under `packages/sdkwork-claw-instances`
- if a local bridge file exists in `packages/sdkwork-claw-instances`, it must stay kernel-neutral and only adapt shared route state into registry resolution and shell mounting

## OpenClaw Standard In The New Platform

OpenClaw remains the most feature-rich local kernel in the first release.

Key decisions:

- keep OpenClaw-specific workbench and management sections
- stop bundling Node.js
- move OpenClaw installation to an external Node.js-driven install strategy
- retire bundled OpenClaw runtime preparation and bundled runtime registration as long-term platform behavior
- if OpenClaw CLI convenience shims are kept, they must resolve against the active managed install and external Node.js rather than a packaged Node runtime
- keep upgrade evidence and startup evidence, but standardize them under kernel-platform naming and storage
- preserve current OpenClaw detail UX

OpenClaw package inputs may include:

- pinned version metadata
- local tarball reference
- source snapshot metadata
- doctor rules

They must not include a bundled Node.js archive.

## Hermes Standard In The New Platform

Hermes is treated as a first-class kernel, not a special remote add-on.

Key decisions:

- official Hermes source integration only
- no native Windows local execution
- Windows host support through WSL2-backed or remote Linux operation only
- Python and `uv` remain external requirements
- Node.js remains optional and capability-scoped for Hermes
- Hermes detail UI is dedicated, not forced into the OpenClaw workbench model

## Testing Standard

### Contract Tests

- every adapter implements the required eight operations
- every package profile resolves to valid included kernels

### Doctor Tests

- missing external Node.js blocks OpenClaw correctly
- missing Python or `uv` blocks Hermes correctly
- Windows without WSL2 or remote config blocks Hermes correctly

### Lifecycle Tests

- install, activate, start, stop, and projection transitions follow the standard state machine

### Packaging Tests

- `openclaw-only`, `hermes-only`, and `dual-kernel` produce the correct included kernel metadata
- packaging fails when Node.js, Python, or `uv` binaries appear in artifacts

### Detail UI Tests

- OpenClaw detail route renders unchanged
- Hermes detail route renders through the shared page entry
- detail module registry resolves the correct module for each kernel

## Non-Goals

- no native Windows local Hermes execution
- no redesign of the current OpenClaw detail UX
- no bundling of language runtimes
- no speculative launcher families beyond the two defined launcher kinds
- no temporary compatibility layer for old OpenClaw-only authority models

## Decision Summary

The platform will hard-cut to a minimal standardized multi-kernel design with:

- one shared kernel authority model
- one shared package profile model
- one shared instance model
- adapter-based kernel integration
- external runtime requirements only
- preserved OpenClaw detail UX
- new Hermes detail module
- support for future kernels without host-level redesign

## Recommended Next Step

Create a detailed implementation plan that executes the redesign in four phases:

1. kernel type and authority foundation
2. packaging and doctor model hard-cut
3. OpenClaw migration onto the new kernel platform without UI redesign
4. Hermes adapter and Hermes detail module
