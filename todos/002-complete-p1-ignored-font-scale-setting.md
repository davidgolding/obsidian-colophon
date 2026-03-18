---
status: pending
priority: p1
issue_id: "002"
tags: [docx, bug, feature]
dependencies: []
---

# Problem Statement
The "Scale (%)" setting in the `ExportModal` is captured in the settings object but is never utilized by the `MinimalDocxGenerator` or `DocxSerializer`.

# Findings
- `ExportModal` includes a slider for `scale`.
- `DocxSerializer` passes `settings` to `MinimalDocxGenerator`.
- `MinimalDocxGenerator` accepts `options`, but does not use a `scale` property to adjust font sizes or spacing.

# Proposed Solutions
1. **Apply to Font Sizes**: Update `MinimalDocxGenerator.parseUnit` or `cssToRunProps` to multiply font sizes by `scale / 100`.
2. **Global Scaling**: Apply the scale factor to all unit conversions (margins, spacing, etc.) for a true "zoom" effect on the printed page.

# Recommended Action
Apply the scale factor to font sizes and line spacing in `minimal-docx.js` to fulfill user expectation of "adjusting the font size scale".

# Acceptance Criteria
- [ ] Exporting at 150% scale results in larger text than 100% scale.
- [ ] Exporting at 50% scale results in smaller text.
- [ ] Document layout remains coherent after scaling.

# Work Log
### 2026-03-18 - Discovery
**By:** Claude Code
- Identified as an unimplemented UI feature during review.
