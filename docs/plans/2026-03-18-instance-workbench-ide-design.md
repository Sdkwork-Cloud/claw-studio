# Instance Workbench IDE Design

## Context

The current instance workbench successfully exposes the seven OpenClaw runtime surfaces, but it still behaves like a polished dashboard page rather than a true runtime workspace.

The user now wants the detail screen to feel larger, denser, and more professional:

- use the maximum practical content width
- present channels, cron tasks, agents, skills, memory, and tools as row-based operational lists instead of card mosaics
- transform files into an IDE-style workspace with a left file explorer and a right editor surface
- support file preview and editing through a VS Code-class editing experience

## Options Considered

### Option A: Keep the current card-based workbench and only widen the page

Pros:
- Smallest code delta
- No new dependencies

Cons:
- Does not solve the product problem
- Still feels like a dashboard instead of a serious operator workspace

### Option B: Convert lists to row layouts and build a native textarea-based file editor

Pros:
- No heavy editor dependency
- Easier to implement quickly

Cons:
- Falls short of the user request for a VS Code-grade editor
- Harder to reach a professional code-editing experience

### Option C: Convert lists to row layouts and upgrade files into a Monaco-powered IDE workspace

Pros:
- Uses the same editor core as VS Code
- Best match for the product request
- Gives the files section a credible professional feel

Cons:
- Adds editor dependencies
- Requires more careful layout design and state handling

## Decision

Choose Option C.

## Product Design

### Overall Layout

`InstanceDetail` should stop constraining itself to a centered max-width page shell. It should use the available routed canvas width so the experience feels more like a professional desktop workspace.

### Section Presentation

The operational sections should be rendered as row lists with strong hierarchy:

- primary identity on the left
- secondary metadata in the middle
- state badges and key metrics on the right

This keeps dense information scannable and closer to how infrastructure tools present runtime surfaces.

### Files Workspace

The files section becomes a two-pane IDE surface:

1. Left explorer
- grouped by file category
- shows file name, status, and path context
- selecting a file opens it in the editor pane

2. Right editor
- Monaco editor for editable files
- readonly preview mode for generated or restricted artifacts
- top file tab/header with path, badges, and save action

The goal is not to copy all of VS Code, but to borrow the parts that communicate seriousness and clarity:

- explorer tree
- active file state
- code editor chrome
- line numbers, syntax, minimap, and consistent file typography

## Architecture

### Runtime Data

The infrastructure mock should expand file support from metadata-only into editor-ready runtime files by adding:

- `content`
- `language`
- `isReadonly`

It should also expose an update method for persisted edits.

### Feature Layer

`sdkwork-claw-instances` remains the owner of the workbench presentation. The page can read and write through shared services, but should not import package-internal code from other features.

## Testing Strategy

Before implementation:

- add failing contracts for full-width layout and IDE-style files workspace
- add a failing infrastructure test for file content editing persistence

After implementation:

- run the focused infrastructure and instance contracts
- run `pnpm lint`
- run `pnpm build`
- run `pnpm check:desktop`
