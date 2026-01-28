<h1 align="center">Colophon 2.0</h1>
<p align="center">Long-form writing canvas for Obsidian</p>

Colophon provides a dedicated, typographically refined environment for writing manuscripts and screenplays. Unlike standard Markdown editors, Colophon uses a custom editor engine (Tiptap/ProseMirror) and a dedicated file format to ensure your formatting, footnotes, and script standards are preserved exactly as you intended.

---

## Installation (Beta)

1. Download the latest release (`main.js`, `manifest.json`, `styles.css`).
2. Place them in `[vault]/.obsidian/plugins/obsidian-colophon`.
3. Enable the plugin in Obsidian settings.

## Getting Started

### Create a Colophon File

You can create a new Colophon document in several ways:

1. **Right-click in the File Explorer**: Select **New manuscript** or **New script** from any folder's context menu.
2. **Ribbon Icon**: Click the feather icon in the left ribbon to create a new manuscript.
3. **Command Palette**: Use the commands `Colophon: New Manuscript` or `Colophon: New Script`.

### Manuscript vs. Script Mode

- **Manuscript**: Optimized for essays, chapters, and long-form prose. Features serif typography and centered layouts.
- **Script Mode**: A dedicated screenwriting environment with industry-standard formatting (Scene Headings, Action, Character, Dialogue) and keyboard shortcuts for rapid drafting.

## Key Features (v2.0)

- **Dedicated File Format**: Files saved as `.colophon` (JSON) to preserve complex structures like footnotes and comments without cluttering your Markdown notes.
- **Native Integration**: Works seamlessly with Obsidian's workspace, tabs, hotkeys (`Cmd+B`/`I`), and file management.
- **Word Processing Feel**: A distraction-free "white canvas" experience that feels more like a modern word processor than a code editor.

## Features (In Progress)

- **High-Fidelity Export**: Export to `.docx` with layout parity.
- **Footnotes & Comments**: Dedicated sidebars for managing annotations.
- **Smart Substitutions**: Automatic smart quotes and dashes.
- **Custom Stylesheets**: Define your own typography via YAML snippets.

## Development

Colophon is built with Vanilla JavaScript and Tiptap.

1. `pnpm install`
2. `pnpm build` (Uses `esbuild` to bundle the plugin)

---

# For Die-Hard Users: Our UX Theory

For most writers (and not technicians), their digital text environment will follow one of two UX design paradigms: word processing or Markdown. I’m interested in a third paradigm, a way to leverage the benefits of both for an improved writing experience.

## Strengths and Weaknesses

- **Word Processing**
	- Strengths
		- Styling text
		- Presentation
		- Rich text formatting
			- Paragraph formatting
			- Character formatting
			- List formatting
			- Document/page formatting
			- Section formatting
			- Footnote/endnote formatting
			- Mail merge/template formatting
			- Table of contents formatting
			- Index/bibliography formatting
	- Weaknesses
		- Hand-eye friction and interruption (moving the mouse)
		- Accommodating style customizations multiplies interface elements
		- Easy error/inconsistency rate across page elements
		- Cognitive load for applying styles, finding styles in UI
		- Interface tooled for processing, not writing
		- Visual clutter during writing
		- Everything treated as a canvas
- **Markdown**
	- Strengths
		- Focus on writing text
		- Plaintext compatibility
		- Widely adopted standard
		- Low data footprint
		- Markup text with minimal syntax
		- Abstracted style formatting for export
		- Easily ingestible by code and AI agents
	- Weaknesses
		- Syntax noise
		- Additional inline characters for markup
		- Forced line-level content scope
		- Workarounds for complex scenarios
		- Favors programmer, not writer, aesthetic
		- Everything treated as a flat string of text

## Leveraging Strengths

A third way would leverage the strengths and avoid the weaknesses of both paradigms. The writer’s and editor’s ideal UX design would:

- Writing is front and center: focus modes in Markdown settings is the main goal and experience of the interface.
- Presentation layer aesthetical for bibliophiles: typography is highly readable, textually elegant for reading and presenting words.
- Styles are defined once across the interface: minimize or eliminate inconsistency of applied styles in a document.
- Text is marked up by the interface, not with syntax: no additional characters to define text format, but highly accessible triggers or keystrokes enable mouse-less transitions while typing into any markup for the text at hand.
- Separation of concerns: leaves the complete document formatting, pagination, final typesetting to software enhanced for print or display production. Similar to vector/raster/layout separations in software suites, this paradigm would exclusively concentrate on the writing and editing domain and expect other domains to be handled by programs enhanced for those cases.

