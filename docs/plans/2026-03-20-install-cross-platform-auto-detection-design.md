# Install Cross-Platform Auto-Detection Design

**Context**

The current `Install Claw` page already inspects each install profile, but the page still asks users to manually compare long cards and infer which path fits their machine. That makes the core job of the page, installing the selected product, feel secondary to the surrounding detail.

The repo already exposes richer runtime signals than the page currently uses:

- host operating system and architecture through `RuntimeInfo`
- install readiness through `inspectHubInstall`
- runtime suitability through `HubInstallAssessmentResult.runtime`
- command and dependency availability through `commandAvailability`, dependency status, and issues

The missing piece is a deterministic recommendation layer that turns those signals into a first-screen decision.

**Goals**

- Turn platform detection into a visible first-class feature on the install page.
- Automatically recommend the best install path for the current machine.
- Prefer actionable install paths over blocked-but-theoretically-preferred paths.
- Surface blockers and remediation needs before the user scrolls into secondary content.
- Preserve the existing install wizard and lifecycle tabs while improving the install decision funnel.

**Non-Goals**

- Replace the existing hub-installer contract.
- Remove product selection or collapse uninstall and migrate into the same experience.
- Add new backend capability probes beyond what the platform already returns.
- Rewrite the guided install wizard into a different multi-step flow.

**Recommendation**

Add a small install recommendation service inside `sdkwork-claw-install` that converts host OS, architecture, install assessments, and runtime capability signals into:

- one primary recommended install path
- ordered secondary paths
- fix-first paths
- platform capability badges
- a short first-screen readiness summary

Then rebuild the install tab around that result:

1. product selection
2. auto-detection summary
3. featured recommended install card
4. secondary install paths
5. fix-first or blocked paths
6. detailed briefing and prerequisites

## 1. Decision Model

Each install choice is classified into one of these presentation states:

- `installed`
- `ready`
- `setupNeeded`
- `fixFirst`
- `checking`
- `comingSoon`

The recommendation algorithm must:

1. ignore unsupported and disabled paths for primary recommendation
2. prefer already-installed paths first
3. prefer ready or setup-needed paths over fix-first paths
4. break ties with product-level preferred paths and platform affinity

Platform affinity should account for:

- Windows:
  - prefer `wsl` when WSL is available and the profile is actionable
  - otherwise prefer `docker` when Docker is available and actionable
  - otherwise prefer `npm` or `pnpm`
- macOS / Linux:
  - prefer package-manager installs when actionable
  - otherwise prefer `docker`
  - otherwise fall back to `source`
- source-only products:
  - keep `source` primary and use readiness state only to adjust the call to action

## 2. First-Screen Information Architecture

The first screen should answer four questions in order:

1. Which product am I installing?
2. What did the app detect about my machine?
3. What is the best install path right now?
4. If that path is blocked, what do I need to fix?

The install tab should become:

- product switcher
- platform detection summary card
- recommended install hero card
- other install methods grid
- fix-first methods section when applicable
- lower-priority briefing block with prerequisites and rationale

This reduces the amount of scrolling required before the main action is visible.

## 3. Detection Summary

The detection summary should show:

- host OS
- architecture
- effective runtime preference for the recommended path
- WSL availability on Windows
- Docker availability
- Node.js availability for package-manager paths
- count of ready paths
- count of fix-first paths

This card should be concise and visual so users understand the recommendation without reading full assessment details.

## 4. Recommended Install Hero

The recommended card should be visually dominant and include:

- recommendation badge
- install method name
- one-sentence recommendation reason
- readiness status
- top blocker or next step
- resolved install root preview when available
- primary CTA to start guided install
- secondary hint describing what the installer will do

When the recommended path is blocked, the CTA should stay on the recommended path but clearly communicate that prerequisites must be fixed first.

## 5. Secondary And Fix-First Paths

Secondary paths should remain accessible, but they must be visually subordinate to the recommended hero.

Fix-first paths should be grouped separately when they contain blockers, so the page does not present them as equivalent to working options.

Each non-primary card should show:

- method name
- short description
- readiness state
- compact dependency summary
- guided install CTA

## 6. Testing Strategy

The recommendation service should be covered with direct unit tests for:

- Windows preferring WSL when WSL is available
- Windows falling back to Docker when WSL is blocked
- macOS / Linux preferring package-manager installs when actionable
- source-only products keeping source as primary
- blocked choices being moved behind actionable choices

UI verification should confirm:

- the first screen shows the recommended card without scrolling
- blocked paths are separated from actionable ones
- platform signals appear correctly for Windows, macOS, and Linux scenarios
