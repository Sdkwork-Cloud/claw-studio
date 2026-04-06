# Claw Studio OpenClaw Kernel Platform Design

**Date:** 2026-03-27

## Goal

Define the target architecture for a product-grade `Claw Studio` that:

- ships with a default built-in `OpenClaw` runtime installed alongside the app
- supports free-form chat as a first-class product surface
- silently keeps the kernel available without terminal popups
- supports Windows, macOS, Linux, WSL, container, and remote-node topologies
- supports multiple installation modes, iterative upgrades, rollback, and cluster management
- preserves OpenClaw as the kernel while letting Claw Studio become the control plane

## Source Snapshot

This design is based on the local `claw-studio` workspace state on 2026-03-27 and the bundled OpenClaw `2026.3.24` runtime package currently shipped in the desktop resources.

Verified current upstream package facts on 2026-03-27:

- npm `latest`: `2026.3.24`
- npm `beta`: `2026.3.24-beta.2`
- bundled desktop runtime package version: `2026.3.24`
- bundled runtime Node engine requirement: `>=22.14.0`

Key OpenClaw documentation signals used in this design:

- OpenClaw is a self-hosted multi-channel Gateway; the Gateway is the single source of truth for sessions, routing, and channel connections.
- Cross-platform service management is already modeled upstream around platform-native daemon hosts.
- Multi-gateway operation requires explicit isolation for profile, state, config, and ports.
- Upgrade discipline is `update -> doctor -> restart -> health`, not naive in-place replacement.

## Current Claw Studio Findings

### Product surface

The current app already exposes a much larger surface than a simple chat shell:

- workbench routes: `chat`, `channels`, `tasks`, `dashboard`, `settings`
- operations surfaces: `install`, `instances`, `kernel`, `nodes`
- ecosystem routes: `market`, `agents`, `apps`, `extensions`, `community`, `github`, `huggingface`

The current instance detail page is already OpenClaw-centric. It exposes:

- runtime summary and health
- channels
- cron tasks
- LLM providers
- agents
- skills
- files
- memory
- tools
- direct OpenClaw console access

This means the product is already converging toward "OpenClaw kernel + Claw Studio control plane", even if that boundary is not yet explicit in the architecture.

### Desktop integration reality

The current desktop startup path already activates bundled OpenClaw during Tauri setup and immediately starts the Gateway. This proves the built-in runtime is already treated as mandatory in practice.

However, the current state model is inconsistent:

- desktop startup behavior is effectively auto-start
- component metadata still labels `openclaw` as `Manual`

This mismatch must be corrected before lifecycle, upgrade, and cluster behavior can become reliable.

### Current architectural gaps

The current desktop architecture is still transitional:

- the Tauri app directly owns the OpenClaw child process
- Windows silent-start and service-host behavior are not yet finalized
- install topology, runtime ownership, upgrade provenance, and cluster control are spread across multiple packages instead of owned by one kernel platform model
- the current install experience models many install methods, but those methods are still UI-level choices rather than first-class runtime topologies

## Product Promise

The product promise for Claw Studio should be:

1. `Claw Studio` is a desktop and control-plane product.
2. `OpenClaw` is the default kernel that makes the product useful out of the box.
3. The default install is silent, built-in, and ready immediately after app installation.
4. Advanced users may swap topology, not lose management.
5. One control plane must govern local built-in runtimes, external runtimes, container runtimes, WSL runtimes, and remote nodes.

This design intentionally treats "free chat" and "kernel management" as one product, not two separate apps.

## Design Principles

### 1. Kernel-first product model

OpenClaw is not a plugin. It is the kernel. The app should behave as if the kernel is part of the product contract.

### 2. Control plane above runtime

Claw Studio should not embed business logic into OpenClaw internals. It should own:

- lifecycle
- topology selection
- upgrade orchestration
- rollback
- health and recovery
- node inventory and policy

### 3. One stable local control API

