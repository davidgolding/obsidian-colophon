---
status: ready
priority: p2
issue_id: "004"
tags: [ui, settings]
dependencies: []
---

# Sidebar State Persistence

## Problem Statement
The Z-Axis sidebar doesn't remember its visibility or active tab when switching files. This is frustrating for writers who use it as a primary reference.

## Findings
- `ColophonView` manages the sidebar lifecycle.
- Visibility is currently reset on file switch.
- `SidebarManager` is global, but the view needs to persist and restore its state.

## Proposed Solutions

### Option 1: Persist in settings
**Approach:** 
- Add `lastZAxisState` to settings in `settings-data.js`.
- Store `visible` (boolean) and `activeTab` (string).
- Save state on every toggle/tab change.
- Restore on view open/refresh.

**Pros:**
- Persistent across file switches.
- User preference is respected.

**Cons:**
- Global setting vs per-view setting may need clarification.

**Effort:** 2 hours
**Risk:** Low

## Recommended Action
Implement persistence in global settings. Use `ColophonView.refreshSidebarVisibility()` to restore the state.

## Technical Details
- `src/settings-data.js`: Add `lastZAxisState`.
- `src/view.js`: Add logic to save state on toggle and restore on open.

## Acceptance Criteria
- [ ] Open the sidebar on a specific tab (e.g., footnotes).
- [ ] Switch to another file.
- [ ] Return to the original file or open another Colophon view.
- [ ] Sidebar should still be open on the footnotes tab.

## Work Log
### 2026-03-24 - Task Creation
**By:** Gemini CLI
**Actions:** Created todo based on plan.
