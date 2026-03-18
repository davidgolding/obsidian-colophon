---
status: pending
priority: p2
issue_id: "004"
tags: [docx, architecture, consistency]
dependencies: []
---

# Problem Statement
`src/minimal-docx.js` uses CommonJS (`require`/`module.exports`), while the rest of the Colophon 2.0 codebase uses ESM (`import`/`export`). This inconsistency makes the file harder to maintain and potentially complicates the build process.

# Findings
- `minimal-docx.js` starts with `const JSZip = require('jszip')`.
- It ends with `module.exports = { MinimalDocxGenerator, cleanFont }`.

# Proposed Solutions
1. **Convert to ESM**: Rewrite the file to use `import JSZip from 'jszip'` and `export class MinimalDocxGenerator`.

# Recommended Action
Convert `minimal-docx.js` to ESM to align with the project's architectural standards.

# Acceptance Criteria
- [ ] `minimal-docx.js` uses `import`/`export`.
- [ ] `src/extensions/docx-serializer.js` imports from it correctly.
- [ ] The build (`pnpm build`) still produces a working plugin.

# Work Log
### 2026-03-18 - Discovery
**By:** Claude Code
- Identified as architectural technical debt.
