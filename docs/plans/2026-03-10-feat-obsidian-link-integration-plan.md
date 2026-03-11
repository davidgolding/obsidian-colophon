---
title: "feat: Obsidian Link Integration (Z-Axis)"
type: feat
status: active
date: 2026-03-10
origin: docs/brainstorms/2026-03-10-obsidian-link-integration-brainstorm.md
---

# feat: Obsidian Link Integration (Z-Axis)

## Overview
This plan implements a robust internal linking system for Colophon files (`.colophon`), providing full integration with the Obsidian ecosystem. It enables bi-directional links (Backlinks/Graph View), native-style autosuggest, block/header identifiers, and a typographically refined hover-preview.

## Problem Statement / Motivation
Currently, Colophon files are isolated from the Obsidian graph. Users cannot link to other notes or see backlinks to their Colophon documents. This breaks the "networked thought" paradigm that makes Obsidian powerful. We need to bridge Colophon's structured JSON format with Obsidian's Markdown-centric metadata cache.

## Proposed Solution
We will implement **Approach A (The Virtual Markdown Bridge)** as decided in the [brainstorm](docs/brainstorms/2026-03-10-obsidian-link-integration-brainstorm.md). This involves:
1. **Metadata Indexing**: Manually injecting links and block IDs into Obsidian's `MetadataCache` for `.colophon` files.
2. **InternalLink Node**: A new Tiptap node type to store link data as structured objects.
3. **EditorSuggest**: A native Obsidian suggester to provide the `[[` trigger experience.
4. **Block IDs**: Automatically generating 6-character UUIDs for every block to support `#^blockid` linking.
5. **Hover Preview**: A custom provider to render Colophon content in the popover.

## Technical Approach

### 1. The Schema Update
The `.colophon` JSON will now support an `InternalLink` node:
```json
{
  "type": "internalLink",
  "attrs": {
    "target": "Path/To/Note.md",
    "alias": "Optional Alias",
    "blockId": "Optional ^id"
  }
}
```
And every block node will have an `id` attribute:
```json
{
  "type": "body",
  "attrs": { "id": "x7y2z9" },
  "content": [...]
}
```

### 2. Implementation Phases

#### Phase 1: Block IDs & Node Extension
- Update `UniversalBlock` to automatically generate a 6-character ID if missing.
- Create `src/extensions/internal-link.js` with Tiptap `Node.create`.
- Add an input rule to transform `[[Target]]` or `[Alias](Target)` into an `internalLink` node only upon completion (closing `]]` or `)`).

#### Phase 2: Metadata Bridge
- In `main.js`, register an event listener for `app.metadataCache.on('resolve', (file) => { ... })`.
- If the file is `.colophon`, parse the JSON, extract all links and block IDs, and update the cache's `links` and `blocks` arrays.

#### Phase 3: EditorSuggest & UI
- Create `src/ui/link-suggest.js` extending `EditorSuggest`.
- Hook it into `[[` and `[` (if `useMarkdownLinks` is enabled).
- Implement the search logic using `app.metadataCache.getFirstLinkpathDest`.

#### Phase 4: Hover Preview
- Register a custom `hover-provider` in `main.js`.
- Create a minimal "Preview" component that renders the Colophon JSON using our existing `StyleManager` but in a read-only, compact view.

## System-Wide Impact

- **Interaction Graph**: `EditorSuggest` triggers upon input -> user selects note -> `internalLink` node inserted -> `onUpdate` triggers `saveSettings` -> `MetadataCache.on('resolve')` fires to update the graph.
- **Error Propagation**: If a JSON is malformed, the indexer must fail gracefully to avoid breaking the entire vault's metadata cache.
- **State Lifecycle Risks**: Renaming a file while a Colophon document is open needs to update the live editor's state, not just the file on disk.

## Acceptance Criteria
- [ ] Typing `[[` in a Colophon file opens the native Obsidian link suggester.
- [ ] Selecting a note inserts a structured `internalLink` node.
- [ ] Links in Colophon files appear in the **Backlinks** pane of the target note.
- [ ] Colophon files appear in the **Graph View** with correct connections.
- [ ] Every block in a Colophon file has a visible/linkable `^id` (standard Obsidian style).
- [ ] Hovering over a link to a Colophon file shows a rendered preview, not raw JSON.
- [ ] Renaming a target note automatically updates all links in `.colophon` files.

## Sources & References
- **Origin Brainstorm**: [docs/brainstorms/2026-03-10-obsidian-link-integration-brainstorm.md](docs/brainstorms/2026-03-10-obsidian-link-integration-brainstorm.md)
- **Carried Forward Decisions**: Approach A (Virtual Bridge), Structured Option B, Random 6-char UUIDs, Plain-text-to-object drafting.
- **API Documentation**: [Obsidian Developer Docs - MetadataCache](https://docs.obsidian.md/Reference/TypeScript+API/MetadataCache)
- **Existing Patterns**: `src/extensions/substitutions.js` (for input rules), `src/extensions/universal-block.js` (for block structures).
