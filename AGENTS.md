# AGENTS.md - Colophon Project Handover (v2.0)

## 1. Project Brief
**Colophon** is an Obsidian plugin that implements a **Word Composition** environment, a third paradigm distinct from Word Processing and Markdown. It provides a dedicated writing canvas offering the typographic elegance and semantic structure of a word processor with the focus and clean input method of Markdown. It uses a custom `.colophon` JSON format to ensure absolute consistency in semantic blocks (`Y-Axis`) and rhetorical inflection (`X-Axis`) while removing the visual noise of syntax.

**Core Innovation**:
-   **Schema-First Architecture**: Unlike standard editors, the document schema is derived entirely from user settings (`settings-data.js`).
-   **Universal Blocks**: A single Tiptap extension (`universal-block.js`) dynamically generates all block types (Heading, Body, Epigraph) based on this configuration.
-   **v1.x Compatibility**: While the engine is new, the visual rendering is strictly aligned with v1.x CSS classes and HTML structure to ensure established themes work seamlessly.

## 2. Product Context
**Philosophy: Word Composition**
-   **Paradigm**: "What you see is word-craft."
-   **Aesthetic**: Bibliophile, editorial, distraction-free.
-   **Ontology**:
    -   **Y-Axis (Block)**: Structural intent (Paragraph, Header, Attestation). Locked geometry.
    -   **X-Axis (Inline)**: Rhetorical inflection (Focus/Bold, Voice/Italic). Modifies flow.
    -   **Z-Axis (Transversal)**: Relations (Footnotes, Comments). Exits the flow.
    -   **T-Axis (Temporal)**: State (Version history).

## 3. Active Context
**Current Focus**: Building out the Sidebars for the Z-Axis (Footnotes and Comments).
-   **Fixed Feed (Typewriter Mode)**: Fully stabilized. Uses permanent `75vh` CSS padding and inline `handleScroll` logic in `TiptapAdapter` for reliable viewport-relative locking.
-   **Block Settings UI**: Implemented a comprehensive UI for managing block definitions. Supports horizontal property layouts, dynamic property addition/removal, and protected default blocks. Use custom Obsidian Modals for input to ensure platform compatibility.
-   **Dynamic Schema Updates**: `TiptapAdapter` now detects structural changes in block definitions (new keys/triggers) and automatically re-mounts the editor to update the schema on-the-fly.

**Recent Achievements**:
1.  **Fixed Feed Achievement**: Successfully stabilized typewriter mode with robust logic ported from `main`.
2.  **Block Settings UI Achievement**: Created a refined interface for customizing the writing environment's typography and behavior.
3.  **Schema Reactivity**: Implemented editor re-mounting logic to support live block definition updates.

**Next Steps**:
1.  **Sidebar Implementation (Z-Axis)**: Build the Right Sidebar for Footnotes.
2.  **Comments Panel Implementation**: Finalize the in-view/sidebar pane for Comments.
3.  **Refine Typographic Injection**: Ensure all property changes in Block Settings are immediately reflected in the editor via `StyleManager`.

## 4. System Patterns
-   **Architecture**:
    -   **Style Manager (`style-manager.js`)**: Manages `--colophon-editor-width` and global CSS rule injection.
    -   **Tiptap Adapter (`tiptap-adapter.js`)**: Now the primary controller for scrolling (`handleScroll`) and schema lifecycle (`updateSettings`).
    -   **Universal Block (`extensions/universal-block.js`)**: Generates Node extensions. Blocks automatically receive a 6-character `id` attribute (e.g. `^x7y2z9`) for Z-axis linking.
    -   **Metadata Manager (`metadata-manager.js`)**: Manages the "Shadow Markdown" bridge.
-   **Shadow Markdown (Z-Axis Integration)**:
    -   To ensure `.colophon` files participate in Obsidian's Graph and Backlinks, the plugin maintains hidden `.md` files in `.obsidian/plugins/obsidian-colophon/.colophon-cache/`.
    -   These files use base64-encoded filenames derived from the original path.
    -   **Agent Tip**: If you need to find backlinks to a Colophon file, look at its corresponding shadow file. To create a link, insert an `internalLink` node in the JSON or use the `Insert Internal Link` command.
-   **Component Relationships**:
    `BlockSettingsUI` -> `plugin.settings` -> `saveSettings()` -> `View.updateSettings()` -> `Adapter.updateSettings()`.

## 5. Tech Context
-   **Stack**: Obsidian Plugin API, Tiptap v3, `esbuild` for bundling.
-   **Critical Files**:
    -   `src/tiptap-adapter.js`: The heart of editor reactivity and scrolling.
    -   `src/extensions/universal-block.js`: Dynamic node generator.
    -   `src/ui/block-settings.js`: Manages the block definition interface.
    -   `styles.css`: Contains permanent layout padding and Block Settings aesthetics.

## 6. Progress
-   **Core Engine**:
    -   [x] Settings-driven schema generation
    -   [x] Universal Block Extension
    -   [x] Smart Substitutions (Quotes/Dashes)
    -   [x] Spellcheck Synchronization
    -   [x] Fixed Feed Stabilization
    -   [x] Dynamic Schema Updates (Re-mounting)
-   **UI**:
    -   [x] Plugin Settings Tab
    -   [x] Block Settings Editor (with modal support)
    -   [x] Contextual Toolbar (Header)
-   **To Build**:
    -   [ ] Footnotes Sidebar (Z-Axis)
    -   [ ] Comments Sidebar (Z-Axis)