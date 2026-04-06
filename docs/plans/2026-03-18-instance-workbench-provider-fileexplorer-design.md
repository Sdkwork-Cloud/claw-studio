# Instance Workbench Provider And File Explorer Design

**Context:** The current instance detail page already exposes runtime sections and a Monaco-based file editor, but the files surface is still category-grouped instead of directory-first, and the page lacks a first-class LLM provider configuration workspace.

## Product Decisions

### 1. Files become a real explorer

The files area should behave like a professional IDE explorer rather than a grouped asset list. We will derive a nested tree from each runtime file path, render folders and files in hierarchy order, support expand/collapse, and keep the active file visible with path-aware highlighting. The editor stays on the right, so the page becomes an operator-grade runtime workspace instead of a file preview list.

### 2. Remove the extra workbench intro chrome

The “Instance Workbench / Switch between...” explainer in the sidebar adds visual weight without helping task completion. We will remove that card and let the left rail focus on section navigation only.

### 3. Add a first-class LLM Providers section

Instance detail should expose the runtime’s available LLM providers as a core control surface. Each provider entry will show provider health, endpoint, active/default model routing, available models, and the key inference parameters operators care about. Selecting a provider opens a dedicated configuration panel on the right for editing endpoint, credential source label, default routing, and primary generation parameters.

## Chosen Approach

### Recommended

Represent LLM provider state as instance-native runtime data in `sdkwork-claw-infrastructure`, map it into the `instanceWorkbenchService`, and render it with a dedicated `InstanceLLMConfigPanel` component in `sdkwork-claw-instances`. Build the file explorer tree on the feature page from runtime file paths so infrastructure remains responsible for file records, not view-specific tree nodes.

### Alternatives Considered

1. Keep provider configuration inside `sdkwork-claw-settings` and embed it into instance detail.
   This was rejected because it would couple one feature package to another and violate the repo’s layering guidance.

2. Store a fully materialized file tree in infrastructure.
   This was rejected because the runtime only owns flat file records. Tree shape is presentation logic and should stay in the feature layer.

## UX Shape

- Left rail: section-only navigation, no extra explainer card.
- Files: left nested explorer tree, right Monaco preview/editor.
- LLM Providers: left provider list with model and parameter summaries, right configuration editor for the selected provider.
- Both workspaces should use broad width and dense, flat, professional chrome aligned with the existing shell.

## Testing Strategy

- Contract test for new workbench section and explorer/config panel markers.
- Infrastructure persistence test for provider config updates.
- Existing file edit persistence test remains in place.
- Full `pnpm lint`, `pnpm build`, and `pnpm check:desktop` verification after implementation.
