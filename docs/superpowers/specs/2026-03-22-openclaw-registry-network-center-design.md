# OpenClaw Registry Network Center Design

## Goal

Replace the current ecommerce-style `claw-center` with an OpenClaw registry and matchmaking surface that helps users discover, filter, and connect to OpenClaw agents or services at scale.

## Current Problem

The current `packages/sdkwork-claw-center` experience is modeled as a merchant marketplace:

1. The list page treats each item as a storefront with products, orders, and reviews.
2. The detail page is centered on goods and service cards instead of registry metadata and connection workflows.
3. The top-level actions are marketplace-oriented and do not help a user quickly join the OpenClaw network.
4. There is no first-class ACP command copy flow for handing a networking command to another agent.

This makes the product language and interaction model diverge from the intended "OpenClaw registry center" positioning.

## Desired Behavior

1. `claw-center` should feel like a registry of OpenClaw agents and services, not an ecommerce mall.
2. Users should be able to search a large catalog by keyword and narrow it by category.
3. Every registry entry should represent an OpenClaw subject or service with clear capability, endpoint, and matching metadata.
4. The top of the page should expose two direct actions:
   - one-click quick networking
   - copy ACP command for automated networking
5. The detail page should help a user decide whether an entry fits, then connect through a concrete command or route.

## Architecture

The redesign stays inside `packages/sdkwork-claw-center`.

- `ClawCenter.tsx` becomes the registry index page and owns only page state plus interaction wiring.
- `ClawDetail.tsx` becomes the registry subject detail page.
- `clawService.ts` becomes the registry data service and quick-connect resolver.
- New pure presentation helpers under `src/services/` or `src/pages/` handle search, category ordering, spotlight selection, and command generation so they can be tested without React.
- Existing platform services from `@sdkwork/claw-infrastructure` remain the source for local OpenClaw instance detection and quick-connect routing.

## Data Model

Each registry entry should expose:

- identity: `id`, `name`, `slug`, `kind`
- discovery: `category`, `summary`, `description`, `tags`, `searchTerms`
- trust and scale: `verified`, `region`, `latency`, `activeAgents`, `matchCount`
- capability: `capabilities`, `serviceModes`, `bestFor`, `integrations`
- connection: `gatewayUrl`, `websocketUrl`, `authMode`, `defaultSession`, `commandTemplate`

This preserves mock-backed development today while giving the page a model that matches future registry APIs.

## Interaction Model

### Registry Index

The list page should have four layers:

1. Compact registry hero with title, short product positioning, search, and top networking actions.
2. Quick status strip showing whether the local workspace already has an OpenClaw instance that can be used for one-click networking.
3. Category navigation that behaves like a registry taxonomy, not an ecommerce menu.
4. Result cards that emphasize:
   - what the entry does
   - what it is best for
   - how widely used or matched it is
   - whether it supports direct ACP networking

### Entry Detail

The detail page should be split into operational sections:

- overview
- capability and matching notes
- connection profile
- access and command copy

It should no longer show products, orders, or commerce review framing.

## Quick Networking

The best default "one-click quick networking" action should use real local workspace state:

1. If a gateway-ready OpenClaw instance exists locally, set it as the active chat instance and navigate to `/chat`.
2. If an OpenClaw instance exists but needs attention, navigate to that instance detail page.
3. If no OpenClaw instance exists, navigate to the OpenClaw install flow.

This keeps the CTA real instead of decorative.

## Command Copy

The ACP copy flow should generate a concrete `openclaw acp` command using the chosen registry entry's connection profile.

The default command shape is:

- `openclaw acp --url <websocket-url> --token <token-or-placeholder> --session <session-key>`

When a token is not meant to be exposed, the command should use a placeholder that is safe to hand off to another agent.

## Error Handling

1. If registry data fails to load, show a lightweight registry-specific error state.
2. If the local quick-connect state cannot be resolved, keep the registry page usable and downgrade the CTA to install/open-instance fallback.
3. If command copy fails, show an inline failure state and preserve the command text for manual copy.

## Testing

Add pure-function tests for:

1. category derivation and preferred ordering
2. keyword and category filtering
3. spotlight or featured entry selection
4. quick-connect route resolution
5. ACP command generation from registry connection metadata

## Non-Goals

1. No backend registry API integration in this pass
2. No marketplace transaction or payment model
3. No rewrite of `claw-upload`; it remains the local OpenClaw registry view
