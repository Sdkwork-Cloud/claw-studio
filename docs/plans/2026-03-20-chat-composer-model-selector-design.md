# Chat Composer Model Selector Design

## Context

`@sdkwork/claw-chat` currently keeps model selection in the top header while the composer at the bottom only owns draft input and send controls. That split creates two UX problems:

1. The user's main decision loop lives in two distant surfaces: write below, choose model above.
2. Model switching during drafting feels fragile because the active model is visually disconnected from the draft the user is composing.

The requested polish pass should make the composer feel like the true control surface for a conversation while preserving the current runtime semantics:

- changing model during a draft must never clear the draft
- changing model during generation must not interrupt the in-flight response
- the newly selected model should apply to the next message only

## Options Considered

### Option A: Keep the top selector and mirror the current model near the composer

Pros:
- Lowest implementation risk
- Minimal structural change

Cons:
- Leaves duplicate model surfaces
- Does not solve the user's explicit request
- Keeps the interaction hierarchy weak

### Option B: Move the full model selector into the composer bottom rail

Pros:
- Puts message intent and model choice in the same place
- Makes switching model while drafting feel direct and predictable
- Lets the top header become lighter and less distracting

Cons:
- Requires composer layout refactor
- Needs careful dropdown positioning and status messaging

### Option C: Replace the selector with a modal or side sheet launched from the composer

Pros:
- Plenty of room for channel/model detail
- Easy to scale if the provider list grows

Cons:
- Too heavy for a frequent interaction
- Adds extra steps to a high-frequency action

## Decision

Choose Option B.

The composer becomes the single place where the user decides:

1. what to ask
2. which model should answer
3. whether to stop generation or send the next prompt

## Product Design

### Layout

- Remove the model selector from the top header.
- Keep agent and skill controls in the header for now, since the request is specifically about model choice and the composer should not become overloaded.
- Rebuild the composer as a layered card:
  - top: textarea
  - bottom rail: utility actions, model selector, generation status hint, send/stop control

### Composer Model Selector

- The selector lives in the bottom rail and shows channel icon plus model name.
- The dropdown opens upward from the composer so it stays visually tied to the draft and avoids collision with the viewport bottom.
- The dropdown keeps the two-column channel/model structure from the current header because it already supports provider-first navigation well.

### Interaction Rules

- Draft text stays untouched when the user changes channel or model.
- Focus returns to the textarea after model selection so the user can continue typing immediately.
- If a response is generating and the user changes the selected model, the current response continues unchanged.
- While generation is active, the composer shows a hint that the current response is using the previous model and the newly selected model will be used for the next message.

### Visual Polish

- Tighten the header so the page feels calmer and gives more attention to the conversation body.
- Give the composer a more intentional surface with clearer focus, stronger bottom rail separation, and a more product-grade control hierarchy.
- Make the send button feel more responsive without introducing noisy animation.

## Architecture

- Keep all behavior in `@sdkwork/claw-chat`.
- Extract the "current response model vs next selected model" logic into a small pure helper so the semantics are testable without a React harness.
- Pass model-selection props from `Chat.tsx` into `ChatInput.tsx`; avoid leaking chat business logic into host packages.

## Testing Strategy

Before implementation:

1. Add a contract test that fails while `Chat.tsx` still owns a top-level model dropdown.
2. Add a helper test that fails until composer model-state semantics are encoded in a pure function.

After implementation:

1. Re-run the helper test.
2. Re-run the chat contract test.
3. Run `pnpm build` to catch type or composition regressions.

## Success Criteria

- Model selection is controlled from the composer bottom rail.
- Switching model during drafting never clears the draft or leaves focus stranded.
- Switching model during generation does not interrupt the current reply.
- The UI clearly communicates when the selected model applies to the next message instead of the in-flight one.