## Word Composition Paradigm

Let’s think in terms of ontology and hierarchy. We’re moving away from abstractions of typography and documents and into the space of composition, particularly of prose. We have four axes that all co-exist within the composition space:

- X-Axis: Inline flow (rhetorical inflection)
- Y-Axis: Block stacking (structural intent)
- Z-Axis: Transversal links (annotations, comments, citations)
- T-Axis: Temporal states (version history, assets)

**Block-Level Ontology**: At this level, entities define the purpose of discrete unit of content. They are containers of thought. We have typical structures of text: titles, body paragraphs, subtitles. We also have functional structures like:

- **Attestation**: A block that identifies a source or provides a voice (e.g., blockquote, epigraph).
- **Aside**: Information that is structurally relevant but rhetorically tangential (e.g., sidebars, callouts).
- **Instruction**: Metadata that guide the reader (e.g., recipe step, flow chart diagram).

The aesthetic constraints of block-level entities all involve *geometry*: line height, margin, alignment. These are all inherited by children but cannot be altered by them.

**Inline-Level Ontology**: Inline entities do not exist independently. They are modifiers of the flow within the block and represent *rhetorical inflection*. The prosodic markers involve the nature of the inflection:

- **Focus**: Directing attention (e.g., bold, highlight, underscore).
- **Voice**: Marking a shift in language or register (e.g., italics for foreign loanwords or proper nouns).
- **Technical Specifier**: Marking text as a symbol, variable, or code.
- **Structure**: Anchoring a target within the flow (e.g., reference point for a link or citation, placeholder).

**Transversal Ontology**: Transversal entities are neither blocks nor simple inline flows, but exist orthogonally to the text. The **Annotative Dimension** provides portal blocks: block-level entites triggered by an inline-level anchor. It also supports metatextual entities that exist “above” the text, or a “gloss,” such as editorial comments, dialogues, forums. The **Temporal Dimension** encompasses entities that indicate change across time, different states in the past, and assets (such as fonts, character encodings, colors, rasters/vectors) that exist in a resource state that “enflesh” text.

### Key Ontological Properties

The key ontological property of each of these:

- Block-level: Intent—defines the container with geometry
- Inline-level: Inflection—modifies flow
- Transversal-level: Relation—links entities of block, inline, gloss, or state

## UX for Word Composition

| Feature      | Word Processing       | Markdown              | Word Composition                        |
+| ------------ | --------------------- | --------------------- | --------------------------------------- |
| Input Method | UI buttons, shortcuts | Textual syntax        | Transient syntax, UI buttons, shortcuts |
| Visual State | WYSIWYG               | What you see is code  | What you see is word-craft              |
| Consistency  | Low (manual styling)  | High (defined by CSS) | Absolute (locked semantic blocks)       |
| Aesthetic    | Productivity          | Technical, minimalist | Bibliophile, editorial                  |

## Necessities

- A single, unified writing canvas
- A single input cursor
- Ephemeral markings: user-customized and conventional triggers (e.g., Markdown `#` symbol) that the UI recognizes as intent, transforms into the desired entity, and does not include the trigger in the composition
- Minimal global state definitions for whole UX (not work-specific)
- Contextual UI elements: minimal reserved element that reacts to cursor location, exposes contextual layer(s) at that location
- Keyboard-favored input modals: for transversal entities, triggers expose interface modals specific to the related entity
	- Adding a footnote: keyboard input triggers the inline anchor being added at the cursor location and a sidebar modal providing a block-level entity of the corresponding annotation
	- Adding a hyperlink: keyboard input triggers a Z-axis modal providing metadata properties of the URL
	- Adding an internal link: keyboard input triggers a modal providing autosuggested notes within a file system that when selected, places appropriate inline anchors to those notes
	- Mirroring a resource: keyboard input triggers an autosuggest modal of block-level entities and whole documents within a file system that when selected, reproduces that text as a mirror within the working file; if the outside entity changes, the reference mirror changes; if the mirror is edited, it’s the outside entity that is edited.

---
*Created by writers, for writers.*
