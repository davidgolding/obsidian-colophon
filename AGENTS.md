# AGENTS.md - Colophon Project Handover

## Project Overview
**Colophon** is an Obsidian plugin designed to provide a "Google Docs" or "Apple Pages" style writing experience for long-form manuscripts, while strictly maintaining **Markdown** as the storage format.

## Core Architecture
- **Framework**: Obsidian API (Vanilla JS, CommonJS).
- **Editor Engine**: **Tiptap** (Headless wrapper around ProseMirror).
- **Build System**: `esbuild` (bundles to `main.js`).
- **File Identity**: Files are identified as manuscripts via frontmatter: `colophon-plugin: manuscript`.

## Current Implementation State (Checkpoint)

### 1. View System
- **Interception**: `WorkspaceLeaf.prototype.openFile` is patched in `main.js` to detect manuscript files and open them directly in `ColophonView`, bypassing the default `MarkdownView` to prevent FOUC.
- **ColophonView (`src/view.js`)**: 
  - Manages the Tiptap instance via `TiptapAdapter`.
  - Handles theme overrides (Light/Dark/Auto) for the canvas area.
  - Shows a loading spinner during initialization.

### 2. Editor & Styling
- **Tiptap Adapter (`src/tiptap-adapter.js`)**: 
  - Wraps the Tiptap `Editor` class.
  - Implements custom Markdown parsing in `parseMarkdown()` to handle footnotes and basic formatting.
  - Syncs with Obsidian's "Spell check" setting.
- **Styling (`styles.css`)**:
  - **Layout**: Single centered column with user-configurable width (`--colophon-editor-width`).
  - **Typography**: High-quality serif stack (Minion 3, Charter), margin collapsing for vertical rhythm.
  - **Theme**: Adaptive background (`var(--background-primary)`), with specific overrides for the canvas area.

### 3. Features
- **Context Menu Popover (`src/popover-menu.js`)**: 
  - Appears on right-click with selection.
  - Provides styling (H1-H3, Body), formatting (Bold, Italic, Small Caps, etc.), and "Add Footnote".
  - Styled with backdrop blur and rounded corners.
- **Footnotes (`src/tiptap-footnotes.js`)**:
  - **Extension**: Custom Tiptap extension defining `footnoteReference` (inline superscript) and `footnoteDefinition` (block at bottom).
  - **Parsing**: `TiptapAdapter` parses standard Markdown footnotes (`[^1]`, `[^1]: ...`) into these nodes.
  - **Commands**: Intercepts Obsidian's `editor:insert-footnote` command to use the plugin's logic.
  - **Structure**: Fixed `RangeError` by ensuring footnote content holes are wrapped in a container (`.footnote-content`).

## Key Files Map
- `src/main.js`: Plugin entry, patches, command interception, settings tab.
- `src/view.js`: View container, theme logic, settings application.
- `src/tiptap-adapter.js`: Tiptap editor setup, parsing logic, event handling.
- `src/tiptap-footnotes.js`: Footnote node schemas and commands.
- `src/popover-menu.js`: UI for the floating context menu.
- `styles.css`: All CSS.

## Next Steps / Roadmap

### 1. Persistence & Serialization (Critical)
- **Current Status**: We have a robust `load()` method that parses Markdown to Tiptap.
- **Missing**: We need to ensure the `save()` method (via `io.js` or `TiptapAdapter`) correctly serializes the Tiptap document *back* to Markdown, especially the new Footnote nodes.
- **Action**: Verify `io.js` `serializeFile` or implement a Tiptap `serializer` to convert `footnoteReference` and `footnoteDefinition` back to `[^id]` and `[^id]: content`.

### 2. Commenting System (Phase 3)
- **Goal**: Google Docs-style comments.
- **Plan**: 
  - Use Tiptap marks for commented ranges.
  - Store comment data in a "Sidecar" block at the bottom of the file (`%% colophon:data ... %%`).
  - Render comments as floating bubbles in the margin.

### 3. Track Changes (Phase 4)
- **Goal**: Suggestion mode.
- **Plan**: Use CriticMarkup syntax (`{++ ++}`, `{-- --}`) for storage.

## How to Resume
1.  **Run Build**: `pnpm run build` to ensure everything is fresh.
2.  **Verify Persistence**: Type some text and add a footnote. Save the file. Close and reopen. Check if the footnote persists in the underlying Markdown file. This is likely the first thing to fix/implement.
3.  **Proceed to Comments**: Once persistence is solid, start on the Commenting System.
