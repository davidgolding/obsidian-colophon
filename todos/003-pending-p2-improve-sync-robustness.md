---
status: pending
priority: p2
issue_id: "003"
tags: [architecture, sync, code-review]
dependencies: []
---

# Improve Sync Robustness

## Problem Statement
The current `focusNote` implementation in `TiptapAdapter` uses a `setTimeout(..., 100)` to wait for the sidebar to render. This is brittle and can lead to race conditions.

## Findings
- File: `src/tiptap-adapter.js:280`
- Relies on magic numbers for timing.

## Proposed Solutions
1. **Event Callback**: Add a callback to `ZAxisPanel.show()` that fires after rendering is complete.
2. **RequestAnimationFrame**: Use `requestAnimationFrame` to ensure the DOM is ready.

## Acceptance Criteria
- [ ] Focus switching between canvas and sidebar works reliably on all systems.
- [ ] Removed brittle `setTimeout`.
