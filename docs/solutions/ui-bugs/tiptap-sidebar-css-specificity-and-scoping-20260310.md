---
module: Footnotes Sidebar (Z-Axis)
date: 2026-03-10
problem_type: ui_bug
component: StyleManager
symptoms:
  - "Footnote content inheriting incorrect 'Body' block styles from main canvas"
  - "Text-alignment and typography settings being ignored in sidebar"
  - "Vertical stretching in mini-editors due to leaked canvas padding"
root_cause: config_error
severity: high
tags: [css, specificity, tiptap, style-manager]
---

# Tiptap Sidebar CSS Specificity and Scoping

## Problem Statement
In a multi-editor environment where a main canvas and sidebar mini-editors co-exist, CSS inheritance can cause severe layout and typographic bugs. Specifically, paragraphs in the Footnotes Sidebar were taking their styles (alignment, margins, font-size) from the "Body" block definition intended only for the main canvas. Additionally, the 75vh typewriter-mode padding was leaking into the sidebar, causing extreme vertical stretching.

## Investigation & Findings
- **Inheritance Pollution**: The selector `.colophon-workspace .ProseMirror p.body` was too broad. Since the sidebar is inside the workspace, its paragraphs (which also have the `.body` class) were matching this rule.
- **Specificity Conflict**: General block rules were winning over sidebar-specific rules because they targeted specific block classes (like `.body`) whereas the sidebar rules were targeting the generic container.
- **Selector Mismatch**: In `StyleManager`, we were using `.colophon-footnote-editor .ProseMirror`, but Tiptap applies the instance class *directly* to the ProseMirror div. The correct selector is `.ProseMirror.colophon-footnote-editor`.

## Working Solution

### 1. Scoping the Main Canvas
We isolated the main editor by adding a unique `.colophon-main-editor` class and updated `StyleManager` to use this as the base for all general block definitions.
```javascript
// In style-manager.js
generateBlockStyles(blockId, properties) {
    const base = '.colophon-main-editor'; // Restrict to main canvas
    const selector = `${base} ${tag}.${blockId}`;
    // ...
}
```

### 2. High-Precision Sidebar Selectors
We updated the sidebar targeting to use a joined class selector and ensured it targets the inner `p` tags where block styles are often applied. We also used `!important` to guarantee these dynamic settings override any defaults.
```javascript
// In style-manager.js
const sidebarBase = '.ProseMirror.colophon-footnote-editor';
css += `${sidebarBase}, ${sidebarBase} p {\n`;
// ... map properties with !important
```

### 3. Layout Resets
Explicitly reset padding and height for the sidebar editors in `styles.css` to prevent them from inheriting canvas geometry.
```css
.colophon-footnote-editor .ProseMirror {
    padding: 0 !important;
    margin: 0 !important;
    min-height: auto !important;
}
```

## Prevention Strategies
- **Primary Canvas Isolation**: Always assign a specific, high-level class to your primary editing area to prevent its "geometry" (padding, min-height) and "block-definitions" from leaking into sidebar or modal editors.
- **leaf Node Targeting**: When styling nested editors, target the actual content nodes (like `p`) rather than just the container, as ProseMirror/Tiptap often applies styles at the paragraph level.
- **Joined Selectors**: Remember that instance-specific classes are applied *on* the `.ProseMirror` element. Use `.ProseMirror.my-class` instead of `.my-class .ProseMirror`.

## Cross-References
- Related focus/event fixes: [tiptap-footnote-sidebar-focus-and-styling-20260310.md](tiptap-footnote-sidebar-focus-and-styling-20260310.md)
