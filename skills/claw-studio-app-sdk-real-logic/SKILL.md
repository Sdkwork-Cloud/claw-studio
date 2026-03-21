---
name: claw-studio-app-sdk-real-logic
description: Guides Claw Studio onto generated app SDK contracts. Use when integrating or repairing apps/claw-studio remote business modules so they consume spring-ai-plus-app-api instead of @sdkwork/claw-infrastructure raw HTTP, or when a missing contract must be closed end to end before the app can ship.
---

# Claw Studio App SDK Real Logic

## Overview

Drive `apps/claw-studio` to one remote-business path:

`host / feature package / store -> shared app-sdk wrapper -> @sdkwork/app-sdk -> spring-ai-plus-app-api -> backend`

Keep Tauri, filesystem, process, and device work on native boundaries. Route only remote business capability through the generated app SDK. If a method is missing, close the backend/OpenAPI/generator gap first, then return and delete the workaround.

Treat every round as a recursive closure loop: self-review the touched app or client code, decide whether the next fix belongs in app or frontend code, backend or service code, or generator inputs, regenerate the SDK when contracts move, then review again until no higher-value gap remains.

## Progressive Loading

- Start with this file only.
- Load `references/architecture-map.md` only when boundary ownership or wrapper placement is unclear.
- Load `../../../SDK_INTEGRATION_STANDARD.md` only when client lifecycle, env keys, or token rules matter.
- Load `../../prompt/execute.md` or `../../AGENTS.md` only when app workflow or scripts are unclear.
- Load `references/verification.md` only before claiming the round is complete.

## Hard Rules

- Use `spring-ai-plus-app-api` as the single contract source for remote business capability.
- Use `spring-ai-plus-app-api/sdkwork-sdk-app/sdkwork-app-sdk-typescript` as the only shared TypeScript SDK source and consume it through `@sdkwork/app-sdk`.
- If the shared wrapper is incomplete, finish it in the approved core layer before editing feature packages.
- Keep Tauri, local files, shell commands, and device adapters out of the app SDK path.
- Replace `@sdkwork/claw-infrastructure` business HTTP with the wrapper path. Do not add raw `fetch`, generic HTTP helpers, manual auth headers, mock branches, or app-local SDK forks.
- Never hand-edit generated SDK output. Fix backend or generator inputs, then regenerate.
- Any table, column, index, migration, or embedded DB schema change requires user confirmation first.

## Default Loop

1. Classify the target as remote-business, local-native, or mixed.
2. Audit for raw HTTP, duplicated DTO mapping, manual headers, mock branches, or stale infrastructure shortcuts.
3. Verify the real generated SDK export and the shared wrapper surface.
4. If the method exists, refactor to the standard wrapper path and delete the bypass.
5. If the method is missing, close the gap in `spring-ai-plus-app-api` and backend modules, regenerate the SDK, then finish the app integration.
6. If gap closure needs any schema change, stop and ask the user before touching DB structure.
7. Self-review the touched path. If a better next fix still belongs in app or frontend code, backend or service code, generator inputs, or adjacent cleanup, keep iterating instead of stopping at the first pass.
8. Run verification, then rescan adjacent packages and one extra global pass.

## Red Flags

- `@sdkwork/claw-infrastructure` business HTTP for app APIs
- raw `fetch(`, `axios.`, or generic HTTP helpers
- manual `Authorization` or `Access-Token` assignment
- app-local SDK forks, DTO shims, or unapproved schema edits

## Completion Bar

- Remote business modules use the shared wrapper and generated app SDK.
- Local-only features still stay on the correct native boundary.
- No raw HTTP, manual header, mock bypass, or temporary fallback remains.
- Missing contracts are closed in backend/OpenAPI/generator inputs, and no schema change happened without approval.
- Relevant package checks, builds, and host verification pass.