The frontend should never talk directly to the OpenClaw process model. It should talk to a stable local `Kernel Host API`.

### 4. Native service host per OS

Each OS should use its best native long-running host:

- Windows: Windows Service
- macOS: launchd LaunchAgent
- Linux desktop: systemd user service
- Linux server: systemd system service
- WSL: systemd inside WSL
- Containers: Quadlet/systemd or container runtime integration through the same host abstraction

### 5. Topology is first-class

Installation method is an implementation detail. The product-level abstraction is topology.

### 6. Roll-forward only with rollback safety

Built-in kernel upgrades must use slots and staged cutover, never destructive in-place mutation.

## Target Product Architecture

The target platform is split into six layers.

### 1. Claw Studio App

Responsibilities:

- chat UX
- dashboard and workbench UX
- install and topology UX
- node and cluster UX
- settings, logs, and diagnostics UX

Non-responsibilities:

- directly spawning the OpenClaw kernel
- directly owning port allocation
- directly writing service-manager registration

### 2. Kernel Host

This is the new runtime authority on each machine.

Responsibilities:

- install or repair service registration
- attach to existing kernel runtime if healthy
- start, stop, restart, and recover runtime
- reserve and publish the active endpoint
- expose a stable local IPC control API
- maintain active slot, candidate slot, rollback slot
- centralize health checks, doctor results, and crash-loop policy

### 3. Runtime Adapters

One adapter per topology:

- `bundled-native`
- `wsl-managed`
- `container-managed`
- `external-local`
- `remote-managed`
- `remote-attached`

Every adapter must implement the same control-plane contract:

- provision
- inspect
- attach
- ensure running
- stop
- restart
- upgrade
- rollback
- collect logs
- run doctor

### 4. Upgrade and Provenance Service

Responsibilities:

- version/channel tracking
- install provenance
- compatibility checks
- config migration
- slot cutover
- rollback safety

### 5. Cluster Control Plane

Responsibilities:

- node registration and inventory
- grouped policies
- remote operations
- version and drift tracking
- rollout orchestration

### 6. Shared Provider Control Plane

The local provider config center remains the shared provider and credential data plane, not the kernel lifecycle owner.

## Capability Model

Claw Studio should present three clear product domains.

### A. Workspace

User-facing AI functionality:

- free chat
- channels
- tasks and automation
- agent workbench
- dashboard

### B. Kernel

Single-node operational ownership:

- built-in runtime
- status
- logs
- ports and endpoint
- service host
- config and doctor
- upgrade and rollback

### C. Cluster

Multi-node ownership:

- local node
- remote nodes
- node groups
- rollout status
- compatibility matrix
- topology-specific policies

This removes the current ambiguity where `install`, `instances`, and runtime state are spread across mixed UI metaphors.

## Kernel Topology Model

The current install methods should be normalized into product-level topologies.

### Local managed native

Claw Studio bundles and manages OpenClaw locally using a platform-native service host.

Best default for:

- Windows native
- macOS native
- Linux native

### Local managed WSL

Windows desktop UX, but OpenClaw actually runs inside WSL2 with `systemd`.

Best for:

- users prioritizing compatibility over native Windows behavior
- users who want upstream-aligned Linux daemon semantics

### Local managed container

OpenClaw runs in Docker or Podman under Claw Studio control.

Best for:

- isolation
- lab setups
- server-style local deployments

### Local external

Claw Studio attaches to an already-installed local OpenClaw instance.

Best for:

- advanced users with existing manual installs
- partial-control environments

### Remote managed node

Claw Studio deploys and governs OpenClaw on a remote host.

Best for:

- VPS nodes
- home lab nodes
- long-running team nodes

### Remote attached node

Claw Studio discovers and attaches to an existing remote Gateway without taking full lifecycle ownership.

Best for:

- mixed environments
- imported clusters

## Platform Strategy

### Windows

Two first-class supported paths:

- `windows-native-bundled`
- `windows-wsl-managed`

Default recommendation:

