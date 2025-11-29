# Obsidian Colophon

**Colophon** is an Obsidian plugin designed to provide a distraction-free writing experience for long-form manuscripts. It bridges the gap between Markdown's simplicity and the rich-text features needed for professional writing, all while keeping your data locally stored in your vault.

## Features

- **Manuscript View**: A dedicated, distraction-free writing interface that replaces the standard Markdown view for manuscript files.
- **Rich-Text Footnotes**: Manage footnotes in a dedicated sidebar. Footnotes support rich text and are stored cleanly in the file's metadata.
- **Smart Substitutions**: Automatically converts straight quotes to smart quotes (`" "` → `“ ”`) and dashes (`--` → `—`) as you type.
- **DOCX Export**: Export your manuscript to a properly formatted Word document. The export uses a "WYSIWYG" engine to ensure the output matches your editor exactly, including fonts, spacing, nested lists, and complex styles.
- **Wikilink Support**: Full support for standard Obsidian `[[Wikilinks]]` to keep your manuscript connected to your research.
- **Theme Support**: Seamlessly adapts to Light and Dark modes, with an optional independent theme toggle for the writing canvas.
- **Advanced Lists**: Create bulleted and numbered lists with professional styling options (custom markers, indentation, alignment).
- **Customizable Footnotes**: Choose your preferred footnote symbol format (1, i, A, etc.) and fine-tune their appearance.

## Usage

### Creating a Manuscript
- Click the **Feather Icon** in the ribbon to create a new manuscript.
- Or use the command palette: `Colophon: New manuscript`.
- Manuscript files are standard Markdown files with a special frontmatter tag: `colophon-plugin: manuscript`.

### Writing
- Write as you normally would. The interface is designed to be clean and focused.
- **Formatting**: Use standard shortcuts (Cmd/Ctrl+B for bold, Cmd/Ctrl+I for italics) or the selection popover menu.

### Working with Footnotes
- **Insert Footnote**: Use the command `Colophon: Insert Footnote` or select "Insert Footnote" from the selection popover.
- **Edit Footnotes**: Footnotes appear in the right sidebar. Click a footnote reference in the text to focus the corresponding note in the sidebar.

### Exporting
- Click the **More Options** (three dots) menu in the top-right of the view.
- Select **Export to DOCX**.
- Choose a location to save your `.docx` file.

---

## How to Contribute

We welcome contributions from developers who are interested in improving the long-form writing experience in Obsidian.

### Philosophy
Colophon is built with a specific technical philosophy to keep the codebase lightweight, understandable, and fast:
- **Vanilla JavaScript**: We use modern ES6+ JavaScript (CommonJS modules).
- **No TypeScript**: The project is pure JS to reduce tooling complexity and build times.
- **No Frameworks**: We avoid UI frameworks like React or Vue. The UI is built with native DOM APIs and Obsidian's API.
- **Tiptap/ProseMirror**: The core editor is powered by Tiptap (a headless wrapper for ProseMirror).

### Development Setup

1.  **Clone the repository** into your vault's `.obsidian/plugins/` directory.
2.  **Install dependencies**:
    ```bash
    pnpm install
    ```
    *(Note: We prefer `pnpm` for package management)*

### Build Commands

- **Development Watch Mode**:
    ```bash
    pnpm run dev
    ```
    This will watch for changes and rebuild `main.js` automatically. Reload the plugin in Obsidian to see changes.

- **Production Build**:
    ```bash
    pnpm run build
    ```
    Creates a minified bundle ready for distribution.

### Project Structure

- `src/main.js`: The main plugin entry point. Handles event registration, commands, and DOCX export.
- `src/view.js`: Defines the `ColophonView`, the custom workspace leaf for manuscripts.
- `src/tiptap-adapter.js`: Manages the Tiptap editor instance, extensions, and data synchronization.
- `src/extensions/`: Custom Tiptap extensions (Footnotes, Links, etc.).
- `styles.css`: All styling for the plugin.

### Data Storage
Colophon stores the ProseMirror document in "sidecar" block at the bottom of the file. This ensures the file interacts with ProseMirror correctly, but appears in the vault as a regular Markdown file.
