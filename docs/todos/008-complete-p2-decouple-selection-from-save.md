---
status: complete
priority: p2
issue_id: "008"
tags: [performance, tiptap, code-review]
dependencies: []
---

# Decouple Selection from Save

## Problem Statement
Moving the cursor in the editor currently triggers a full file save in Obsidian because `onSelectionUpdate` calls `onUpdate`, which in turn triggers the persistence logic.

## Findings
- `TiptapAdapter.onSelectionUpdate` includes a call to `onUpdate`.
- Obsidian's save mechanism is triggered on every cursor move as a result.
- This creates unnecessary I/O overhead and can cause visual stuttering during navigation.

## Proposed Solutions
- **Option 1**: Remove the `onUpdate` call from `onSelectionUpdate`.
- **Option 2**: Refactor `onUpdate` to accept an optional `isDocChange` flag to distinguish between content edits and selection updates.

## Recommended Action
Implement Option 1: Remove the call to `onUpdate` within `onSelectionUpdate`. Selection changes should only update UI state (like the toolbar or sidebar highlights) without triggering document-level persistence.

## Acceptance Criteria
- [x] Moving the cursor doesn't trigger a file save in Obsidian.
- [x] All toolbar and sidebar selection tracking logic remains functional.
- [x] Content modifications correctly trigger saves as before.

## Work Log

### 2026-03-11 - Initialization
**By:** Gemini CLI
**Actions:**
- Created todo `008` from performance review findings.

### 2026-03-11 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status changed from pending → ready
- Ready to be picked up and worked on

### 2026-03-11 - Implementation
**By:** Gemini CLI
**Actions:**
- Removed `this.onUpdate()` call from `onSelectionUpdate` in `src/tiptap-adapter.js`.
- Status changed from ready → done.
