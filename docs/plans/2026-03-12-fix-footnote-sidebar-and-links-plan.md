---
title: Fix Footnote Sidebar Accessibility and Link Rendering
type: fix
status: completed
date: 2026-03-12
origin: docs/brainstorms/2026-03-10-footnotes-sidebar-brainstorm.md
---

# Fix Footnote Sidebar Accessibility and Link Rendering

## Overview
This plan addresses two critical UI bugs in the footnotes sidebar and enhances the `MetadataManager` to ensure footnote content is properly indexed by Obsidian.

## Problem Statement / Motivation
The current "Z-Axis" panel implementation has state-synchronization issues when switching tabs and a rendering bug that makes internal links invisible in the non-editing state. Additionally, footnote content is "invisible" to Obsidian's global indexing, breaking Graph View and Backlinks for research-heavy documents.

## Proposed Solution
1.  **Fix Tab Switching:** Reset the `lastFootnotesJSON` cache when switching tabs or ensure `renderFootnotes` always populates the DOM if it's empty.
2.  **Fix Link Rendering:** Refactor `renderNode` to use `appendChild` and `createTextNode` instead of `textContent` to prevent sibling nodes from being overwritten.
3.  **Enhance Indexing:** Update `MetadataManager` to recursively scan the `footnotes` object in Colophon files.

## Technical Considerations
*   **Performance:** Maintain the lazy-loading strategy for mini-Tiptap editors to keep the sidebar snappy for large documents.
*   **State Management:** Ensure that switching tabs correctly preserves the scroll position or at least re-renders the active tab immediately.

## System-Wide Impact
*   **Interaction graph:** `ZAxisPanel` -> `View` -> `Toolbar` sync will be more robust.
*   **Metadata Cache:** Obsidian will now show links *from* footnotes in the Graph View and Backlinks panel.

## Acceptance Criteria
- [x] Switching between Comments and Footnotes tabs correctly re-renders the footnote list every time.
- [x] Internal links (Wikilinks) are visible and styled correctly in the footnote sidebar preview (non-editing state).
- [x] Footnote internal links appear in Obsidian's Graph View and Backlinks panel.
- [x] Existing functionality (lazy-loading, click-to-edit, bi-directional navigation) remains intact.

## Implementation Details

### 1. Fix Tab Switching in `ZAxisPanel.show()`
When `show()` is called with a different tab, we should clear the `lastFootnotesJSON` cache to ensure a fresh render of the newly selected tab.

### 2. Fix Link Rendering in `ZAxisPanel.renderPreview()`
In the `renderNode` recursive function:
- Instead of `parentEl.textContent = node.text`, use `parentEl.appendChild(document.createTextNode(node.text))`.
- For marks, ensure they are nested correctly using `appendChild`.

### 3. Enhance Indexing in `MetadataManager.js`
In `extractMetadata()`, add a check to also scan the `footnotes` dictionary:
```javascript
// src/metadata-manager.js
if (data.footnotes) {
    for (const footnoteContent of Object.values(data.footnotes)) {
        this.extractMetadata(footnoteContent, links, blockIds);
    }
}
```

## Sources & References
- **Origin brainstorm:** [docs/brainstorms/2026-03-10-footnotes-sidebar-brainstorm.md](docs/brainstorms/2026-03-10-footnotes-sidebar-brainstorm.md)
- **Origin brainstorm:** [docs/brainstorms/2026-03-10-obsidian-link-integration-brainstorm.md](docs/brainstorms/2026-03-10-obsidian-link-integration-brainstorm.md)
- **Related Solution:** [docs/solutions/integration-issues/obsidian-link-integration-z-axis-20260310.md](docs/solutions/integration-issues/obsidian-link-integration-z-axis-20260310.md)
