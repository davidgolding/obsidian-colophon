---
status: complete
priority: p1
issue_id: "001"
tags: [footnotes, tiptap, obsidian, ui]
dependencies: []
---

# Footnotes Sidebar (Z-Axis)

## Problem Statement
Writers need a way to manage annotations without leaving the flow of their prose. We need a contextual slide-out panel that provides bi-directional sync between inline markers and mini-Tiptap editors.

## Proposed Solution
- **Phase 1**: Core Extension & Storage (`footnoteMarker` extension, adapter helpers).
- **Phase 2**: The Sidebar Panel (`ZAxisPanel`, `FootnoteItem` with static previews).
- **Phase 3**: Sequencing & Navigation (automated re-numbering, sync scrolling).
- **Phase 4**: Commands & Hotkeys (Obsidian commands, settings).

## Acceptance Criteria
- [x] Typing `(( ` inserts a marker and opens the sidebar.
- [x] Markers are correctly superscripted via `align` setting.
- [x] Re-sequencing happens instantly on structure changes.
- [x] Bi-directional navigation (click to focus/scroll) works.
- [x] Footnote content is persisted in JSON.

## Work Log

### 2026-03-10 - Initialization
**By:** Gemini CLI
**Actions:**
- Created feature branch `feat/footnotes-sidebar`.
- Initialized todo `001`.
- Identified integration points in `tiptap-adapter.js` and `toolbar.js`.

### 2026-03-10 - Implementation
**By:** Gemini CLI
**Actions:**
- Implemented `FootnoteMarker` extension.
- Created `ZAxisPanel` with mini-Tiptap editors.
- Added re-sequencing logic to `TiptapAdapter`.
- Integrated bi-directional navigation.

### 2026-03-10 - Final Stability & Workflow Fixes
**By:** Gemini CLI
**Actions:**
- Fixed `TypeError` by ensuring `plugin` is passed to Editor options for extension access.
- Refined `ZAxisPanel.show()` to prevent accidental closing during footnote creation.
- Implemented spellcheck parity between main canvas and sidebar mini-editors.
- Optimized CSS to remove redundant borders and ensure editors are naturally sized.

