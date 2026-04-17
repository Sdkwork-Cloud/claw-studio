# Kernel Standard Model And Built-In Governance Design

## Status

Proposed v1 freeze candidate.

## Goal

Define a single standard kernel model for Claw Studio that:

- treats Claw Studio as a kernel platform instead of an OpenClaw shell
- removes historical `managed config` and `managed route` concepts from the domain model
- makes built-in kernels a standard deployment mode instead of a special-case runtime
- standardizes config truth, authority, lifecycle, health, and directory semantics
- creates a clean foundation for OpenClaw, Hermes, and future kernels

## Problem Statement

The current model still mixes multiple concerns:

- kernel type and deployment shape
- configuration truth and configuration access path
- governance authority and route discovery
- lifecycle state and health state
- shared platform concepts and OpenClaw-specific module concepts

Those mixed concerns created historical terms such as:

- `managedConfigPath`
- `managedConfigRoot`
- `managedFile`
- `managedDirectory`
- `workbenchManaged`
- `providerCenterManagedOpenClawDetail`

These terms are not stable product concepts. They encode transitional implementation history and now leak into:

- shared DTOs
- capability gating
- instance detail rendering
- config editability decisions
- user-visible labels

The result is an architecture where config truth, authority, access, and compatibility are not cleanly separated.

## Decision

Adopt one unified kernel model for all kernel shapes.

The platform standard is:

- `Kernel` is a runtime type
- `Install` is an installed realization of a kernel
- `Instance` is the runtime execution unit
- `Authority` is the governance model
- `Config` is the configuration truth model
- `Built-in` is only a deployment mode

OpenClaw should conform to this platform model rather than continue extending a historical OpenClaw-specific management vocabulary.

## Core Principles

### 1. Platform Over Runtime

Claw Studio is a kernel platform. No kernel-specific compatibility vocabulary may become the platform vocabulary.

### 2. Stable Domain Terms Over Historical Terms

Shared models and user-visible terms must express durable business truth, not transitional implementation history.

### 3. Config Truth Over Route Truth

The platform standardizes on canonical configuration truth. Raw routes, artifacts, and compatibility inputs are discovery evidence only.

### 4. Authority Over Guessing

Lifecycle, config mutability, and upgrade behavior must be derived from explicit authority capabilities instead of heuristics such as "path exists" or "deployment mode equals local-managed".

### 5. Built-In Is Not a Special Runtime Class

Built-in is a standard deployment shape with stricter governance guarantees. It is not a parallel architecture.

### 6. Legacy Must Sink

Legacy compatibility may exist only in adapter, migration, or diagnostics layers. It must not flow back into shared DTOs or UI truth.

## Standard Object Model

The platform standardizes on five first-class objects.

### KernelDefinition

Defines a kernel type.

Required fields:

- `kernelId`
- `displayName`
- `vendor`
- `runtimeKind`
- `adapterId`
- `supportedDeploymentModes`
- `supportedPlatforms`
- `runtimeRequirements`
- `defaultConfigSpec`
- `capabilityMatrix`

Rules:

- `kernelId` is the stable product identifier
- `KernelDefinition` is platform-static and not instance-specific
- kernel-specific business structures such as OpenClaw providers or Hermes runtime internals do not belong here

### KernelInstall

Defines one installed or attached realization of a kernel.

Required fields:

- `installId`
- `kernelId`
- `version`
- `distributionKind`
- `deploymentMode`
- `installRoot`
- `stateRoot`
- `status`
- `health`
- `source`
- `managedBy`

Rules:

- `KernelInstall` describes realization, not execution
- `installRoot` is runtime content, not config truth
- `distributionKind` may be `bundled`, `imported`, `discovered`, or `remoteRegistered`
- `deploymentMode` is a property of the install or instance, not a separate model

### KernelInstance

Defines a running or runnable unit.

Required fields:

- `instanceId`
- `kernelId`
- `installId`
- `instanceProfileId`
- `displayName`
- `workspaceRoot`
- `userRoot`
- `stateRoot`
- `config`
- `authority`
- `lifecycle`
- `health`
- `endpoint`
- `capabilities`

Rules:

- `KernelInstance` is the only execution unit in the platform model
- config files, installs, and routes must not masquerade as instances
- built-in kernels may have one or many instances

### KernelAuthority

Defines governance ownership and governance capabilities.

Required fields:

