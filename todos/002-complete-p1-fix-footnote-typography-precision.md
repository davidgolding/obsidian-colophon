---
status: complete
priority: p1
issue_id: "002"
tags: [ui, typography, code-review]
dependencies: []
---

# Fix Footnote Typography Precision

## Problem Statement
The footnote content in the sidebar was incorrectly inheriting canvas-level padding (75vh) and wasn't correctly applying all block-level settings like `text-align`.

## Findings
- The broad selector `.colophon-workspace .ProseMirror` was applying main canvas layout to all editors.
- High-fidelity typography requires targeting the specific `p` tags within the mini-editors.

## Acceptance Criteria
- [x] Footnote content in sidebar respects `text-align` setting.
- [x] All other `Footnote` block settings (font, color, line-spacing) are correctly applied.
- [x] 75vh padding is restricted to the main editor.

## Work Log

### 2026-03-10 - Precision Alignment
**By:** Gemini CLI
**Actions:**
- Refactored `styles.css` to use `.colophon-main-editor` for canvas-specific layout.
- Added `colophon-main-editor` class to `TiptapAdapter` props.
- Updated `StyleManager` to use high-precision selectors for sidebar footnote editors.
- Verified that `text-align` and other block properties are now correctly injected.
