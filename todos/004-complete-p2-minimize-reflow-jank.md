---
status: complete
priority: p2
issue_id: "004"
tags: [performance, ux, code-review]
dependencies: []
---

# Minimize Reflow Jank in NodeView

## Problem Statement
`InternalLink.addNodeView` previously called `updateView` on every transaction, causing potential layout reflows.

## Findings
- Implemented `requestAnimationFrame` debouncing for `updateView`.
- Added change-detection logic (`lastIsSelected`) to skip redundant DOM updates.
- Only updates `textContent` if it actually differs from current.

## Acceptance Criteria
- [x] No visible jitter or "jumpiness" when typing near or on a link.
- [x] Performance optimized via RAF and change detection.

## Work Log

### 2026-03-10 - Performance Optimization
**By:** Gemini CLI
**Actions:**
- Refactored `InternalLink` NodeView in `src/extensions/internal-link.js` to use `requestAnimationFrame`.
- Added state tracking to minimize DOM writes.
