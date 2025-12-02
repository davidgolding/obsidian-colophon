# AGENTS.md - Colophon Project Handover

## Project Overview
**Colophon** is an Obsidian plugin designed to provide an elegant and typographically clean writing experience for long-form manuscripts and screenplays, while strictly maintaining **Markdown** as the storage format.

## Core Architecture
- **Framework**: Obsidian API (Vanilla JS, CommonJS).
- **Editor Engine**: **Tiptap** (Headless wrapper around ProseMirror).
- **Build System**: `esbuild` (bundles to `main.js`).
- **File Identity**: Files are identified via frontmatter:
  - Manuscript: `colophon-plugin: manuscript`
  - Script: `colophon-plugin: script`
- **Data Storage**: All Tiptap data (footnotes, comments) is stored within a "sidecar" block at the bottom of the file (`%% colophon:data ... %%`).

## Current Implementation State (Checkpoint)

### 1. View System
- **Interception**: `WorkspaceLeaf.prototype.openFile` is patched in `main.js` to detect Colophon files and open them directly in `ColophonView`, bypassing the default `MarkdownView`.
- **ColophonView (`src/view.js`)**: 
  - Manages the Tiptap instance via `TiptapAdapter`.
  - **White Canvas Mode**: Toggles a forced light theme for the canvas area (`toggleTheme()`), overriding CSS variables.
  - **Word Count**: Displays a live word count (Main + Footnotes) via `toggleWordCount()`.
  - **Icon**: Dynamically sets tab icon to 'feather' (Manuscript) or 'clapperboard' (Script).

### 2. Editor & Styling
- **Tiptap Adapter (`src/tiptap-adapter.js`)**: 
  - Wraps the Tiptap `Editor` class.
  - **Script Mode Support**: Loads `ScriptFormatting` extension and applies `is-script-mode` class based on `docType`.
  - **Global Scale Factor**: `StyleManager` applies a global scale factor to all dimension values in `DEFAULT_STYLES`.
- **Styling (`styles.css`)**:
  - **Manuscript**: Single centered column, serif typography (Minion 3, Charter).
  - **Script Mode**: Fixed 8.5" width, Courier Prime font, specific margins for Scene/Action/Character/Dialogue.
  - **Page Divisions**: Visual 1px line every 11 inches to simulate pages.
  - **Typography**: Explicit support for Bold, Italic, Strikethrough, and Underline in both modes.

### 3. Features
- **Script Mode (`src/extensions/script-formatting.js`)**:
  - **Auto-Formatting**: Detects `INT./EXT.` for Scene Headings, `TO:` for Transitions.
  - **Smart Navigation**: Tab/Enter keys navigate between script elements (Action -> Character -> Dialogue) per industry standards.
  - **Command Disabling**: "Insert Footnote" is explicitly disabled in Script Mode via `patchCommand` predicate.
- **Native Command Interception**:
  - `main.js` patches `editor:toggle-bold`, `editor:toggle-italics`, etc., routing them to the active Colophon editor.
  - `editor:insert-footnote` is patched with a predicate to disable it in Script Mode.
- **Context Menu Popover (`src/popover-menu.js`)**: 
  - Provides styling and formatting options.
  - **Modes**: Supports 'default' (Main Editor) and 'footnote' (Sidebar).
- **Footnotes**:
  - **Architecture**: Inline atomic node + Sidebar View (`src/footnote-view.js`).
  - **Sync**: Real-time synchronization between main editor and sidebar.
- **Substitutions**: Smart Quotes and Dashes via `src/extensions/substitutions.js`.
- **Internal & Standard Links**: Wikilink and Markdown link support with autocomplete (`src/link-suggest-modal.js`).
- **List Support**: Richly customizable bullet/ordered lists.
- **DOCX Export**: High-fidelity export via `src/extensions/docx-serializer.js` and `src/minimal-docx.js`.

## Key Files Map
- `src/main.js`: Plugin entry, command patching (with predicates), settings tab.
- `src/view.js`: View container, theme logic, word count, icon logic.
- `src/tiptap-adapter.js`: Editor setup, docType handling, style loading.
- `src/extensions/script-formatting.js`: Script Mode input rules and key bindings.
- `src/extensions/footnote.js`: Footnote node schema.
- `src/extensions/substitutions.js`: Smart quotes/dashes.
- `src/style-manager.js`: CSS generation, global scaling logic.
- `styles.css`: All CSS, including Script Mode specific styles.

## Next Steps / Roadmap

### 1. Commenting System (In Progress/Next)
- **Goal**: Google Docs-style comments.
- **Current Status**: `CommentsPanel` class exists, basic UI structure.
- **Next**: Implement Tiptap marks for comments, storage in sidecar, and full UI interaction.

### 2. Track Changes (Phase 4)
- **Goal**: Track Changes mode (CriticMarkup).

## How to Resume
1.  **Run Build**: `npm run build` (or `pnpm`).
2.  **Verify Script Mode**: Create a script, test formatting (Scene/Action/Dialogue), check disabled footnote command.
3.  **Verify Manuscript**: Check word count, white canvas mode, footnotes.
4.  **Continue Comments**: Proceed with the Commenting System implementation.
