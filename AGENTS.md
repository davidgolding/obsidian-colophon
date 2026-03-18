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
**Current Focus**: Finalizing high-fidelity features and preparing for beta release.
-   **Legacy Migration System**: Implemented a robust conversion engine (`src/main.js`) that translates legacy v1.x `.md` files into the v2.0 `.colophon` format with 100% data fidelity. Handles block semantic mapping, recursive footnote/comment migration, and list transposition.
-   **Document Integrity & Repair**: Added `TrailingNode` and `repairDocument` logic to `TiptapAdapter` to prevent unselectable empty states and ensure every document starts and ends with an interactive textblock.
-   **Granular Extension Architecture**: Replaced Tiptap `StarterKit` with explicit, granular extension imports. This provides absolute control over the schema, removes unwanted side effects (like accidental `hr` injections), and improves editor performance.
-   **Z-Axis Stabilization**: Completed the implementation of Footnotes and Comments sidebars. Optimized the data sync between the main canvas and sidecar panels.

**Recent Achievements**:
1.  **100% Fidelity Migration**: Successfully automated the transition for legacy users, preserving all semantic block types and sidecar data.
2.  **Automated Testing Suite**: Integrated `vitest` with a comprehensive migration suite (`tests/migration.test.js`) to verify conversion logic against multiple real-world mock scenarios.
3.  **Schema Refinement**: Isolated `HorizontalRule` and custom blocks to ensure the editor defaults to prose blocks rather than structural dividers in empty states.

**Next Steps**:
1.  **Export to .docx**: Implement layout-parity export for final manuscript production.
2.  **Custom Stylesheets**: Enable YAML-based typographic overrides.
3.  **Beta Validation**: Test with large real-world manuscripts to monitor performance of the granular extension stack.

## 4. System Patterns
-   **Architecture**:
    -   **Style Manager (`style-manager.js`)**: Manages `--colophon-editor-width` and global CSS rule injection.
    -   **Tiptap Adapter (`tiptap-adapter.js`)**: The primary controller for scrolling, schema lifecycle, and **document repair**. No longer uses `StarterKit`.
    -   **Universal Block (`extensions/universal-block.js`)**: Generates Node extensions with mandatory unique 6-character `id` attributes.
    -   **Trailing Node (`extensions/trailing-node.js`)**: Ensures documents always end with a textblock.
-   **Migration Logic**:
    -   **List Flattening**: Nested lists are recursively transposed into flat semantic blocks during migration to align with the v2.0 ontology.
    -   **Type Mapping**: Dynamically renames legacy `footnote` nodes to `footnoteMarker` and `internallink` marks to `internalLink` nodes.
-   **Shadow Markdown (Z-Axis Integration)**:
    -   Maintains hidden `.md` files in `.obsidian/plugins/obsidian-colophon/.colophon-cache/` for Obsidian indexing.

## 5. Tech Context
-   **Stack**: Obsidian Plugin API, Tiptap v3 (Granular), `esbuild`, `vitest`.
-   **Critical Files**:
    -   `src/tiptap-adapter.js`: Explicit extension management and document repair logic.
    -   `src/main.js`: Contains the `Convert Legacy Manuscript Files` command and transformation engine.
    -   `tests/migration.test.js`: Canonical verification for the migration engine.

## 6. Progress
-   **Core Engine**:
    -   [x] Settings-driven schema generation
    -   [x] Smart Substitutions & Spellcheck
    -   [x] Fixed Feed Stabilization
    -   [x] Removal of StarterKit (Granular Extension Stack)
    -   [x] Document Repair & Trailing Node logic
-   **Migration & Legacy**:
    -   [x] v1.x to v2.0 Conversion Command
    -   [x] Preservation of Block Semantics (supertitle, epigraph, etc.)
    -   [x] List Transposition/Flattening
    -   [x] Recursive Sidecar Migration
-   **UI**:
    -   [x] Block Settings Editor
    -   [x] Footnotes Sidebar (Z-Axis)
    -   [x] Comments Sidebar (Z-Axis)
-   **To Build**:
    -   [ ] .docx Export Engine
    -   [ ] Custom YAML Stylesheets
