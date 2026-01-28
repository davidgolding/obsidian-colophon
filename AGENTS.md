# AGENTS.md - Colophon Project Handover (v2.0)

## 1. Project Brief
**Colophon** is an Obsidian plugin that implements a **Word Composition** environment, a third paradigm distinct from Word Processing and Markdown. It provides a dedicated writing canvas offering the typographic elegance and semantic structure of a word processor with the focus and clean input method of Markdown. It uses a custom `.colophon` JSON format to ensure absolute consistency in semantic blocks (`Y-Axis`) and rhetorical inflection (`X-Axis`) while removing the visual noise of syntax.

## 2. Product Context
The project solves the dichotomy between **Word Processing** (rich presentation but high friction/clutter) and **Markdown** (text focus but syntax noise/programmer aesthetic).

**Core Philosophy: Word Composition**
- **Paradigm**: "What you see is word-craft."
- **Aesthetic**: Bibliophile, editorial, distraction-free.
- **Ontology**:
    - **Y-Axis (Block)**: Structural intent (Paragraph, Header, Attestation). Locked geometry.
    - **X-Axis (Inline)**: Rhetorical inflection (Focus/Bold, Voice/Italic). Modifies flow.
    - **Z-Axis (Transversal)**: Relations (Footnotes, Comments). Exits the flow.
    - **T-Axis (Temporal)**: State (Version history).
- **UX Goal**: Text is marked up by interface triggers (e.g., standard shortcuts or transient syntax), but the result is a rendered semantic entity, not visible code.

## 3. Active Context
**Current Focus**: Establishing the core "Word Composition" canvas.
- **Recent Changes**: Refactored native formatting (Bold/Italic/Strike) to use global command interception rather than local key scopes, ensuring `Cmd+B` works via Obsidian's unified hotkey manager.
- **Active Decisions**:
    - **Native Command Interception**: We rigorously patch `editor:toggle-bold` et al. to route to Colophon when active, maintaining "hotkey agnosticism."
    - **No "Sticky" Menu**: We abandoned trying to sync the native OS "Format" menu state due to API limitations. We will rely on contextual feedback (future: Context Menu or specialized UI).
- **Next Steps**:
    1. **Implement Block Ontology (Y-Axis)**: Headers, Blockquotes (Attestation).
    2. **Implement Transversal Entities (Z-Axis)**: Footnotes/Comments UI.

## 4. System Patterns
- **Architecture**:
    - **Plugin Entry (`main.js`)**: Handles command patching, file creation, and global event interception.
    - **Obsidian View (`view.js`)**: Manages the `TextFileView` lifecycle. Acts as the bridge between Obsidian's workspace and the Editor.
    - **Editor Adapter (`tiptap-adapter.js`)**: Encapsulates **Tiptap v3** (ProseMirror) logic. All direct editor manipulation happens here.
- **Component Relationships**: `ColophonPlugin` -> `ColophonView` -> `TiptapAdapter` -> `Tiptap Editor`.
- **Styling**: All styles scoped to `.colophon-workspace`. Typography uses mode classes (`.type-manuscript`, `.type-script`).

## 5. Tech Context
- **Framework**: Obsidian Plugin API (Vanilla JS).
- **Editor Engine**: **Tiptap v3** (Headless ProseMirror wrapper).
- **Build System**: `esbuild` to bundle into `main.js`.
- **Constraint**: Must coexist with standard Markdown files; cannot pollute global CSS.
- **Convention**: Use `.colophon` extension (JSON data) to preserve strict semantic structure.

## 6. Progress
- **Infrastructure**: Project builds, loads, and hot-reloads.
- **File System**: Custom creation workflow (`.colophon` files) with auto-rename works.
- **Editor Core**: Tiptap adapter running within `TextFileView`.
- **Formatting**:
    - [x] Bold (Focus) - Global Command Integrated
    - [x] Italic (Voice) - Global Command Integrated
    - [x] Strikethrough - Global Command Integrated
- **To Build**: Headers, Lists, Blockquotes, Footnotes, Comments, Script Mode specialized blocks.