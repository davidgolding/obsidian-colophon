---
title: "feat: Footnotes Sidebar (Z-Axis) - Deepened"
type: feat
status: active
date: 2026-03-10
origin: docs/plans/2026-03-10-feat-footnotes-sidebar-plan.md
---

# feat: Footnotes Sidebar (Z-Axis)

## Enhancement Summary

**Deepened on:** 2026-03-10
**Sections enhanced:** 4
**Research agents used:** Performance Oracle, architecture-strategist, agent-native-architecture, julik-frontend-races-reviewer, code-simplicity-reviewer.

### Key Improvements
1. **Performance via Lazy Loading**: Switched from instantiating all sidebar editors at once to a "Static Renderer + Focus to Edit" pattern to support 100+ footnotes without lag.
2. **Robust Sync Loop Prevention**: Added transaction metadata flags (`colophon-sync`) to prevent bi-directional update loops between the main canvas and the sidebar.
3. **Unified Z-Axis Architecture**: Refactored the UI approach to use a shared `ZAxisPanel` component for both Footnotes and Comments to minimize code duplication.
4. **Agent-Native Command Expansion**: The `insert-footnote` command now supports programmatic content injection, enabling agents to create fully-formed annotations.

## Overview
This plan implements a contextual slide-out panel for Obsidian that manages footnotes within the Colophon "Word Composition" environment. It provides a bi-directional sync between inline markers in the editor and mini-Tiptap editors in the sidebar.

### Research Insights

**Best Practices:**
- **Shared Extensions**: Define the footnote extension array once as a constant to prevent Tiptap from re-parsing the schema for every mini-editor.
- **Lucide Icons**: Use the `list-ordered` icon for the toggle button to maintain consistency with Obsidian's internal UI for sequencing.

**Performance Considerations:**
- **Static Renderer**: Use a read-only rendering of the footnote content until the user clicks it. This reduces the number of active `EditorView` instances from $N$ to 1 (the focused one).
- **JSON Serialization**: Debounce the `onUpdate` synchronization to the `.colophon` data structure to avoid blocking the main thread during rapid typing in small editors.

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

### Research Insights

**Architecture & Security:**
- **UUID Stability**: Use `crypto.randomUUID()` for footnote IDs to ensure absolute uniqueness across merged files or copied blocks.
- **Orphan Cleanup**: Implement a "Mark and Sweep" cleanup logic that runs on file save. It should identify keys in the `footnotes` object that no longer have a corresponding `footnoteMarker` in the main `doc` and remove them, while respecting the Undo buffer.

**Implementation Details:**
```javascript
// Recommended Sync Pattern
this.editor.on('update', ({ transaction }) => {
  if (transaction.getMeta('colophon-sync')) return;
  // Trigger external sync
});
```

## Implementation Phases

### Phase 1: Core Extension & Storage
- Create `src/extensions/footnote-marker.js`.
- **Enhancement**: The marker node should be an "Atom" node to prevent the cursor from entering it, ensuring it behaves like a single unit.

### Phase 2: The Sidebar Panel
- Create `src/ui/z-axis-panel.js` as a generic layout manager.
- Implement `FootnoteItem` with **Static Previews**.

### Phase 3: Sequencing & Navigation
- Add a transaction listener to `TiptapAdapter` for re-sequencing.
- **Race Condition Prevention (Julik)**: Ensure `scrollIntoView` only fires if the scroll position isn't already within a 50px threshold of the target to prevent "scrolling battles" between main and sidebar.

### Phase 4: Commands & Hotkeys
- Register `insert-footnote` in `main.js`.
- **Agent Parity**: Expose a tool-compatible command structure.

## System-Wide Impact
- **Interaction Graph**: `InputRule` -> `insertContent` -> `sequencer` -> `Panel.render()` -> `StyleManager` injection.
- **State Lifecycle Risks**: Careful handling of the "Undo" command to ensure deleted markers restore their associated content from the `footnotes` dictionary.

## Acceptance Criteria
- [x] Typing `(( ` inserts a marker and opens the sidebar.
- [x] Footnote markers are correctly superscripted using the `align` property.
- [x] Moving a paragraph containing Footnote #2 above Footnote #1 re-sequences them instantly.
- [x] Clicking a marker scrolls the sidebar and focuses it.
- [x] Clicking the number in the sidebar scrolls the canvas to the marker.
- [x] Footnote content is persisted in the `.colophon` JSON file.

## Sources & References
- **Tiptap v3 Performance**: [Multiple Editor Management](https://tiptap.dev/docs/editor/guide/multiple-editors)
- **Obsidian API**: [registerCommand](https://docs.obsidian.md/Plugins/User+interface/Commands)
- **1.x Reference**: Commit `0e1f07f` for initial logic.
