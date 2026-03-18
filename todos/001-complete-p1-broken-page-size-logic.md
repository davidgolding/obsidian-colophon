---
status: pending
priority: p1
issue_id: "001"
tags: [docx, bug, logic]
dependencies: []
---

# Problem Statement
Page size detection in `minimal-docx.js` is broken. The `ExportModal` passes a string (e.g., `'Letter'`), but `MinimalDocxGenerator` checks `this.pageSize.width === 'A4'`, which will always be false.

# Findings
- In `src/ui/export-modal.js`: `this.settings.pageSize` is set to a string value from the dropdown.
- In `src/minimal-docx.js`: `this.pageSize.width` is accessed in `createDocumentXml`, but `pageSize` is the string itself.

# Proposed Solutions
1. **Normalize in Generator**: Update `MinimalDocxGenerator` constructor to handle both string and object formats for `pageSize`.
2. **Normalize in Modal**: Update `ExportModal` to pass an object `{ width: value }` instead of just the value.

# Recommended Action
Option 1: Update the constructor in `minimal-docx.js` to ensure `this.pageSize` is always an object with a `width` property.

# Acceptance Criteria
- [ ] Exporting with 'A4' selected results in A4 dimensions in `document.xml`.
- [ ] Exporting with 'Letter' selected results in Letter dimensions.
- [ ] Default dimensions are correct if no size is provided.

# Work Log
### 2026-03-18 - Discovery
**By:** Claude Code
- Identified during `ce-review` of the DOCX export implementation.
