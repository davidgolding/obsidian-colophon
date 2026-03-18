---
status: pending
priority: p3
issue_id: "008"
tags: [docx, code-quality]
dependencies: []
---

# Problem Statement
In `src/extensions/docx-serializer.js`, `fs.writeFile` is used with a callback inside an `async` function. This is an anti-pattern that makes error handling inconsistent.

# Findings
- The `exportToDocx` command is `async`.
- It calls `fs.writeFile(path, buffer, (err) => { ... })`.

# Proposed Solutions
1. **Promisify FS**: Use `fs.promises.writeFile` or wrap it in a `Promise`.

# Recommended Action
Use `fs.promises.writeFile` to keep the async/await flow clean.

# Acceptance Criteria
- [ ] File saving still works.
- [ ] Code uses `await fs.promises.writeFile`.

# Work Log
### 2026-03-18 - Discovery
**By:** Claude Code
- Identified as a minor code quality issue.
