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
**Current Focus**: Refining the v2.0 UI/UX and stabilizing specialized engine behaviors.
-   **Recent Achievements**:
    1.  **Spellcheck Synchronization**: Integrated Obsidian core spellcheck setting into the Tiptap editor via `this.app.vault.getConfig('spellcheck')`.
    2.  **Font Unit Normalization**: Established a strict `10pt = 1rem` conversion rule in `StyleManager` to align Colophon typography with Obsidian's base scaling while supporting `pt`, `px`, `in`, `pc`, etc.
    3.  **Toolbar Relocation**: Moved the `ColophonToolbar` from the editor canvas to the native Obsidian `.view-header-title-container`, re-enabling the header for Colophon views.
    4.  **Strict Schema Enforcement**: Disabled default Tiptap/StarterKit extensions to force all content through `UniversalBlock`.
    5.  **v1.x Rendering Alignment**: Refactored `UniversalBlock` to output semantic tags and aligned classes to legacy names.
-   **Active Decisions**:
    -   **Unit Alignment**: We treat `10pt` as `1rem`. This allows writers to input familiar physical units while the browser renders them relative to the user's Obsidian font size settings.
    -   **Contextual UI**: The toolbar now sits in the view header to keep the writing canvas distraction-free.
-   **Learnings**:
    -   **Header Injection**: Injecting into `.view-header-title-container` requires ensuring the container is set to `display: flex` and the header has the `.colophon-view-header` class.

**Next Steps**:
1.  **Sidebar Implementation (Z-Axis)**: Build the Right Sidebar for Footnotes and In-View pane for Comments. This is the primary upcoming technical objective.
2.  **Settings UI**: Build the complex UI to let users edit the `data.json` block definitions.

## 4. System Patterns
-   **Architecture**:
    -   **Style Manager (`style-manager.js`)**: Now includes `normalizeValue` to handle the `rem` conversion logic for all typographic and geometric properties.
    -   **View Header Patching**: `view.js` now adds `.colophon-view-header` to the header and manages the toolbar lifecycle within the Obsidian title container.
    -   **Universal Block (`extensions/universal-block.js`)**: The factory that generates strict Node extensions from settings.
-   **Component Relationships**:
    `Settings` -> `StyleManager` (Units -> CSS Variables)
    `Settings` -> `UniversalBlock` (Schema) -> `TiptapAdapter` (Editor)

## 5. Tech Context
-   **Stack**: Obsidian Plugin API, Tiptap v3, `esbuild` for bundling.
-   **Critical Files**:
    -   `src/style-manager.js`: The source of truth for unit conversion logic.
    -   `src/view.js`: Manages the toolbar injection into the Obsidian core UI.

## 6. Progress
-   **Core Engine**:
    -   [x] Settings-driven schema generation
    -   [x] Universal Block Extension
    -   [x] Legacy Content Migration (`migrateContent`)
    -   [x] Spellcheck Synchronization (Core Sync)
    -   [x] Font Unit Normalization (`10pt = 1rem`)
-   **UI**:
    -   [x] Contextual Toolbar (Relocated to Header)
    -   [x] Editor Layout & Typography
-   **To Build**:
    -   [ ] Footnotes Sidebar (Z-Axis)
    -   [ ] Comments Sidebar (Z-Axis)
    -   [ ] Settings Interface