- `owner`
- `controlPlane`
- `lifecycleControl`
- `configControl`
- `upgradeControl`
- `doctorSupport`
- `migrationSupport`
- `observable`
- `writable`

Rules:

- `KernelAuthority` models governance, not path discovery
- route availability and endpoint probes are adapter evidence, not first-class authority concepts

### KernelConfig

Defines the authoritative configuration resource used by the instance.

Required fields:

- `configFile`
- `configRoot`
- `userRoot`
- `format`
- `access`
- `provenance`
- `writable`
- `resolved`
- `schemaVersion`

Rules:

- `KernelConfig` is a resource model, not a governance model
- `configRoot` may be derived from `configFile`, but shared contracts may expose it explicitly for stable projection
- raw discovery inputs must be canonicalized before becoming `KernelConfig`

## Standard Enumerations

### DeploymentMode

Defines deployment shape:

- `builtIn`
- `localExternal`
- `attached`
- `remote`

Rules:

- deployment shape does not imply writability, lifecycle control, or upgrade control

### AuthorityOwner

Defines governance owner:

- `appManaged`
- `userManaged`
- `remoteManaged`

### ControlPlaneKind

Defines governance entry point:

- `desktopHost`
- `kernelGateway`
- `bridge`
- `remoteApi`
- `none`

### LifecycleState

Defines runtime lifecycle:

- `unknown`
- `stopped`
- `starting`
- `running`
- `degraded`
- `stopping`
- `failed`

### ActivationStage

Defines startup or activation progress:

- `idle`
- `resolvingInstall`
- `resolvingConfig`
- `doctorChecking`
- `preparingRuntime`
- `startingProcess`
- `probingEndpoint`
- `ready`
- `failed`

### HealthState

Defines runtime health:

- `unknown`
- `healthy`
- `degraded`
- `unhealthy`
- `offline`

### KernelConfigAccessMode

Defines config access shape:

- `localFs`
- `gateway`
- `bridge`
- `remoteApi`
- `unavailable`

## Directory And Path Standard

The platform standardizes six path meanings.

### Platform-Level Roots

- `productInstallRoot`
- `productMachineRoot`
- `productUserRoot`

### Instance-Scoped Roots

- `installRoot`
- `authorityRoot`
- `userRoot`
- `workspaceRoot`
- `stateRoot`
- `configFile`

### Responsibilities

`installRoot`

- stores runtime content only
- must be versionable and swappable
- must not be the canonical config location

`authorityRoot`

- stores host-owned governance state
- stores activation receipts, migration ledgers, upgrade state, doctor outputs, and diagnostics
- must not store user configuration truth

`userRoot`

- anchors user-scoped canonical kernel config
- may store user-private kernel assets and profiles

`workspaceRoot`

- stores business work content
- must not be used to derive canonical config truth

`stateRoot`

- stores runtime mutable state, cache, temp state, lock files, and execution scratch data
- must not be used as config truth

`configFile`

- is the only configuration truth path that shared services and UI may treat as authoritative

## Built-In Kernel Standard

A standard built-in kernel must satisfy all of the following:

- `deploymentMode = builtIn`
- `authority.owner = appManaged`
- `distributionKind = bundled`
- canonical config anchored under `userRoot`
- authority state anchored under `authorityRoot`
- lifecycle governed through a standard control plane
- startup, upgrade, rollback, and migration recorded as structured evidence

### OpenClaw Canonical Rule

For OpenClaw, the canonical config rule is:

`OpenClaw config file: <user_root>/.openclaw/openclaw.json`

This is a platform standard, not a fallback behavior.

### Built-In Separation Rule

Built-in governance must separate:

- install content
- host authority state
- user configuration truth
- business workspace
- runtime mutable state

No built-in kernel may reintroduce a shared machine-owned config truth path as the canonical user configuration path.

## Layering Standard

The architecture is divided into four layers.

### Shared Platform Layer

Owns:

- standard kernel object model
- standard enumerations
- standard capability and summary contracts
- standard path and directory semantics

Must not own:

- OpenClaw providers, channels, tools, memory, or task models
- Hermes runtime-specific config structures
- any `managed*` historical vocabulary

### Kernel Adapter Layer

Owns:

- runtime discovery
- config canonicalization
- doctor checks
- lifecycle translation
- authority projection
- module payload projection

Must not own:

- platform vocabulary definitions
- page composition
- user-visible product terminology

### Kernel Module Layer

