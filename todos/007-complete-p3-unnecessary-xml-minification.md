---
status: pending
priority: p3
issue_id: "007"
tags: [docx, optimization, risk]
dependencies: []
---

# Problem Statement
`MinimalDocxGenerator` contains a `minifyXMLString` method that uses regex to remove whitespace and comments from XML. This is risky for complex content and provides negligible benefit since the `.docx` file is a ZIP-compressed bundle.

# Findings
- `minifyXMLString` is called on every generated XML string.
- ZIP compression handles whitespace very efficiently.

# Proposed Solutions
1. **Remove Minification**: Delete the `minifyXMLString` method and return the raw XML strings.
2. **Prettier XML**: Format the XML with indentation for easier debugging of the generated bundle.

# Recommended Action
Option 1: Remove the minification logic to reduce risk and complexity.

# Acceptance Criteria
- [ ] DOCX files generated are still valid and readable by Word.
- [ ] File size difference is negligible (<1%).

# Work Log
### 2026-03-18 - Discovery
**By:** Claude Code
- Identified as unnecessary complexity.
