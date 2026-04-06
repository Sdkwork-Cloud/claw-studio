# Claw Studio Wrapper Cleanup Design

## Goal
- Remove internal feature-package wrapper usage that no longer adds business value.
- Keep the current UI, styles, routes, and behavior unchanged.
- Preserve the required `components/pages/services` directory boundary in every feature package.

## Scope
- Replace feature-page imports of `Modal` and `RepositoryCard` wrappers with direct imports from `@sdkwork/claw-studio-shared-ui`.
- Replace feature-page imports of `types.ts` pass-through files with direct imports from `@sdkwork/claw-studio-domain`.
- After internal page imports are cleaned, remove file-level wrapper shells such as `components/Modal.tsx`, `components/RepositoryCard.tsx`, and local `types.ts` pass-through files.
- Keep feature `services` wrappers in place because they still represent the package-level business boundary required by the repository architecture.

## Options Considered

### Option A: Direct page imports to source packages
- Pages import shared UI from `@sdkwork/claw-studio-shared-ui`.
- Pages import domain types from `@sdkwork/claw-studio-domain`.
- Feature wrapper files may remain for compatibility, but internal pages stop depending on them.
- Result: smaller internal dependency graph with no UI risk.

### Option B: Delete all wrapper files now
- Removes wrapper files and updates every import.
- Result: cleaner end state, but higher risk if any package consumer still relies on the wrapper exports.

### Option C: Keep all wrappers as-is
- No code churn.
- Result: feature packages still contain fake indirection with no architectural value.

## Selected Approach
- Use Option A.
- This gives a measurable architecture improvement while keeping compatibility and avoiding unnecessary churn.
- The implementation can happen in two phases:
- Phase 1: page imports point to real shared packages.
- Phase 2: delete the now-unused file-level wrapper shells and keep only package-level re-export surfaces where still useful.

## Constraints
- Do not move or rewrite page logic.
- Do not change route composition in `@sdkwork/claw-studio-web`.
- Do not remove empty `src/store` directories yet because the current environment does not allow safe directory cleanup through the shell.