Owns:

- kernel-specific business structures
- kernel-specific configuration surfaces
- kernel-specific detail sections
- kernel-specific actions

Must not own:

- canonical path truth decisions
- shared authority semantics
- shared lifecycle semantics

### Legacy And Diagnostics Layer

Owns:

- legacy path importers
- route fallback readers
- raw compatibility evidence
- raw probe and diagnostic evidence

Must not own:

- shared platform truth
- UI-facing truth terms
- long-term business capability gating

## Naming Standard

### Shared Terms Allowed

- `KernelDefinition`
- `KernelInstall`
- `KernelInstance`
- `KernelAuthority`
- `KernelConfig`
- `DeploymentMode`
- `AuthorityOwner`
- `ControlPlaneKind`
- `LifecycleState`
- `ActivationStage`
- `HealthState`
- `KernelConfigAccessMode`
- `KernelConfigProvenance`

### Terms Forbidden In Shared Domain

- `managedConfig`
- `managedConfigPath`
- `managedConfigRoot`
- `managedFile`
- `managedDirectory`
- `workbenchManaged`
- `providerCenterManaged`
- `managed openclaw`
- `config-backed`
- `managed route`

These terms may exist only in:

- legacy migration code
- compatibility canonicalizers
- raw diagnostics evidence

## Capability Gating Standard

Shared capability gating must derive from standard models only.

Examples:

- config editability derives from `KernelConfig.resolved`, `KernelConfig.writable`, and `KernelAuthority.configControl`
- lifecycle actions derive from `KernelAuthority.lifecycleControl` and `LifecycleState`
- upgrade actions derive from `KernelAuthority.upgradeControl` and install state

Forbidden gating patterns:

- `managedConfigPath exists => writable`
- `builtIn => controllable`
- `remote => readonly`
- `attached => non-upgradable`

## Migration Standard

Compatibility migration must follow these rules:

- legacy config paths may be read
- legacy config structures may be imported
- legacy path evidence may be recorded
- legacy paths must not remain write targets
- legacy vocabulary must not re-enter shared DTOs
- migration must leave structured ledger and failure evidence

Recommended rule:

- single write target
- dual read only if necessary
- no dual domain semantics

## OpenClaw Alignment Requirements

OpenClaw must migrate toward the standard model through these outcomes:

- replace `managedConfigPath` with `KernelConfig`
- replace `managed*` capability inference with `KernelAuthority`
- move provider, channel, memory, tool, task, and module-specific structures out of shared platform contracts and into OpenClaw module payloads
- downgrade legacy managed config paths to migration and diagnostics inputs only
- remove `managed*` product terminology from UI
- make `<user_root>/.openclaw/openclaw.json` the only canonical shared config truth

## Acceptance Criteria

The design is considered implemented only when all of the following are true:

### Domain Acceptance

- shared contracts use only the standard kernel vocabulary
- `managed*` vocabulary no longer appears in shared platform types

### Path Acceptance

- canonical config paths resolve under `userRoot`
- authority state resolves under `authorityRoot`
- legacy managed-config paths are not active write targets

### Capability Acceptance

- editability, lifecycle, and upgrade actions are gated by `KernelConfig` and `KernelAuthority`
- path-existence heuristics are removed from shared capability logic

### Layering Acceptance

- shared platform contracts no longer expose OpenClaw-specific management compatibility
- canonicalization logic is adapter-owned
- raw diagnostics do not directly drive UI truth

### Product Acceptance

- user-visible labels no longer contain `Managed Config`, `Managed File`, `Managed Directory`, or similar historical terms

## Non-Goals

This design does not:

- redefine the visual design of every instance detail page
- create an over-abstract runtime meta-framework disconnected from real kernel semantics
- move kernel-specific configuration structures into shared platform contracts
- preserve dual shared semantics for old and new config models long-term

## Execution Order

Recommended implementation order:

1. freeze terminology and shared contracts
2. introduce `KernelConfig`
3. introduce `KernelAuthority`
4. cut shared platform versus kernel module boundaries
5. rebuild built-in kernel directory and governance layout
6. align UI wording and action gating
7. remove remaining shared historical models

## Final Standard

The platform standard is:

`Kernel` defines type, `Install` defines realization, `Instance` defines execution, `Authority` defines governance, and `Config` defines truth. `Built-in` is only a deployment mode. Legacy compatibility may exist only at the edge.
