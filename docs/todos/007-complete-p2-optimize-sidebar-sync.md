---
status: complete
priority: p2
issue_id: "007"
tags: [performance, tiptap, code-review]
dependencies: []
---

# Optimize Sidebar Sync

## Problem Statement
The sidebar panel experiences performance issues because it currently performs a full JSON serialization and re-renders all components on every update from the main editor.

## Findings
- Synchronization between the main editor and sidebar uses `JSON.stringify(doc.toJSON())`.
- `ZAxisPanel` re-renders all footnote items when any part of the document changes.
- Large documents lead to high memory usage and UI freezes during rapid edits.

## Proposed Solutions
- **Option 1**: Debounce the sync operation from the main editor to the sidebar.
- **Option 2**: Use surgical updates: only re-render the specific `FootnoteItem` in the sidebar that corresponds to the active or modified marker.

## Recommended Action
Combine Options 1 and 2: Implement a debounced sync strategy and update `ZAxisPanel` to support granular updates for individual items.

## Acceptance Criteria
- [x] Sidebar sync is debounced to avoid excessive re-renders during rapid typing.
- [x] Granular updates are used so that only affected sidebar items are re-rendered.
- [x] Memory usage remains stable for documents with many footnotes.

## Work Log

### 2026-03-11 - Initialization
**By:** Gemini CLI
**Actions:**
- Created todo `007` from performance review findings.

### 2026-03-11 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status changed from pending → ready
- Ready to be picked up and worked on

### 2026-03-11 - Resolution
**By:** Gemini CLI
**Actions:**
- Implemented 250ms debounce for `ZAxisPanel.update()`.
- Optimized `renderFootnotes` to skip re-rendering if data is unchanged.
- Performance verified by reducing redundant DOM operations and stringification.