- native bundled runtime with Windows Service for general desktop users

Advanced recommendation:

- WSL-managed topology for users prioritizing upstream-style Linux runtime semantics

Windows-specific requirements:

- no terminal window at startup
- no direct child-process ownership by the Tauri window process
- install-time firewall and permission repair path
- service recovery options enabled by default

### macOS

Default path:

- bundled runtime + launchd LaunchAgent

macOS-specific requirements:

- the app attaches to or repairs a LaunchAgent-owned runtime
- the app never acts as the long-term parent of the kernel process
- login-session availability should be explicit in UX

### Linux

Default desktop path:

- systemd user service

Default server path:

- systemd system service

Fallback path:

- temporary session supervisor only when systemd is unavailable

### WSL

WSL is treated as Linux for the actual kernel host, but is surfaced as a Windows topology in the product.

### Containers

Container topologies remain valid, but they are still governed through the same `Kernel Host` contract. The user should never be forced to manage container details from the general UI.

## CPU and Artifact Strategy

Claw Studio must ship or resolve the correct built-in artifact matrix:

- Windows x64
- Windows arm64
- macOS x64
- macOS arm64
- Linux x64
- Linux arm64

Artifact resolution rules:

- app installer contains the matching built-in runtime for the current OS/CPU pair when practical
- if a full runtime bundle is too large, the installer contains a verified bootstrap manifest and downloads the exact matching artifact before first launch completes
- the built-in runtime manifest remains the single source of truth for platform, architecture, Node version, OpenClaw version, and CLI path

## Kernel Host API

The frontend should use one stable API surface regardless of topology:

- `kernel.getStatus()`
- `kernel.ensureRunning()`
- `kernel.stop()`
- `kernel.restart()`
- `kernel.getEndpoint()`
- `kernel.getLogs()`
- `kernel.runDoctor()`
- `kernel.getUpgradeStatus()`
- `kernel.startUpgrade()`
- `kernel.rollback()`
- `kernel.listTopologies()`
- `kernel.switchTopology()`
- `cluster.listNodes()`
- `cluster.attachNode()`
- `cluster.upgradeNode()`

Transport:

- Windows: named pipe
- macOS/Linux: Unix domain socket

The UI should not depend on OpenClaw port numbers as its primary control channel.

## Runtime State Model

Two independent state planes are required.

### Topology state

- `unprovisioned`
- `provisioning`
- `installed`
- `attached`
- `drifted`
- `blocked`
- `upgrading`
- `rollback_ready`

### Runtime state

- `stopped`
- `starting`
- `running`
- `degraded`
- `recovering`
- `crash_loop`
- `failed_safe`

This prevents the current category error where install state, service state, and process state are all flattened into one label.

## Silent Startup And Recovery Model

Every startup should follow the same algorithm:

1. `attach-first`
   - if a healthy kernel already exists, attach instead of starting a second one
2. `repair-before-start`
   - repair service registration, paths, slots, or stale metadata before launch
3. `resolve-endpoint`
   - reuse previous active endpoint when valid
   - if externally occupied, allocate a new endpoint automatically
4. `health-gated-ready`
   - process spawn is not success
   - success requires status, health, and minimum doctor checks
5. `recover-or-quarantine`
   - repeated crashes trigger safe mode or node quarantine instead of infinite restart loops

## Port, Lock, and Multi-Instance Strategy

Claw Studio must stop treating a single hard-coded Gateway port as the core identity.

Rules:

- fixed identity comes from node and topology metadata, not the old port
- preferred port is advisory
- active port is authoritative
- stale lock repair is automatic
- multiple managed instances require isolated:
  - profile
  - state directory
  - config path
  - logs path
  - port family

The UI must always resolve the live endpoint from the kernel host, not from a constant.

## Upgrade And Rollback Design

OpenClaw upgrades must be slot-based.

Slots:

- `active`
- `candidate`
- `rollback`

Upgrade flow:

