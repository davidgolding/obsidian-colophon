---
date: 2026-03-10
topic: footnotes-sidebar
---

# Footnotes Sidebar (Z-Axis)

## What We're Building
A contextual slide-out panel for the Obsidian editor leaf that manages footnotes. This includes a bi-directional synchronization system where inline markers in the "Canvas" correspond to mini-Tiptap editors in the "Sidebar," allowing for distraction-free Word Composition.

## Why This Approach
We chose **Approach A (Contextual Slide-out Panel)** over a native Obsidian Right Sidebar to keep the writer within the focused Colophon workspace. This maintains architectural parity with the Comments system and allows for tighter control over the Z-axis layout and typographic injection.

## Key Decisions
- **Storage Strategy**: Footnotes will be stored in a dedicated `footnotes` dictionary at the top level of the `.colophon` JSON. Markers in the text will reference these IDs.
- **Dynamic Numbering**: Footnote markers will be automatically re-sequenced (1, 2, 3...) based on their visual order in the document whenever the content changes.
- **Typographic Fidelity**:
    - **In Canvas**: Markers use the `Footnote Symbol` block definition. The `align` property will be used to handle baseline shift (e.g., superscripting).
    - **In Sidebar**: The index number uses the `Footnote Number` definition. The content of the note uses the `Footnote` definition.
- **Creation Flow**: 
    - **Transient Syntax**: Triggered by typing `(( ` (customizable in settings).
    - **Command**: A native Obsidian command mappable to any hotkey.
    - **Constraint**: The trigger and command are suppressed when the cursor is already inside a footnote editor to prevent nesting.
- **Bi-directional Navigation**:
    - Clicking a marker in the Canvas focuses the corresponding note in the sidebar and scrolls to it.
    - Clicking the index number in the Sidebar places the Canvas cursor immediately to the right of the marker and scrolls the main editor.
- **UI Integration**: A toggle button using a Lucide icon (e.g., `list-ordered`) will be added to the toolbar next to the Comments icon.

## Open Questions
- **Performance**: Will multiple mini-Tiptap instances in the sidebar impact performance for documents with 100+ footnotes? (We may need to implement lazy-loading or a single-editor view with decorations).
- **Icon Selection**: Which specific Lucide icon best represents "Footnote" alongside the `message-square` used for comments?
- **Undo/Redo**: How do we ensure that deleting a marker in the Canvas and then performing an "Undo" correctly restores the link to the footnote content in the sidebar?

## Next Steps
→ `/ce:plan` for implementation details of the `footnoteMarker` extension and the Sidebar Panel manager.
