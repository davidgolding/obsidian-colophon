---
date: 2026-03-10
topic: obsidian-link-integration
---

# Obsidian Link Integration (Z-Axis)

## What We're Building
A robust internal linking system for Colophon files (`.colophon`) that provides first-class citizenship within the Obsidian ecosystem. This includes bi-directional link indexing (Backlinks/Graph), native-style autosuggest, support for block/header identifiers, and a custom typographic hover-preview.

## Why This Approach
We chose **Approach A (The Virtual Markdown Bridge)** to ensure that `.colophon` files are indexed exactly like Markdown files. By manually injecting data into Obsidian's `MetadataCache`, we gain full support for Graph View, Search, and Backlinks without requiring Obsidian to natively "understand" our JSON format.

## Key Decisions
- **Link Format (Option B)**: Stored as structured objects in the JSON schema (`{ type: 'link', target: 'Path/To/File', alias: 'Display Text' }`).
- **Standard Parity**: Support both Wikilinks (`[[ ]]`) and Markdown links (`[ ]( )`) based on the user's global Obsidian settings (`useMarkdownLinks`).
- **Block Identifiers**: Every block-level entity will automatically receive a unique, persistent **random 6-character ID** (e.g., `^8f2a1b`) upon creation to ensure seamless linking to specific paragraphs or headings.
- **Partial Link States (Option B)**: Links being typed are treated as plain text in the JSON until the closing `]]` (or markdown syntax) is complete, at which point they are transformed into structured link objects. This preserves document integrity.
- **Metadata Indexing**: Use `app.metadataCache.on('resolve', ...)` to "virtualize" Colophon content for the Obsidian indexer.
- **Rename Handling**: Listen for `vault.on('rename')` to perform automated, cross-file JSON updates to keep all internal links valid.
- **Hover Preview**: Implement a custom renderer to show a typographically refined preview of Colophon files instead of raw JSON.
- **Autosuggest**: Register a native `EditorSuggest` triggered by `[[` (or `[` for Markdown links) that respects the user's "Show all file types" settings.

## Resolved Questions
- **ID Format**: Confirmed random 6-character strings (standard Obsidian block-ID style).
- **Drafting State**: Confirmed plain-text-to-object conversion upon completion.

## Open Questions
- **Performance at Scale**: How will the `on('resolve')` hook perform in vaults with thousands of Colophon files? (May require a debounced or background indexing strategy).
- **ID Regeneration**: If a block is deleted and "undone", does it keep the same ID? (Tiptap's history should handle this, but needs verification).

## Next Steps
→ `/ce:plan` for implementation details of the `MetadataCache` bridge and `EditorSuggest` handler.
