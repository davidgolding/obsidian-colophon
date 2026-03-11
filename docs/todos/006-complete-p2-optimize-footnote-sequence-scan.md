---
status: complete
priority: p2
issue_id: "006"
tags: [performance, tiptap, code-review]
dependencies: []
---

# Optimize Footnote Sequence Scan

## Problem Statement
The current implementation performs an O(N) scan of all footnote markers in the document on every keystroke. For large documents with many footnotes, this causes noticeable latency during typing.

## Findings
- `TiptapAdapter` re-sequences all footnotes whenever the editor content changes.
- The scan traverses the entire document tree to find and re-index `footnoteMarker` nodes.
- This is currently triggered by the `update` event without filtering for the type of change.

## Proposed Solutions
- **Option 1**: Filter updates. Only trigger re-sequencing if the transaction contains structural changes (node additions/deletions) or if a `footnoteMarker` node was specifically modified.
- **Option 2**: Use a debounced re-sequencing task to ensure it doesn't run multiple times during rapid typing.

## Recommended Action
Implement Option 1: Update the transaction listener in `TiptapAdapter` to check `tr.docChanged` and specifically look for changes affecting markers or document structure before running `resequenceFootnotes()`. Ensure that copying and pasting one or more footnote markers to another position also triggers a full re-index.

## Acceptance Criteria
- [x] Footnote re-sequencing only runs when markers are added, removed, or moved.
- [x] Typing in regular text doesn't trigger a full sequence scan.
- [x] Copying and pasting footnote markers triggers a re-index.
- [x] Performance remains stable in large documents (>100 footnotes).

## Work Log

### 2026-03-11 - Initialization
**By:** Gemini CLI
**Actions:**
- Created todo `006` from performance review findings.

### 2026-03-11 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status changed from pending → ready
- Added requirement for copy/paste triggering
- Ready to be picked up and worked on

### 2026-03-11 - Optimized Sequence Scan
**By:** Gemini CLI
**Actions:**
- Implemented `checkIfResequenceNeeded` in `TiptapAdapter`.
- Updated `onUpdate` to use the check and skip re-sequencing for non-marker changes.
- Added `colophon-sync` meta handling to prevent infinite loops and redundant scans.
- Verified logic for copy/paste and marker deletions.
- Status changed to completed.
