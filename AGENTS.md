# AGENTS.md - Colophon Project Handover (v2.0)

## Project Overview
**Colophon** is an Obsidian plugin designed to provide an elegant and typographically clean writing experience for long-form manuscripts and screenplays. Version 2.0 transitions from a Markdown-based "sidecar" approach to a dedicated `.colophon` file format (JSON) for better performance and reliability.

## Core Architecture
- **Framework**: Obsidian API (Vanilla JS).
- **Editor Engine**: **Tiptap** (Headless wrapper around ProseMirror).
- **Build System**: `esbuild` (bundles to `main.js`).
- **File Identity**: Files use the `.colophon` extension.
  - Content is JSON, containing a `type` ("manuscript" or "script") and a `doc` (Tiptap JSON).
- **View System**: Implements `TextFileView`, registered via `registerExtensions`. This allows Obsidian to natively handle file opening and lifecycle management.

## Current Implementation State (v2.0 Bare Bones)

### 1. File Creation Workflow
- **Modal Interception**: `createNewColophonFile` creates an "Untitled" file, opens it, then immediately prompts with a `FileNameModal` for renaming. mimics native "Create & Rename" flow.
- **Selection**: Ensures the new file is highlighted in the file explorer.

### 2. Architecture Refactor
- **`src/tiptap-adapter.js`**: Introduced to encapsulate all Editor interaction (Tiptap v3).
- **`src/view.js`**: Simplified to handle only Obsidian View lifecycle.
- **`styles.css`**: Scoped strictly to `.colophon-workspace`.

### 3. Native Integration
- **Command Patching**: `main.js` patches `editor:toggle-bold` and `editor:toggle-italics`.
  - Routes commands to `ColophonView.adapter` if active.
  - Fallbacks to native Obsidian behavior otherwise.
- **Styling**: Explicit rules added for `strong`, `b`, `em`, `i` to ensure visibility in `styles.css`.

## Key Files Map
- `src/main.js`: Plugin entry, command patching, file creation logic.
- `src/tiptap-adapter.js`: Tiptap editor wrapper and state management.
- `src/view.js`: Obsidian `TextFileView` implementation.
- `styles.css`: Visual presentation.

## Next Steps / Roadmap
## Next Steps / Roadmap
- **Headers & Block Styles**: Implement formatting for Headings, Blockquotes, etc.
- **Comments System**: Begin implementation of comments (Data structure + UI).
- **Extensions**: Port v1.0 extensions (Footnotes, Script Formatting, Word Count).
- **DOCX Export**: Port the export logic to work with the JSON-based data structure.

## How to Resume
1. **Run Build**: `pnpm build`.
2. **Test Creation**: Use the Ribbon or right-click a folder to create a new `.colophon` file.
3. **Verify Persistence**: Type in the editor, close the tab, and re-open to ensure data is saved/loaded correctly.