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
-   **Fixed Feed (Typewriter Mode)**: Stabilized by porting robust architectural patterns from `main`. Implemented permanent `75vh` padding and inline handleScroll logic for predictable behavior.
-   **Recent Achievements**:
    1.  **Plugin Settings System**: Implemented a comprehensive settings tab (`settings-tab.js`) for global plugin preferences.
    2.  **Smart Substitutions**: Ported 1.x smart quotes and dashes logic to a new Tiptap extension (`extensions/substitutions.js`).
    3.  **Fixed Feed Achievement**: Successfully stabilized typewriter mode with robust viewport-relative scrolling.

**Next Steps**:
1.  **Stabilize Fixed Feed**: Debug the scroll calculation in `fixed-feed.js` to ensure perfect locking to the padding line on all triggers.
2.  **Sidebar Implementation (Z-Axis)**: Build the Right Sidebar for Footnotes and In-View pane for Comments.
3.  **Block Settings UI**: Implement the interface to let users edit the `DEFAULT_SETTINGS.blocks` definitions.

## 4. System Patterns
-   **Architecture**:
    -   **Style Manager (`style-manager.js`)**: Manages `--colophon-editor-width` and `.is-fixed-feed` padding.
    -   **Fixed Feed Helper**: `scrollActiveLineIntoView` is exported from `fixed-feed.js` so it can be triggered by the `TiptapAdapter` immediately on settings change.
    -   **Universal Block (`extensions/universal-block.js`)**: The factory that generates strict Node extensions from settings.
-   **Component Relationships**:
    `Settings` -> `main.js` (Broadcast) -> `ColophonView` (updateSettings) -> `TiptapAdapter` (setOptions) -> `Extensions`.

## 5. Tech Context
-   **Stack**: Obsidian Plugin API, Tiptap v3, `esbuild` for bundling.
-   **Critical Files**:
    -   `src/extensions/fixed-feed.js`: Contains the typewriter scrolling math.
    -   `src/extensions/substitutions.js`: Custom input rules for smart punctuation.
    -   `src/tiptap-adapter.js`: The reactivity hub for the editor.

## 6. Progress
-   **Core Engine**:
    -   [x] Settings-driven schema generation
    -   [x] Universal Block Extension
    -   [x] Smart Substitutions (Quotes/Dashes)
    -   [x] Spellcheck Synchronization
    -   [ ] Fixed Feed Stabilization (STILL BUGGY)
-   **UI**:
    -   [x] Plugin Settings Tab
    -   [x] Contextual Toolbar (Header)
-   **To Build**:
    -   [ ] Footnotes Sidebar (Z-Axis)
    -   [ ] Comments Sidebar (Z-Axis)
    -   [ ] Block Definitions Editor