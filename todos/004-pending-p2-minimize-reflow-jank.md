---
status: pending
priority: p2
issue_id: "004"
tags: [performance, ux, code-review]
dependencies: []
---

# Minimize Reflow Jank in NodeView

## Problem Statement
`InternalLink.addNodeView` calls `updateView` on every `transaction` and `selectionUpdate`. `updateView` triggers text updates and DOM changes that may cause layout reflows during rapid typing.

## Findings
- File: `src/extensions/internal-link.js`
- `editor.on('transaction', updateView)` fires frequently.

## Proposed Solutions
1. **Debounce Updates**: Only update the view after a short delay (e.g., 50ms) of selection stability.
2. **requestAnimationFrame**: Wrap the DOM update in `rAF` to ensure it only happens once per frame.

## Acceptance Criteria
- [ ] No visible jitter or "jumpiness" when typing near or on a link.
- [ ] Performance benchmarks show minimal main-thread blocking during typing.
