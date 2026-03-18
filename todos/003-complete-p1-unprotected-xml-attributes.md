---
status: pending
priority: p1
issue_id: "003"
tags: [docx, security, xml]
dependencies: []
---

# Problem Statement
Several dynamic values used in XML attributes and text nodes (e.g., font names, style IDs, and alignment values) are not being passed through `escapeXml`, creating a risk of malformed XML or injection if a user creates a block with a malicious name or trigger.

# Findings
- `createFontTableXml` injects `font` directly into attributes.
- `createStylesXml` and `getDocxStyleInfo` use `id` and `name` without escaping.
- `cssToParaProps` injects `jc`, `before`, `after`, etc.

# Proposed Solutions
1. **Comprehensive Escaping**: Update all XML generator methods in `minimal-docx.js` to wrap dynamic string values in `this.escapeXml()`.
2. **Strict Validation**: Sanitize style IDs and font names to only allow alphanumeric characters and spaces before use.

# Recommended Action
Option 1: Ensure all string interpolations in XML templates are escaped.

# Acceptance Criteria
- [ ] Block names with special characters (e.g., `Body & Soul`) do not break the DOCX file.
- [ ] Malicious font names (e.g., `Arial"><w:br/><w:t>`) are safely escaped.

# Work Log
### 2026-03-18 - Discovery
**By:** Claude Code
- Identified as a security and robustness risk during review.
