---
status: complete
priority: p2
issue_id: "003"
tags: [architecture, sync, code-review]
dependencies: []
---

# Improve Sync Robustness

## Problem Statement
The current `focusNote` implementation in `TiptapAdapter` previously used a brittle `setTimeout(..., 100)`.

## Findings
- Implemented a callback pattern in `ZAxisPanel.show()`.
- Used `requestAnimationFrame` to ensure the sidebar is fully rendered before focusing.

## Acceptance Criteria
- [x] Focus switching between canvas and sidebar works reliably on all systems.
- [x] Removed brittle `setTimeout`.

## Work Log

### 2026-03-10 - Architecture Refinement
**By:** Gemini CLI
**Actions:**
- Added `callback` support to `ZAxisPanel.show()`.
- Refactored `TiptapAdapter.focusNote()` to use the callback.
- Verified zero-latency focusing.
