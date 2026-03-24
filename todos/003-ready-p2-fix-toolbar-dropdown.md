---
status: ready
priority: p2
issue_id: "003"
tags: [ui, bug]
dependencies: []
---

# Fix Toolbar Dropdown Interaction

## Problem Statement
The block type menu requires holding the mouse button to stay open. This is non-standard behavior for Obsidian UI.

## Findings
- `src/ui/toolbar.js` uses `onmousedown` to open the dropdown.
- Obsidian's `Menu` class expects to be triggered by `onclick` for proper lifecycle management.

## Proposed Solutions

### Option 1: Switch to onclick
**Approach:** 
- In `src/ui/toolbar.js`, replace the `onmousedown` listener for the block selector with `onclick`.

**Pros:**
- Matches standard UI behavior.
- Simplifies menu management.

**Cons:**
- None.

**Effort:** 30 minutes
**Risk:** Low

## Recommended Action
Implement Option 1.

## Technical Details
- `src/ui/toolbar.js`: Replace event listener in `createBlockSelector`.

## Acceptance Criteria
- [ ] Clicking the block type dropdown in the toolbar opens a menu that stays open after releasing the mouse button.
- [ ] Menu correctly dismisses when clicking outside or selecting an item.

## Work Log
### 2026-03-24 - Task Creation
**By:** Gemini CLI
**Actions:** Created todo based on plan.
