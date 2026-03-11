---
title: "feat: Footnotes Sidebar (Z-Axis)"
type: feat
status: active
date: 2026-03-10
origin: docs/brainstorms/2026-03-10-footnotes-sidebar-brainstorm.md
---

# feat: Footnotes Sidebar (Z-Axis)

## Overview
This plan implements a contextual slide-out panel for Obsidian that manages footnotes within the Colophon "Word Composition" environment. It provides a bi-directional sync between inline markers in the editor and mini-Tiptap editors in the sidebar.

## Problem Statement / Motivation
Writers need a way to manage annotations without leaving the flow of their prose. Obsidian's native right sidebar is often too disconnected. We need a Z-axis solution that feels like an extension of the editor itself, respecting the user's custom typography settings.

## Proposed Solution
We will implement **Approach A (Contextual Slide-out Panel)** as decided in the [brainstorm](docs/brainstorms/2026-03-10-footnotes-sidebar-brainstorm.md). This involves:
1. **footnoteMarker Extension**: A Tiptap node that renders markers using the `Footnote Symbol` definition.
2. **FootnotePanel UI**: A panel that mirrors the Comments panel structure, containing a list of `FootnoteItem` components.
3. **Dynamic Sequencer**: A manager that re-numbers footnotes based on their visual order in the Tiptap document.
4. **Bi-directional Navigation**: Event listeners to sync cursor focus and scrolling between markers and notes.

## Technical Approach

### 1. Data Schema
The `.colophon` JSON will include a top-level `footnotes` object:
```json
{
  "doc": { ... },
  "footnotes": {
    "fn-uuid-1": { "content": { "type": "doc", "content": [...] } }
  }
}
```
Markers in the text will store the ID:
```json
{ "type": "footnoteMarker", "attrs": { "id": "fn-uuid-1" } }
```

### 2. Implementation Phases

#### Phase 1: Core Extension & Storage
- Create `src/extensions/footnote-marker.js` with Tiptap `Node.create`.
- Implement `getFootnotes()` and `updateFootnote()` helper methods in `TiptapAdapter`.
- Add the `(( ` input rule to trigger footnote creation.

#### Phase 2: The Sidebar Panel
- Create `src/ui/footnote-panel.js` (reusing patterns from the Comments panel).
- Implement `FootnoteItem` which instantiates a mini-Tiptap editor for each note.
- Inject `Footnote Symbol`, `Footnote Number`, and `Footnote` block styles via `StyleManager`.

#### Phase 3: Sequencing & Navigation
- Add a transaction listener to `TiptapAdapter` that re-calculates footnote numbers whenever the document structure changes.
- Implement `focusNote(id)` and `focusMarker(id)` logic.
- Add the Lucide `list-ordered` toggle button to `ColophonToolbar`.

#### Phase 4: Commands & Hotkeys
- Register `insert-footnote` command in `main.js`.
- Add a setting to Colophon's settings tab to customize the `(( ` trigger.

## System-Wide Impact
- **Interaction Graph**: `InputRule` triggers `insertContent` -> `onUpdate` triggers `sequencer` -> `FootnotePanel` renders list -> `StyleManager` injects baseline shift for markers.
- **State Lifecycle Risks**: If a marker is deleted, the content should remain in the `footnotes` object for a short period (or until file close) to allow for Undo parity.

## Acceptance Criteria
- [ ] Typing `(( ` inserts a marker and opens the sidebar.
- [ ] Footnote markers are correctly superscripted using the `align` property from settings.
- [ ] Moving a paragraph containing Footnote #2 above Footnote #1 re-sequences them instantly.
- [ ] Clicking a marker scrolls the sidebar to the corresponding editor and focuses it.
- [ ] Clicking the number in the sidebar scrolls the canvas to the marker and places the cursor.
- [ ] Footnote content is persisted in the `.colophon` JSON file.

## Sources & References
- **Origin Brainstorm**: [docs/brainstorms/2026-03-10-footnotes-sidebar-brainstorm.md](docs/brainstorms/2026-03-10-footnotes-sidebar-brainstorm.md)
- **Similar Implementation**: `src/ui/toolbar.js` (for Lucide icon usage), `src/tiptap-adapter.js` (for event handling).
- **1.x Reference**: Commit `0e1f07f` (`src/footnote-view.js`) for mini-Tiptap pattern.
