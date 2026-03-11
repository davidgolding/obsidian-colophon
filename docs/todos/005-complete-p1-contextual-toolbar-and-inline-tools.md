---
status: complete
priority: p1
issue_id: "005"
tags: [ui, tiptap, toolbar, focus]
dependencies: []
---

# Contextual Toolbar and Expanded Inline Tools

## Problem Statement
The toolbar is currently locked to the main editor and lacks essential inline formatting tools (Underline, Super/Subscript, Small Caps). Footnote editing in the sidebar lacks formatting indicators and controls.

## Recommended Action
Implement a "Global Contextual Observer" pattern where the toolbar tracks the focused editor instance. Expand the Tiptap extensions and toolbar UI.

## Acceptance Criteria
- [ ] Toolbar highlights reflect active selection in main and sidebar editors.
- [ ] Toolbar buttons apply formatting to the focused editor.
- [ ] Block menu locks to "Footnote" when a sidebar footnote is focused.
- [ ] Underline, Superscript, Subscript, and Small Caps are functional.
- [ ] Superscript and Subscript are mutually exclusive.
- [ ] Small Caps uses `<span class="colophon-small-caps">`.

## Actionable Tasks
- [x] **Phase 1: Extensions & Styles**
    - [x] Create `src/extensions/small-caps.js`.
    - [x] Register new extensions in `src/tiptap-adapter.js`.
    - [x] Update `styles.css` for new marks and button states.
- [x] **Phase 2: Focus Tracking**
    - [x] Implement `view.activeEditor` tracking in `ColophonView`.
    - [x] Update `TiptapAdapter` to signal focus changes.
    - [x] Ensure `ZAxisPanel` mini-editors signal focus changes.
- [x] **Phase 3: Toolbar Refactor**
    - [x] Update `ColophonToolbar` to target `view.activeEditor`.
    - [x] Add new buttons to toolbar.
    - [x] Implement block menu lock logic.
    - [x] Implement mutual exclusivity for Super/Subscript.

## Work Log

### 2026-03-11 - Initial Setup
**By:** Claude Code
**Actions:**
- Created todo from plan.

### 2026-03-11 - Implementation & Verification
**By:** Claude Code
**Actions:**
- Implemented Phase 1, 2, and 3.
- Verified focus tracking across main and sidebar editors.
- Verified new inline tools and highlights.
- Verified block menu lock for footnotes.
- Fixed duplicate extension warning for underline.
- Verified mutual exclusivity for super/subscript.
