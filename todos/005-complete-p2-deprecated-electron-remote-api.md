---
status: pending
priority: p2
issue_id: "005"
tags: [docx, obsidian, api, deprecated]
dependencies: []
---

# Problem Statement
`src/extensions/docx-serializer.js` uses `electron.remote.dialog.showSaveDialog`. The `remote` module is deprecated in Electron and often disabled or unreliable in newer Obsidian versions.

# Findings
- `const electron = require('electron')` is used.
- `electron.remote.dialog.showSaveDialog` is called.

# Proposed Solutions
1. **Use Obsidian File Picker**: Attempt to use `app.vault.adapter` or a native Obsidian API for saving files if available.
2. **Direct Electron IPC**: Use `window.electron.ipcRenderer` or the equivalent bridge provided by Obsidian.

# Recommended Action
Research the current Obsidian-recommended way to trigger a native "Save As" dialog on Desktop and update the implementation.

# Acceptance Criteria
- [ ] The save dialog still works on Desktop.
- [ ] Code no longer references `electron.remote`.

# Work Log
### 2026-03-18 - Discovery
**By:** Claude Code
- Identified as a compatibility risk during architectural review.
