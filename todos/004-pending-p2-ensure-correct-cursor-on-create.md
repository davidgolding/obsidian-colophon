---
status: pending
priority: p2
issue_id: "004"
tags: [ux, workflow, code-review]
dependencies: []
---

# Ensure Correct Cursor Position on Create

## Problem Statement
When a footnote is created via `((`, the focus moves to the sidebar, but the cursor position within the mini-editor is not always at the end of the text, interrupting the "no-mouse" workflow.

## Findings
- `focusNote` calls `editor.commands.focus()`, which defaults to the start of the document in some Tiptap versions.

## Proposed Solutions
1. **Explicit Selection**: Use `editor.commands.focus('end')` when focusing a note.

## Acceptance Criteria
- [ ] After typing `((`, the user can immediately continue typing the footnote content without clicking.
- [ ] Cursor is at the end of the content in the sidebar editor.
