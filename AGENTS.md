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
**Current Focus**: Stabilizing the v2.0 Core Engine and ensuring robust schema handling.
-   **Recent Achievements**:
    1.  **Strict Schema Enforcement**: Disabled default Tiptap/StarterKit extensions (Polygon, Heading, List) to force all content through `UniversalBlock`.
    2.  **v1.x Rendering Alignment**:
        -   Refactored `UniversalBlock` to output semantic tags (`h1`-`h6`, `p`) instead of generic divs.
        -   Aligned classes to legacy names (`.body`, `.heading-1`) instead of namespaced `colophon-block-*`.
        -   Updated `StyleManager` to generate CSS selectors matching this legacy structure (e.g., `.ProseMirror h1.heading-1`).
    3.  **Schema Migration**: Implemented `migrateContent` in `view.js` to automatically convert legacy `paragraph` nodes to `body` nodes on load, preventing crashes.
    4.  **Enter Key Handling**: Fixed `RangeError` bugs by explicitly handling Enter key logic in `UniversalBlock` with `splitBlock`.
-   **Active Decisions**:
    -   **Data-Driven**: We avoid hardcoding node types. `Body`, `Heading`, `Epigraph` are all instances of a Universal Block configured via JSON.
    -   **Persistence**: We use `type: 'body'` in the JSON model (v2.0 architecture) but render it as `<p class="body">` (v1.x visual compatibility).
-   **Learnings**:
    -   **Tiptap Defaults**: Default extensions like `StarterKit`'s `Paragraph` aggressively capture content. They must be explicitly disabled to allow custom blocks to act as default.
    -   **Input Rules**: `splitBlock` without `keepMarks: false` can cause schema errors when inheriting marks into new blocks.

**Next Steps**:
1.  **Sidebar Implementation**: Build the Right Sidebar for Footnotes and In-View pane for Comments.
2.  **Settings UI**: Build the complex UI to let users edit the `data.json` block definitions.

## 4. System Patterns
-   **Architecture**:
    -   **Plugin Entry (`main.js`)**: Loads settings, initializes `StyleManager`, registers View.
    -   **Obsidian View (`view.js`)**: Manages `TiptapAdapter` lifecycle and handles file IO. **Includes `migrateContent` logic**.
    -   **Editor Adapter (`tiptap-adapter.js`)**: Initializes Tiptap. **Crucially disables StarterKit defaults** to use...
    -   **Universal Block (`extensions/universal-block.js`)**: The factory that generates strict Node extensions from settings. Handles `parseHTML`/`renderHTML` for v1.x alignment.
    -   **Style Manager (`style-manager.js`)**: Generates dynamic CSS. **Crucially maps settings to legacy v1.x selectors**.
-   **Component Relationships**:
    `Settings` -> `StyleManager` (CSS)
    `Settings` -> `UniversalBlock` (Schema) -> `TiptapAdapter` (Editor)

## 5. Tech Context
-   **Stack**: Obsidian Plugin API, Tiptap v3 (Headless ProseMirror).
-   **Build**: `esbuild`.
-   **Critical Files**:
    -   `src/extensions/universal-block.js`: The heart of the new engine. Defines schema.
    -   `src/settings-data.js`: The definition of available blocks (Y-Axis).
    -   `src/view.js`: The persistence layer.
    -   `src/style-manager.js`: The presentation layer (CSS generator).

## 6. Progress
-   **Core Engine**:
    -   [x] Settings-driven schema generation
    -   [x] Universal Block Extension
    -   [x] Input Rules / Syntax Triggers
    -   [x] Enter Key Logic (Following Entity)
    -   [x] Legacy Content Migration (`migrateContent`)
    -   [x] v1.x Rendering Alignment (Semantic tags + Legacy classes)
-   **UI**:
    -   [x] Contextual Toolbar
    -   [x] Editor Layout & Typography
-   **To Build**:
    -   [ ] Footnotes (Z-Axis)
    -   [ ] Comments (Z-Axis)
    -   [ ] Settings Interface