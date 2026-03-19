# Install Claw Visual Focus Redesign

**Context**

The current `Install Claw` page has functional coverage for install, uninstall, and migrate, but the visual hierarchy is fighting the primary task. The oversized hero, shared page framing, runtime banner, system requirement block, and dense card surfaces make the page feel like a dashboard instead of a focused action surface. Users have to visually parse too much before they can start installing.

**Goals**

- Make `Install` feel immediately actionable on first screen load.
- Reduce header height and remove non-essential hero weight.
- Separate `Install`, `Uninstall`, and `Migrate` into clearly distinct visual work modes instead of one shared presentation shell.
- Improve user focus, perceived clarity, and task confidence without changing the underlying install bridge behavior.
- Preserve existing platform-aware logic and assessment capability while demoting secondary detail out of the main visual path.

**Non-Goals**

- Re-architect the install, uninstall, or migration backend flows.
- Add new installation methods or runtime detection logic.
- Turn the page into a multi-step wizard.

**Approaches Considered**

1. Compact visual cleanup only
   Keep the current structure and simply shrink spacing, reduce font sizes, and tighten cards.
   Tradeoff: faster, but the page would still feel structurally top-heavy because the information architecture would stay the same.

2. Task-focused mode redesign with distinct visual surfaces
   Keep the route and core logic, but redesign the page so each mode has its own focused header, content rhythm, and CTA hierarchy.
   Tradeoff: larger frontend change, but it directly solves the focus problem and gives each mode a clearer product identity.

3. Guided step-by-step installer
   Convert install into a staged wizard and rebuild uninstall and migrate with stepper flows.
   Tradeoff: potentially clearer for beginners, but it adds interaction complexity and changes behavior more than needed for this request.

**Recommendation**

Use approach 2. The real issue is not just spacing; it is that the page currently presents a single shared shell for three very different jobs. A task-focused redesign gives us the highest product improvement without destabilizing the underlying platform logic.

**Design**

## 1. Shared Page Frame

- Replace the oversized hero with a compact top frame.
- Keep the page title, but scale it down and pair it with a short contextual subtitle.
- Make the mode switch the primary navigation object in the header.
- Collapse runtime status into lightweight pills instead of a full-width banner row.
- Remove decorative emphasis that competes with the task cards.

## 2. Install Mode

- Make `Install` the most conversion-oriented mode.
- Bring product selection and method selection above the fold with minimal explanatory chrome.
- Replace the large system-requirements hero strip with a smaller inline support note.
- Turn install method cards into stronger action cards:
  - clearer primary title
  - short benefit-oriented copy
  - stronger primary CTA
  - tighter metadata treatment
- Demote environment assessment from a visually heavy card section into a compact readiness summary on each card, with full detail only in the modal.
- Use the layout to answer, in order:
  - what am I installing
  - which method fits this machine
  - am I ready to start

## 3. Uninstall Mode

- Give `Uninstall` a more operational, cautionary tone.
- Surface detected installation info first.
- Separate “detected current install” from “available uninstall paths.”
- Reduce decorative card styling and increase clarity around destructive actions.
- Keep the uninstall CTA obvious, but visually less inviting than install.

## 4. Migrate Mode

- Treat `Migrate` as a workspace, not a marketing surface.
- Prioritize source selection, detected migration items, and readiness to start.
- Keep file source and destination information legible and structured.
- Use a more procedural visual rhythm with less promotional styling than install.

## 5. Modal Hierarchy

- Keep the modal for execution, but reduce unnecessary explanation in idle state.
- Lead with a compact operation summary and primary action.
- Treat install assessment as supporting detail:
  - compact high-level state first
  - detailed dependency and remediation information below
- Keep execution output visually strong once the process starts.

## 6. Interaction And UX Principles

- First screen should always expose a clear next action.
- Headers should orient, not compete.
- Secondary information should be available without dominating the canvas.
- Action color, density, and spacing should help users quickly distinguish:
  - safe browse/select states
  - ready-to-start states
  - blocked states
  - destructive states

**Component-Level Changes**

- Rework the top page container spacing and width rhythm.
- Replace the current hero icon block with compact mode-aware header chips.
- Redesign the mode tabs to feel like a segmented controller rather than a secondary row of buttons.
- Rebuild install cards to emphasize CTA and readiness.
- Add mode-specific content wrappers so `Install`, `Uninstall`, and `Migrate` do not share the same visual framing.
- Tweak modal spacing to reduce upfront cognitive load.

**Copy Direction**

- Shorten generic explanatory text.
- Shift copy from descriptive/product language toward task language.
- Use install-focused phrases such as “choose a path,” “ready to install,” and “fix blockers.”
- Use uninstall-focused phrases such as “detected installation,” “remove current runtime,” and “review before uninstalling.”
- Use migrate-focused phrases such as “choose sources,” “selected for import,” and “start migration.”

**Verification**

- Add or update focused contract assertions for the new visual structure in the install page.
- Run `node --experimental-strip-types scripts/sdkwork-install-contract.test.ts`.
- Run `pnpm lint`.
- Run `pnpm build`.
