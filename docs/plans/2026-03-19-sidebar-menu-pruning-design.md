# Sidebar Menu Pruning Design

**Date:** 2026-03-19

## Goal

Trim placeholder navigation entries from the user-facing sidebar surfaces without removing their backing routes.

## Scope

- Remove `codebox` and `api-router` from the settings center left navigation.
- Remove `codebox` from the global sidebar.
- Keep the `api-router` entry in the global sidebar.
- Do not remove routes, command palette commands, or placeholder pages.

## Approach

The change stays at the navigation-definition layer. We will update the settings tab list in `@sdkwork/claw-settings`, the global sidebar configuration in `@sdkwork/claw-shell`, and the legacy exported sidebar in `@sdkwork/claw-core` so both active and fallback sidebar implementations stay aligned.

Because the repository already uses source-level contract tests for package structure and navigation expectations, we will encode the new menu expectations there first and then update the implementation to satisfy them.

## Behavior Notes

- Navigating to `/settings?tab=codebox` or `/settings?tab=api-router` should continue to fall back to the general settings tab because those tab ids will no longer exist in the settings tab list.
- `/codebox` and `/api-router` routes remain reachable by direct navigation or command palette actions.

## Testing

- Update the `sdkwork-claw-settings`, `sdkwork-claw-shell`, and `sdkwork-claw-core` contract tests to reflect the new menu structure.
- Run the targeted contract tests after the implementation change.
