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

### 1. File Handling
- **Registration**: `main.js` registers the `.colophon` extension and maps it to `ColophonView`.
- **Creation**: Supports creating new files via Ribbon icon, Command Palette, and Folder context menu.
- **Persistence**: `TextFileView` handles `setViewData` (loading) and `getViewData` (saving) automatically.

### 2. ColophonView (`src/view.js`)
- **Tiptap Integration**: Manages a Tiptap `Editor` instance.
- **Dynamic Content**: Detects `docType` from the file JSON and applies CSS classes (`type-manuscript` or `type-script`) to the container for styling.
- **Auto-save**: Calls `requestSave()` on Tiptap updates.

### 3. Styling (`styles.css`)
- (Styling logic from v1.0 is being ported/refactored to target `.colophon-view` and the new type-specific classes).

## Key Files Map
- `src/main.js`: Plugin entry point, view registration, commands, and menu items.
- `src/view.js`: Core `TextFileView` implementation and Tiptap lifecycle.
- `styles.css`: Visual presentation for Manuscript and Script modes.

## Next Steps / Roadmap
- **Refine Styling**: Re-implement the high-fidelity typography for both modes in the new view structure.
- **Extensions**: Port v1.0 extensions (Footnotes, Script Formatting, Substitutions, Word Count) to the new Tiptap 3.x setup.
- **DOCX Export**: Port the export logic to work with the JSON-based data structure.

## How to Resume
1. **Run Build**: `pnpm build`.
2. **Test Creation**: Use the Ribbon or right-click a folder to create a new `.colophon` file.
3. **Verify Persistence**: Type in the editor, close the tab, and re-open to ensure data is saved/loaded correctly.