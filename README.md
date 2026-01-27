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
- **Native Integration**: Works seamlessly with Obsidian's workspace, tabs, and file management.
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
*Created by writers, for writers.*
