# AGENTS.md - Colophon Project Handover

## Project Overview
**Colophon** is an Obsidian plugin designed to provide a "Google Docs" or "Apple Pages" style writing experience for long-form manuscripts, while strictly maintaining **Markdown** as the storage format.

## Core Architecture
- **Framework**: Obsidian API (Vanilla JS, CommonJS).
- **Editor Engine**: **Tiptap** (Headless wrapper around ProseMirror).
- **Build System**: `esbuild` (bundles to `main.js`).
- **File Identity**: Files are identified as manuscripts via frontmatter: `colophon-plugin: manuscript`.
- **Data Storage**: All Tiptap data is stored within a "sidecar" block at the bottom of the file (`%% colophon:data ... %%`).

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
  - **Modes**: Supports 'default' (Main Editor) and 'footnote' (Sidebar, restricted options).
  - Styled with backdrop blur and rounded corners.
- **Footnotes**:
  - **Architecture**: 
    - **Tiptap Extension (`src/extensions/footnote.js`)**: Inline atomic node with dynamic numbering.
    - **Sidebar View (`src/footnote-view.js`)**: Dedicated sidebar for managing footnotes using **Rich Text Tiptap Editors**.
    - **Synchronization**: Sidebar subscribes to main editor updates for real-time deletion and re-ordering.
  - **Styling**: Matches `pages-styles.yaml` (Minion 3 Caption, 10pt). Selection style matches main editor.
  - **Commands**: Intercepts native formatting commands (`bold`, `italic`) to work seamlessly in both main and sidebar editors.
  - **Persistence**: Footnote content is stored in the "sidecar" block (`%% colophon:data ... %%`) as JSON.
- **Substitutions**:
  - **Settings**: "Smart Quotes" (with configurable styles) and "Smart Dashes".
  - **Implementation**: Custom Tiptap extension (`src/extensions/substitutions.js`) using `InputRule`.
  - **Scope**: Applied to both main manuscript and footnote editors.
- **Internal Link**:
  - **Support**: `[[Link]]`, `[[Link|Alias]]`, and `[[Link#Anchor]]`.
  - **Navigation**: Clicking links uses Obsidian's native navigation (`openLinkText`).
  - **Autocomplete**: Typing `[[` triggers a custom `SuggestModal` (`src/link-suggest-modal.js`) listing vault files.
  - **Implementation**: Custom Tiptap extension (`src/extensions/internallink.js`) and Obsidian `SuggestModal`.
- **Standard Links**:
  - **Support**: `[Text](Link)` syntax is detected and treated as an internal link if no protocol is present.
  - **Implementation**: Custom Tiptap extension (`src/extensions/standard-link.js`).

## Key Files Map
- `src/main.js`: Plugin entry, patches, command interception, settings tab.
- `src/view.js`: View container, theme logic, settings application.
- `src/tiptap-adapter.js`: Tiptap editor setup, parsing logic, event handling, subscription system.
- `src/extensions/footnote.js`: Footnote node schema.
- `src/extensions/substitutions.js`: Smart quotes and dashes logic.
- `src/extensions/internallink.js`: Wikilink mark and behavior.
- `src/link-suggest-modal.js`: Autocomplete modal for Internal Link.
- `src/footnote-view.js`: Sidebar view logic, Tiptap instantiation for footnotes.
- `src/popover-menu.js`: UI for the floating context menu.
- `styles.css`: All CSS.

## Next Steps / Roadmap

### 1. Commenting System (Phase 3)
- **Goal**: Google Docs-style comments.
- **Plan**: 
  - Use Tiptap marks for commented ranges.
  - Store comment data in the "Sidecar" block (`%% colophon:data ... %%`).
  - Render comments as floating bubbles in the margin or a dedicated sidebar tab.

### 2. Track Changes (Phase 4)
- **Goal**: Track Changes mode (like Suggestion mode in Google Docs or Review mode in Microsoft Word).
- **Plan**: Use CriticMarkup syntax (`{++ ++}`, `{-- --}`) for storage.

## How to Resume
1.  **Run Build**: `pnpm run build` to ensure everything is fresh.
2.  **Verify Features**: Check Footnotes (rich text, sync), Substitutions (quotes/dashes), and Internal Link (navigation, autocomplete).
3.  **Start Comments**: Begin implementing the Commenting System.
