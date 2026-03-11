---
status: complete
priority: p2
issue_id: "010"
tags: [performance, ui, code-review]
dependencies: []
---

# Lazy Load Footnote Editors

## Problem Statement
The sidebar experiences memory bloat when there are many footnotes because each footnote currently initializes a full Tiptap instance.

## Findings
Multiple active Tiptap instances in the sidebar consume significant memory and can slow down the UI, especially in long documents with many annotations.

## Proposed Solution
- Render a "plain preview" (static HTML or a lightweight component) for footnote items in the sidebar.
- Only initialize the Tiptap editor when the user focuses or clicks on the specific footnote item.
- Destroy/teardown the editor when it loses focus or is scrolled out of view (if needed).

## Recommended Action
Refactor `src/ui/z-axis-panel.js` (or the component rendering footnote items) to implement a lazy-loading mechanism for the Tiptap editors.

## Acceptance Criteria
- [x] Footnotes initially render as static previews.
- [x] Tiptap editor initializes on demand (click/focus).
- [x] Memory footprint is reduced for documents with many footnotes.
- [x] UI remains responsive during document navigation.

## Work Log

### 2026-03-11 - Initial Creation
**By:** Gemini CLI
**Actions:**
- Created todo `010` based on performance finding.

### 2026-03-11 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status confirmed as ready
- Ready to be picked up and worked on

### 2026-03-11 - Completed
**By:** Gemini CLI
**Actions:**
- Refactored `ZAxisPanel.renderFootnotes` to use `renderPreview` initially.
- Implemented `createMiniEditor` to instantiate Tiptap on click/focus.
- Added `onBlur` teardown to destroy editor and revert to preview when focus is lost.
- Added CSS styles for footnote previews.
