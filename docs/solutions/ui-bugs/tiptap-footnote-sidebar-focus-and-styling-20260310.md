---
module: Footnotes Sidebar (Z-Axis)
date: 2026-03-10
problem_type: ui_bug
component: frontend_stimulus
symptoms:
  - "Uncaught TypeError: Cannot read properties of undefined (reading 'options') when triggering footnote"
  - "Footnote content box stretched vertically and had 'box-within-a-box' borders"
  - "Typing in footnote content caused immediate focus loss"
  - "Footnote text didn't inherit alignment or typography settings"
root_cause: config_error
severity: high
tags: [tiptap, ui, css, events, focus]
---

# Footnotes Sidebar Stability and Styling

## Problem Statement
When implementing a sidebar of "mini" Tiptap editors for footnotes, several UI and runtime bugs emerged. Typing the `((` trigger caused a `TypeError` due to brittle coupling between the extension and the plugin adapter. Furthermore, the sidebar editors were un-typable (focus loss on every keystroke) and suffered from severe CSS inheritance issues, resulting in vertical stretching (inheriting the main canvas's 75vh padding) and a redundant "box-within-a-box" border.

## Investigation & Findings
- **Focus Loss**: The sidebar component (`ZAxisPanel`) was blindly re-rendering the entire list of editors on every document update, destroying and recreating the currently focused editor.
- **TypeError**: The `InputRule` in `FootnoteMarker` attempted to call `editor.options.plugin.adapter.focusNote()` before the editor instance was fully settled or available in that context.
- **CSS Pollution**: A broad selector (`.colophon-workspace .ProseMirror`) intended for the main canvas was inadvertently applying `padding-bottom: 75vh` to the tiny sidebar editors.
- **Typography Precision**: `StyleManager` was applying text-alignment to the outer `.ProseMirror` container, but Tiptap requires paragraph-level settings (`p`) to correctly render alignment.

## Working Solution

### 1. Decoupled Events (Fixing TypeError)
Instead of the extension directly calling the plugin adapter, it now dispatches standard DOM events. The adapter listens for these and handles the UI changes (like opening the sidebar).
```javascript
// In footnote-marker.js
document.body.dispatchEvent(new CustomEvent('colophon:footnote:create', {
    detail: { id }
}));

// In tiptap-adapter.js
this.createHandler = (e) => this.focusNote(e.detail.id);
document.body.addEventListener('colophon:footnote:create', this.createHandler);
```

### 2. Selective Rendering (Fixing Focus Loss)
The sidebar panel now checks `editor.isFocused` and explicitly skips content updates for the active editor, trusting its internal state during typing.

### 3. CSS Isolation and Aesthetic Alignment
We isolated layout CSS by adding a specific `.colophon-main-editor` class to the main canvas. For the sidebar, we ported the 1.x editorial styles: borders go on the container (`.colophon-footnote-item`), and the editor itself is completely transparent and borderless.
```css
.colophon-footnote-editor {
    outline: none;
    min-height: auto;
    cursor: text;
    width: 100%;
    background-color: transparent !important;
    border: 0 !important;
}

.colophon-footnote-editor .ProseMirror {
    padding: 0 !important;
    margin: 0 !important;
    min-height: auto !important; /* Fixes vertical stretching */
}
```

### 4. High-Precision Typography
Updated `StyleManager` to specifically target the `p` tags inside the sidebar editor to ensure `text-align` and other settings apply correctly.

## Prevention Strategies
- **Extension Isolation**: Never tightly couple a Tiptap extension to the framework/plugin hosting it. Always use native `CustomEvent` dispatches to communicate intent up to the host application.
- **CSS Scoping**: When nesting editors (like a main canvas and sidebar mini-editors), never use broad wildcard selectors (like `.workspace .ProseMirror`) for structural layout properties like padding or height. Always use specific instance classes.

## Cross-References
- Related to Z-Axis integration: [obsidian-link-integration-z-axis-20260310.md](../integration-issues/obsidian-link-integration-z-axis-20260310.md)
