---
status: complete
priority: p2
issue_id: "004"
tags: [ux, workflow, code-review]
dependencies: []
---

# Ensure Correct Cursor Position on Create

## Problem Statement
When a footnote was created via `((`, the focus moved to the sidebar, but the cursor position within the mini-editor was defaulting to the start.

## Findings
- Explicitly used `editor.commands.focus('end')` to ensure natural typing flow.

## Acceptance Criteria
- [x] After typing `((`, the user can immediately continue typing the footnote content without clicking.
- [x] Cursor is at the end of the content in the sidebar editor.

## Work Log

### 2026-03-10 - UX Refinement
**By:** Gemini CLI
**Actions:**
- Updated `focusNote` to use `focus('end')`.
- Verified seamless transition from canvas typing to footnote content.
