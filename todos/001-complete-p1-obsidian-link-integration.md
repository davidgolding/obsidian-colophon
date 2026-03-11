---
status: complete
priority: p1
issue_id: "001"
tags: [links, obsidian, indexing, tiptap]
dependencies: []
---

# Obsidian Link Integration (Z-Axis)

## Problem Statement
Colophon files are isolated from Obsidian's metadata cache. We need to implement internal linking that supports Obsidian's graph, backlinks, and autosuggest while maintaining our "Word Composition" JSON structure.

## Proposed Solution
- **Phase 1**: Add persistent 6-character Block IDs to all universal blocks. Implement the `InternalLink` Tiptap node.
- **Phase 2**: Create the `MetadataCache` bridge in `main.js` to inject links/blocks into Obsidian's index.
- **Phase 3**: Implement `EditorSuggest` for `[[` and `[` triggers.
- **Phase 4**: Add custom Hover Preview rendering.

## Acceptance Criteria
- [x] Every block automatically gets a 6-char random ID in JSON.
- [x] `[[Link]]` converts to a structured `internalLink` node on completion.
- [x] Typing `[[` or `[` (if enabled) opens a custom Tiptap link suggester.
- [x] Obsidian's Backlinks pane shows links from Colophon files (via shadow files).
- [x] Graph View correctly shows connections (via shadow files).
- [x] Hover preview renders Colophon content.

## Work Log

### 2026-03-10 - Initialization
**By:** Gemini CLI
**Actions:**
- Created feature branch `feat/obsidian-link-integration`.
- Initialized todo `001`.
- Identified `src/extensions/universal-block.js` for Block ID implementation.

### 2026-03-10 - Phase 1: Core Extensions
**By:** Gemini CLI
**Actions:**
- Implemented automatic 6-character block ID generation in `src/extensions/universal-block.js`.
- Created `src/extensions/internal-link.js` with Tiptap node and input rules for `[[Wikilinks]]` and `[Markdown](links)`.
- Integrated `InternalLink` into `src/tiptap-adapter.js`.
- Added styles for `data-colophon-link` in `styles.css`.

### 2026-03-10 - Phase 3: EditorSuggest
**By:** Gemini CLI
**Actions:**
- Created `src/ui/tiptap-link-suggest.js` to provide native-style link suggestions within Tiptap.
- Integrated `TiptapLinkSuggest` into `TiptapAdapter`.
- Updated `ColophonView` to pass `app` and `plugin` to the adapter.

### 2026-03-10 - Phase 2: Metadata Bridge
**By:** Gemini CLI
**Actions:**
- Created `src/metadata-manager.js` to handle indexing of Colophon files.
- Implemented "Shadow Markdown" strategy: Automatically generates hidden `.md` files in `.colophon-cache/` to enable native Obsidian graph and backlink support.
- Implemented automatic link updates in Colophon files when target files are renamed in the vault.

### 2026-03-10 - Phase 4: Hover Preview & Polish
**By:** Gemini CLI
**Actions:**
- Implemented custom hover preview logic in `MetadataManager` (links now point to indexed shadow files which Obsidian previews natively).
- Verified build via `pnpm build`.
