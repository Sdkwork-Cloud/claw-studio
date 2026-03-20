# Instance Detail Surface Cleanup Design

**Date:** 2026-03-20

**Problem**

The current `Instance Detail` workbench mixes unrelated controls into section-specific surfaces:

- The `Files` section shows `API Token` and `Save Configuration`, which are not file-management actions.
- The `Tools` section ends with a `Danger Zone`, even though lifecycle actions already appear in the page header.
- The result is a detail page that feels noisy, duplicates control locations, and weakens the meaning of each section.

**Goals**

- Keep the detail experience concise and predictable.
- Make each section responsible only for its own domain.
- Keep destructive actions visible but out of content sections.
- Avoid introducing new navigation or broader information-architecture changes.

**Approved Direction**

Adopt the minimal cleanup approach:

- `Header` owns instance lifecycle and destructive actions.
- `Files` owns gateway/runtime file information and the file editor only.
- `Tools` owns tool inventory and access information only.

This keeps the layout familiar while removing the misplaced controls that currently make the page feel inconsistent.

**Section Rules**

`Header`

- Keeps `Restart`
- Keeps `Start` or `Stop`
- Adds `Uninstall Instance`
- Uses the existing confirmation flow for uninstall

`Files`

- Keeps gateway profile summary
- Keeps runtime artifacts explorer/editor
- Removes `API Token`
- Removes `Save Configuration`

`Tools`

- Keeps tool cards and access/status metadata
- Removes the bottom `Danger Zone`
- Removes duplicated lifecycle actions from the section

**Rationale**

- Destructive actions belong with other instance-level controls because they affect the whole instance, not a subsection.
- File workflows should stay focused on file discovery, preview, and editing.
- Tool workflows should answer what capabilities are available, how they are accessed, and when they were used.
- Removing cross-domain controls reduces cognitive load and makes the workbench easier to scan.

**Non-Goals**

- No new sidebar section such as `Access` or `Configuration`
- No redesign of the overall page shell
- No changes to backend contracts or persisted instance data

**Testing Strategy**

Add a contract test for the `InstanceDetail.tsx` source to enforce the new information architecture:

- `Files` section does not render `API Token`
- `Files` section does not render `Save Configuration`
- `Tools` section does not render `Danger Zone`
- Header action cluster includes `Uninstall Instance`

**Notes**

- I am not creating a git commit for this design doc because the workspace already contains many unrelated in-flight changes.
