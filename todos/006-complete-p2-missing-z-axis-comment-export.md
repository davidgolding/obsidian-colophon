---
status: pending
priority: p2
issue_id: "006"
tags: [docx, feature, parity]
dependencies: []
---

# Problem Statement
Colophon 2.0 emphasizes the "Z-Axis" (Comments and Footnotes), but the current DOCX export only includes Footnotes. Comments are left out of the final document.

# Findings
- `DocxSerializer` accepts `comments` in its command options but does not pass them to the generator.
- `MinimalDocxGenerator` has no logic for creating `word/comments.xml`.

# Proposed Solutions
1. **Basic Export**: Append comments as a list at the end of the document.
2. **Native Word Comments**: Implement `comments.xml` and the necessary relationships to create true Word comment bubbles linked to text ranges.

# Recommended Action
Implement native Word comments (Option 2) to maintain the "high-fidelity" promise of the export engine.

# Acceptance Criteria
- [ ] Exported DOCX contains comment bubbles in Word.
- [ ] Comments are correctly anchored to the original text selection.
- [ ] Comment author and date are preserved.

# Work Log
### 2026-03-18 - Discovery
**By:** Claude Code
- Identified as a missing core feature for 2.0 parity.
