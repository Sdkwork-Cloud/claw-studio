# OpenClaw Guided Install Design

**Context**

The current `Install Claw` experience already covers product selection, environment assessment, install execution, uninstall, and migration. What it does not yet do well is help a user go from "I want OpenClaw" to "OpenClaw is installed, configured, initialized, and verified" in one coherent journey.

Today the OpenClaw path is still split across several surfaces:

- install readiness and execution live inside the install modal
- model and provider configuration live in the instance workbench and provider center surfaces
- channel configuration lives in the channels page
- skills initialization lives in the market

This makes the first-run experience feel technically rich but operationally incomplete. The requested improvement is to turn OpenClaw install into a guided step-by-step flow that handles the whole bootstrap path:

1. install dependencies or tools
2. install OpenClaw
3. configure OpenClaw
4. initialize OpenClaw with default and optional skills/packages
5. verify and report success

**Goals**

- Turn the OpenClaw install action into a guided five-step onboarding flow.
- Keep the product-first install page shell intact while upgrading the OpenClaw install interaction.
- Reuse existing infrastructure, channels, provider-center, instance, and market data capabilities without breaking package boundaries.
- Ensure each step has clear readiness logic, validation, and recovery paths.
- Let users finish with a real "ready to use" state, not just a completed installer command.

**Non-Goals**

- Rebuild uninstall or migrate into the same wizard in this iteration.
- Introduce new backend installer APIs beyond the current hub-installer bridge.
- Make this first version generic for `zeroclaw` or `ironclaw`.
- Replace existing settings, channels, market, or provider-center pages. They remain advanced destinations.

**Approaches Considered**

1. Full-page wizard that replaces the whole install workspace
   Tradeoff: strong focus, but too disruptive. It would rewrite more of the current lifecycle page than needed and would complicate coexistence with uninstall and migrate.

2. OpenClaw-specific guided install modal layered on top of the current product-first page
   Tradeoff: slightly more conditional UI logic, but it preserves the page shell, keeps the install action contextual, and limits the blast radius.

3. Keep the current install modal and only append post-install recommendations
   Tradeoff: lowest cost, but it still leaves configuration, initialization, and verification fragmented.

**Recommendation**

Use approach 2. Keep the current page as the lifecycle console, but make the OpenClaw install action open a large guided wizard that executes the five-step bootstrap flow end to end.

## 1. Information Architecture

The install page continues to do three things:

- let users choose a product
- let users choose a lifecycle mode
- let users choose an install method

The OpenClaw install method CTA changes from "open a generic execution modal" to "start guided install". The guided install overlay owns the complete OpenClaw bootstrap journey.

The wizard structure is:

1. Dependencies
2. Install OpenClaw
3. Configure OpenClaw
4. Initialize OpenClaw
5. Verify

Each step shows:

- current status
- what is required
- what has already been completed
- the primary action for that step

## 2. Step Model

Each wizard step has a stable state:

- `pending`: not reached yet
- `ready`: actionable now
- `running`: currently executing
- `completed`: finished successfully
- `warning`: skipped or incomplete but the flow may continue
- `blocked`: cannot proceed until prerequisites are resolved

Progression rules:

- Step 1 gates step 2 when the assessment has blocking errors.
- Step 2 must succeed before steps 3, 4, and 5 are actionable.
- Step 3 and step 4 may be skipped, but step 5 must reflect whether the result is "installed only" or "ready to use".
- Step 5 computes the final completion grade from previous step outcomes.

## 3. Step 1: Dependencies

This step is powered by the existing `inspectHubInstall` result.

The step presents:

- runtime summary
- install root and data root preview
- dependency list grouped by status:
  - available
  - remediable
  - unsupported or missing
- issue summary:
  - blockers
  - warnings
  - recommendations

Decision logic:

- If assessment has any `error` severity issue, the step is `blocked`.
- If there are no blockers, the step is `completed` once the user confirms they reviewed the environment.
- Warnings do not stop the flow, but they remain visible through step 5.

Interaction notes:

- Keep copy and manual-fix actions for remediation commands.
- Do not fake auto-remediation that the product runtime cannot actually perform.

