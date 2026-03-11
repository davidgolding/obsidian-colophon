---
module: "Obsidian Link Integration"
date: 2026-03-10
problem_type: integration_issue
component: links
symptoms:
  - "Colophon files isolated from Obsidian's Graph View and Backlinks"
  - "Lack of native-style autosuggest for internal links in Tiptap"
  - "Performance lag during vault-wide file renames"
root_cause: "Obsidian's indexer is Markdown-centric and doesn't natively parse custom JSON formats for links/blocks."
severity: high
tags: [obsidian, tiptap, links, indexing, performance]
---

# Obsidian Link Integration (Z-Axis)

## Problem Statement
Colophon uses a custom `.colophon` JSON format. Because Obsidian's core indexing engine (Graph View, Backlinks, Search) is optimized for Markdown, these files were initially isolated. Users couldn't see what was linking to their manuscripts, and typing `[[` didn't provide suggestions.

## Working Solution

### 1. The "Shadow Markdown" Bridge
To bridge the gap without modifying Obsidian's core, we implemented a "Shadow" indexing strategy.
- For every `.colophon` file, the plugin maintains a hidden `.md` file in `.obsidian/plugins/obsidian-colophon/.colophon-cache/`.
- These shadow files contain raw wikilinks (`[[Note]]`) and block IDs (`^id`) extracted from the JSON.
- This "tricks" Obsidian's indexer into including the Colophon data in the global graph.

### 2. Tiptap InternalLink & Live Preview
We created a custom `InternalLink` node with a `NodeView` to mimic Obsidian's "Live Preview" behavior.
- **Render Mode**: Brackets are hidden; the link appears as a clean typographic chip.
- **Source Mode**: When the cursor enters the link or sits adjacent to it, the brackets `[[target|alias]]` unfurl for editing.
- **Navigation**: Simple click while selected (brackets visible) or Cmd/Ctrl+Click opens the file.

### 3. Optimized Rename Handling
Initial implementation scanned the entire vault on every rename ($O(N)$). We optimized this using Obsidian's `metadataCache`:
```javascript
// src/metadata-manager.js
async handleGenericRename(file, oldPath) {
    const resolvedLinks = this.app.metadataCache.resolvedLinks;
    const affectedColophonPaths = new Set();

    for (const [sourcePath, links] of Object.entries(resolvedLinks)) {
        if (links[oldPath] !== undefined && sourcePath.startsWith(this.cacheFolderName)) {
            const colophonPath = this.getColophonPathFromShadow(sourcePath);
            if (colophonPath) affectedColophonPaths.add(colophonPath);
        }
    }
    // ... update only affectedColophonPaths
}
```

## Prevention & Best Practices
- **Use Shadow Files for Parity**: When building custom formats in Obsidian, shadow files are the most robust way to ensure Graph/Backlink parity.
- **Reversible Mappings**: Use base64 or stable hashes for shadow filenames so you can map back to original files without disk I/O.
- **RAF for DOM Updates**: Always wrap `NodeView` updates in `requestAnimationFrame` and use change-detection (`lastIsSelected`) to prevent layout jank during typing.

## References
- **Tiptap v3 Documentation**: [NodeViews](https://tiptap.dev/docs/editor/guide/node-views)
- **Obsidian API**: [MetadataCache](https://docs.obsidian.md/Reference/TypeScript+API/MetadataCache)
