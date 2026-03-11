---
date: 2026-03-11
topic: contextual-toolbar-and-inline-tools
---

# Contextual Toolbar and Expanded Inline Tools

## What We're Building
We are refining the `ColophonToolbar` to be a truly focus-aware "observer" of the rhetorical state. This involves two major upgrades:
1. **Dynamic Contextual Focus**: The toolbar will now reflect and control the state of whatever editor is currently active—whether it's the main writing canvas or a mini-editor in the footnote sidebar.
2. **Expanded Rhetorical Toolkit**: We are expanding the inline tools to include **Underline**, **Superscript**, **Subscript**, and **Small Caps**, ensuring they act as both triggers and status indicators.

## Why This Approach
We chose **Approach A: Global Contextual Observer** because it treats the toolbar as a high-level viewport onto the current text focus. By having `ColophonView` track the `activeEditor`, the toolbar can seamlessly switch its command target and button highlights without needing complex point-to-point signaling between individual footnote editors.

## Key Decisions
- **Focus-Driven Toolbar**: The toolbar buttons will use `editor.isActive(mark)` on the *currently focused* editor instance.
- **Footnote Context Lock**: When a footnote editor is focused, the block-level dropdown will display "Footnote" and be disabled (non-expandable), as footnotes are structurally atomic in this system.
- **New Inline Extensions**: We will integrate standard Tiptap extensions for Underline, Superscript, Subscript, and implement a custom `SmallCaps` mark extension using `<span class="colophon-small-caps">`.
- **Visual Feedback**: Toolbar buttons will receive the `.colophon-active` class based on the selection state of the active editor, mirroring Obsidian's native formatting indicators.
- **Single-Row Toolbar**: All inline tools (Bold, Italic, Strike, Underline, Super, Sub, Small Caps) will be displayed as a single horizontal row for immediate access.

## Resolved Questions
- **Small Caps Serialization**: Confirmed to use a span with a class for cleaner CSS targeting and internal JSON representation.
- **Toolbar Layout**: Confirmed to use a single horizontal row for all tools instead of sub-menus.

## Open Questions
- **Z-Index/Overlay Management**: With more buttons in the toolbar, we need to ensure it doesn't wrap or truncate on smaller laptop screens.

## Next Steps
→ `/ce:plan` for implementation details including Tiptap extension configuration and `ColophonView` focus-tracking logic.