## 4. Step 2: Install OpenClaw

This step is the existing `runHubInstall` execution, but isolated as its own phase.

The step shows:

- chosen install method
- live terminal output
- running status
- resolved install root, data root, and work root when available
- stage and artifact completion summary after execution

Decision logic:

- `runHubInstall` success marks the step `completed`.
- Failure keeps the step `ready` for retry and marks step 5 as blocked.

## 5. Step 3: Configure OpenClaw

This step should complete the minimum viable runtime setup inside the wizard instead of sending the user away.

The step contains two configuration zones:

- model access
- channels

### 5.1 Model access

Inputs:

- target instance
- provider selection from existing compatible proxy providers
- inferred default model
- inferred reasoning model
- inferred embedding model

Behavior:

- default to the active instance when available, otherwise first online instance
- list only providers compatible with OpenClaw bootstrap (`openai` and `anthropic` compatibility)
- infer model roles from provider models
- allow users to override inferred model selections before applying

Apply behavior:

- upsert an OpenClaw LLM provider onto the selected instance
- mark the provider `configurationRequired` if key/source information is missing
- expose a deep link to advanced tuning in the instance workbench or provider center

### 5.2 Channels

Inputs:

- multi-select channel list
- inline configuration fields for selected channels

Behavior:

- preselect disconnected but partially usable channels only when they already have values
- require non-empty values for all configured fields before saving a selected channel
- save each selected channel through the existing mock/runtime channel save path
- allow leaving channels unconfigured without blocking installation completion

This keeps the wizard honest: channels are recommended setup, not a hard requirement for the software to run.

## 6. Step 4: Initialize OpenClaw

This step uses skills and skill packages as first-run bootstrap materials.

The step contains:

- recommended starter packs
- optional additional packs
- optional additional individual skills
- default pack preselection when a recommended pack exists

Behavior:

- users can select multiple packs and multiple skills
- duplicate skills are deduplicated before installation
- package installation installs the whole pack
- extra individual skills install on top of selected packs

The target instance is inherited from step 3 to avoid re-asking.

## 7. Step 5: Verify

This step reports whether the install is merely completed or truly ready.

Verification checklist:

- install command succeeded
- OpenClaw target instance selected
- at least one LLM provider is configured and ready on the target instance
- selected channels were saved successfully
- selected packs and skills were installed successfully

Completion outcomes:

- `Ready to use`: install succeeded and model access is configured
- `Installed with follow-up needed`: install succeeded but configuration or initialization is incomplete
- `Blocked`: install failed

The step also includes quick next actions:

- open instances
- open market
- open channels
- open provider center

## 8. Data Flow And Boundaries

To preserve the declared dependency flow, the install package must not import feature-local services from `market`, `channels`, `settings`, or `instances`.

The wizard should instead use:

- `installerService` from infrastructure for assessment and install execution
- `studioMockService` from infrastructure for instances, proxy providers, channels, skills, and packs
- local install-package orchestration services for:
  - choosing defaults
  - validating wizard input
  - applying configuration
  - applying initialization
  - building verification summaries

Any shared inference logic needed by both install and the provider center should be moved to a neutral service if duplication becomes painful. For this iteration, the install package may host its own tested inference logic to avoid a broad refactor.

## 9. Error Handling

- Dependency blockers stop progression to step 2.
- Install failures keep the wizard open with retry.
- Configuration apply failures stay local to step 3 and do not erase install success.
- Initialization failures stay local to step 4 and are surfaced again in step 5.
- Verification never throws. It summarizes status from the accumulated step results.

## 10. Testing Strategy

Contract coverage:

- extend `scripts/sdkwork-install-contract.test.ts` to require guided OpenClaw install markers and copy

Unit coverage:

- add a pure service test for wizard state computation and completion grading
- add a service test for OpenClaw configuration and initialization application

Workspace verification:

- `node --experimental-strip-types packages/sdkwork-claw-install/src/services/openClawInstallWizardService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-install/src/services/openClawBootstrapService.test.ts`
- `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`
- `pnpm lint`
- `pnpm build`