1. fetch or prepare candidate runtime
2. validate manifest and provenance
3. migrate config in candidate slot only
4. run `doctor` and health probes
5. cut over service host to candidate
6. verify runtime healthy
7. promote old active slot to rollback
8. mark candidate as active

If any post-cutover probe fails:

- stop candidate
- restore previous service binding
- reactivate rollback slot
- mark upgrade result as failed with diagnostics

## Provenance Model

Every node and runtime must track:

- runtime family
- install topology
- install provisioner
- install source
- installed version
- desired version
- channel
- Node version
- service-manager kind
- config schema version
- doctor capability version
- rollback availability
- control level (`managed`, `partial`, `attached`)

This is required for safe upgrades and honest UX.

## Cluster Design

Claw Studio should not pretend multiple Gateways are one runtime. It should operate as a cluster control plane over isolated nodes.

Node kinds:

- `local-primary`
- `managed-remote`
- `attached-remote`
- `rescue-node`

Each node publishes:

- identity
- topology
- version and channel
- runtime state
- health
- doctor status
- capability level
- drift state
- upgrade eligibility

Cluster responsibilities:

- inventory
- health overview
- rollout and rollback
- policy assignment
- grouped diagnostics

Cluster non-goals:

- merging multiple Gateway state stores into one
- inventing a new distributed runtime inside Claw Studio

## Security Model

### Built-in local defaults

- loopback-only bind by default
- local control API separate from public Gateway API
- service-owned secrets, never shell-shim-owned secrets
- install-time permission or firewall setup where needed

### Remote node rules

- attached nodes are lower trust than managed nodes
- remote exposure state must be explicit
- remote node identity should be pinned and versioned

### Recovery and safe mode

Safe mode must:

- start a minimal runtime
- disable risky extensions or public exposure until repaired
- keep logs and diagnostics accessible

## Product Information Architecture

The current route map should be reorganized into these top-level centers.

### 1. Workspace

- Chat
- Channels
- Tasks
- Dashboard

### 2. Kernel Center

- Local kernel status
- Topology
- Runtime
- Config
- Logs
- Upgrade
- Doctor

### 3. Nodes

- Local node
- Remote nodes
- Health
- Drift
- Attach/import

### 4. Cluster Center

- Node groups
- Rollouts
- Policies
- Compatibility matrix

### 5. Ecosystem

- Market
- Agents
- Apps
- Extensions
- Docs

This keeps user-facing AI work separate from kernel governance.

## Delivery Strategy

### Phase 1: Kernel foundation

- formalize kernel host contract
- fix current auto-start/manual-state mismatch
- add silent service-host ownership for the built-in topology
- make endpoint allocation authoritative in the host layer

### Phase 2: Built-in native topology

- finalize Windows Service host
- add macOS launchd host
- add Linux systemd host
- move the desktop app to attach-first behavior

### Phase 3: Topology and upgrade platform

- normalize install methods into topology records
- add provenance tracking
- implement slot-based upgrade and rollback

### Phase 4: Cluster control plane

- node inventory
- attach/import flows
- remote managed node operations
- grouped health and upgrade rollouts

### Phase 5: Product IA convergence

- reorganize routes and settings into kernel and cluster centers
- align install and instance UX with topology and node semantics

## Non-Goals

This design does not:

- replace OpenClaw internals with Claw Studio logic
- invent a new distributed OpenClaw runtime
- flatten all advanced topologies into one naive built-in flow
- assume the current Tauri process-supervisor implementation is the long-term control plane

## Success Criteria

The target architecture is achieved when:

- Claw Studio installs with a built-in OpenClaw kernel by default
- startup is silent on every supported OS
- the desktop UI attaches to a kernel host, not a transient child process
- built-in runtime support covers supported OS and CPU targets
- advanced install paths remain supported through the same governance model
- upgrades are slot-based and rollback-safe
- cluster management uses the same node and topology model as local management
- free chat remains first-class while kernel and cluster operations become explicit product domains
