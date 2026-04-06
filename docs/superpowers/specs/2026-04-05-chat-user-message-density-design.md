# Chat User Message Density Design

## Goal

Tighten the main chat page user message presentation so outgoing bubbles feel less padded and sit closer to the right edge without changing assistant message layout or broader chat architecture.

## Current Problem

The main chat page in `packages/sdkwork-claw-chat` makes user messages feel too loose on desktop.

1. `packages/sdkwork-claw-chat/src/components/ChatMessage.tsx` applies the same rail padding to both assistant and user messages with `px-4 sm:px-6 lg:px-8`, which leaves an overly large right inset for right-aligned user bubbles.
2. The same user bubble uses `px-4 py-2`, which makes short outgoing messages feel visually thick relative to the message content.
3. `packages/sdkwork-claw-chat/src/pages/Chat.tsx` mirrors the same rail padding in the grouped footer metadata row, so changing only the bubble would leave the footer alignment behind.

## Desired Behavior

1. User messages on the main chat page render closer to the right edge.
2. User message bubbles use tighter internal padding so short messages feel denser and cleaner.
3. Assistant message rail spacing remains unchanged.
4. Footer metadata under grouped user messages stays horizontally aligned with the updated user message rail.

## Architecture

This is a scoped chat layout polish inside `@sdkwork/claw-chat`.

- `ChatMessage.tsx` owns the per-message rail and bubble density.
- `Chat.tsx` owns the grouped footer alignment under each message group.
- `chatMessageLayout.test.ts` remains the regression guard for the layout contract.

No data flow, store behavior, or transport code changes are required.

## Design Decisions

### User-Only Rail Tightening

Keep assistant message rail classes untouched and split the outer rail spacing for user messages into a tighter right inset.

Recommended shape:

- assistant rail keeps `px-4 sm:px-6 lg:px-8`
- user rail keeps the left inset but reduces the right inset by one step on each breakpoint

This directly addresses the "too far from the right side" complaint without shifting assistant layout.

### Bubble Density Adjustment

Reduce user bubble padding slightly rather than aggressively shrinking the bubble.

Recommended direction:

- horizontal padding drops from `px-4` to `px-3.5`
- vertical padding drops from `py-2` to `py-1.5`

This is enough to make short messages feel cleaner while keeping wrapped text readable.

### Footer Alignment Parity

The grouped footer row under user message clusters should reuse the same tighter user rail inset as the message body.

That keeps:

- sender label
- timestamp
- model label

visually aligned with the outgoing bubble edge.

## Testing

Use `packages/sdkwork-claw-chat/src/components/chatMessageLayout.test.ts` as the regression suite.

The change should follow TDD:

1. update the layout expectations first
2. run the targeted test and confirm failure
3. implement the class changes
4. re-run the targeted test and confirm pass

## Risks

1. Over-tightening the user rail could make the layout feel cramped on narrow screens.
2. Changing only the bubble or only the footer would create noticeable alignment drift.

The implementation should stay conservative and only adjust user-specific spacing.
