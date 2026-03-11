---
title: "feat: Contextual Toolbar and Expanded Inline Tools"
type: feat
status: completed
date: 2026-03-11
origin: docs/brainstorms/2026-03-11-contextual-toolbar-and-inline-tools-brainstorm.md
---

# feat: Contextual Toolbar and Expanded Inline Tools

## Overview
This feature transforms the `ColophonToolbar` into a focus-aware "Global Contextual Observer." It will dynamically track the active editor (main canvas or sidebar footnote) to provide real-time formatting feedback and control. Additionally, the inline toolkit is expanded to include Underline, Superscript, Subscript, and Small Caps.

## Problem Statement / Motivation
Currently, the toolbar is hardcoded to the main editor. When a user is editing a footnote in the sidebar, they lose access to formatting tools and indicators. Furthermore, the limited toolset (Bold/Italic/Strike) is insufficient for complex prose requirements like references or stylistic emphasis (Small Caps).

## Proposed Solution
- **Focus-Driven Architecture**: `ColophonView` will maintain an `activeEditor` reference. All Tiptap editors in the workspace will update this reference when they receive focus.
- **Contextual UI**: The `ColophonToolbar` will update its button states and command targets based on `activeEditor`. If a footnote is focused, the block menu will lock to "Footnote."
- **Expanded Toolkit**: Register new Tiptap extensions and add corresponding buttons to the toolbar in a single horizontal row.

## Technical Considerations
- **Focus Management**: Use `mousedown` + `preventDefault()` on toolbar buttons to ensure clicking a button doesn't blur the editor, which would break the `isActive` detection (see brainstorm: docs/brainstorms/2026-03-11-contextual-toolbar-and-inline-tools-brainstorm.md).
- **Extension Consistency**: Add the new extensions to the `sharedExtensions` list in `TiptapAdapter` so they are available in both the main canvas and footnote mini-editors.
- **Mutual Exclusivity**: Implement logic to ensure Superscript and Subscript are mutually exclusive (applying one removes the other).

## System-Wide Impact
- **Interaction graph**: Editor `onFocus` -> `ColophonView.updateActiveEditor(editor)` -> `ColophonToolbar.update()`.
- **Error propagation**: If an editor instance is destroyed while active, `ColophonView` must safely nullify or fallback its `activeEditor` reference to prevent `TypeError` in the toolbar.
- **API surface parity**: All inline commands will be added to `ColophonView` as proxy methods (e.g., `view.toggleUnderline()`) to maintain the established pattern in `main.js`.

## Acceptance Criteria
- [x] Toolbar buttons highlight correctly based on the active selection in both main and sidebar editors.
- [x] Clicking toolbar buttons applies formatting to the focused editor (canvas or footnote).
- [x] Block menu shows "Footnote" and is disabled when a sidebar footnote is focused.
- [x] New tools (Underline, Super, Sub, Small Caps) are functional in all editor contexts.
- [x] Superscript and Subscript are mutually exclusive.
- [x] Small Caps uses `<span class="colophon-small-caps">` for serialization (see brainstorm: docs/brainstorms/2026-03-11-contextual-toolbar-and-inline-tools-brainstorm.md).

## Implementation Plan

### Phase 1: Extensions & Styles
- [x] Create `src/extensions/small-caps.js` custom mark.
- [x] Update `src/tiptap-adapter.js` to import and register `Underline`, `Superscript`, `Subscript`, and `SmallCaps`.
- [x] Update `styles.css` with `.colophon-active` button states and `.colophon-small-caps` rendering.

### Phase 2: Focus Tracking
- [x] Update `ColophonView` (src/view.js) to track `this.activeEditor`.
- [x] Update `TiptapAdapter` (src/tiptap-adapter.js) to call `view.updateActiveEditor(editor)` on focus.
- [x] Update `ZAxisPanel` (src/ui/z-axis-panel.js) to ensure mini-editors also trigger focus updates.

### Phase 3: Toolbar Refactor
- [x] Update `ColophonToolbar` (src/ui/toolbar.js) to target `this.view.activeEditor`.
- [x] Add new buttons for the expanded toolset.
- [x] Implement the "Footnote" block menu lock.
- [x] Add mutual exclusivity for Super/Subscript.

## Sources & References
- **Origin brainstorm:** [docs/brainstorms/2026-03-11-contextual-toolbar-and-inline-tools-brainstorm.md](docs/brainstorms/2026-03-11-contextual-toolbar-and-inline-tools-brainstorm.md)
- **Similar implementation**: `src/ui/toolbar.js` (current button logic).
- **Learning**: [docs/solutions/ui-bugs/tiptap-footnote-sidebar-focus-and-styling-20260310.md](docs/solutions/ui-bugs/tiptap-footnote-sidebar-focus-and-styling-20260310.md) (focus stability).
