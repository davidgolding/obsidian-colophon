<h1 align="center">Colophon</h1>
<p align="center">Long-form writing canvas in Obsidian—by writers, for writers</p>

Write essays, chapters, articles, newsletters, blog posts, all within Obsidian. Customize paragraph, character, and list styles once, enjoy distraction-free writing after. Drop in and rearrange footnotes. Link to other notes in your notebase. Get word counts. Export to Word (.docx).

---

For changes in each release, see the releases page: <https://github.com/davidgolding/obsidian-colophon/releases>

---

## Installation

1. Visit the releases page: <https://github.com/davidgolding/obsidian-colophon/releases>.
2. Download the latest release, either the `main.js`, `manifest.json`, and `styles.css` files together, or the `Source code` bundle. Make sure the files (after unpacking them) are housed within a folder titled `obsidian-colophon`.
3. Place the `obsidian-colophon` folder inside your vault’s config folder’s plugins subfolder, e.g., `[vault]/.obsidian/plugins`.
4. Enable the plugin in your Obsidian “Community plugins” settings.

## Getting Started

### Create a Colophon Manuscript

You can create a new Colophon manuscript one of four ways:

1. **Right-click in the vault navigator and select “New manuscript”**: The contextual menu contains the “New manuscript” option, which will create a new manuscript file within the vault folder you’ve selected.
2. **Run the command**: Use `Colophon: New manuscript` in your commands panel.
3. **Click the ribbon icon**: The feather icon in the side ribbon will create a new manuscript.
4. **Add the manuscript property to an empty note file**: In an empty Markdown note file, select “Add file property” from its editor menu. Type `colophon-plugin` as the key and `manuscript` as its value. Click out of the note and back into it, and the plugin will recognize it as a Colophon manuscript.

### Apply Paragraph Styles to Your Manuscript

In a new manuscript, the text defaults to the “Body” paragraph style. You can apply a different paragraph style simply by selecting any text within the paragraph and selecting a the style from the “Paragraph” styles menu in the Colophon toolbar.

Just type in the canvas as you would a typical Medium or Substack editor and notice how it behaves more like a minimized, clutter-free word processor than a code or Markdown editor.

### Apply Character Styles

Use the native “Format” > “Bold” and “Format” > “Italics” menu items and hotkeys to turn selected text into bold and italics, respectively. You can also click the toolbar icons for bold, italics, underline, strikethrough, superscript, subscript, and small caps to apply those character styles to selected text.

## Link to Internal Notes

Use the double-bracket trigger to bring up Obsidian’s internal link autosuggest modal. The Wikilink syntax works for files, headings within notes, and aliases.

## Insert Footnotes

Use the native “Insert” > “Footnote” menu item and hotkey to insert a footnote at text cursor point. The footnotes sidebar will open where you can enter the content of the footnote. Use the same character styles like bold and italics within the footnote editor and add internal links to notes using the Wikilink syntax.

## Delete Footnotes

Using backspace to delete the footnote marker in the main body text will delete its corresponding footnote from the sidebar. The sequence automatically synchronizes.

## Features

The plugin’s settings include the following customizations:

- **Text column width**: Adjust the width of the main body column to your preference.
- **Fixed feed position**: When enabled, the **Feed padding** value sets the type feed to its relative vertical position. A padding of 50% represents the middle of the screen, typical of “typewriter mode” in other editors.
- **Smart quotes**: When enabled, your selected style of **Double quotes** and **Single quotes** will be applied to the text.
- **Smart dashes**: When enabled, double hyphens and triple hyphens get replaced with em and en dashes.
- **Styles folder**: Defaults to the vault’s `snippets` folder. Set to your preferred path to a vault subfolder where the plugin will scan for any customization stylesheets.
- **Enabled styles**: Any YAML files included in the `Styles folder` will be displayed here, where they can be toggled and merged with the default styles. You can redefine any properties of existing paragraph, character, and list styles, and add custom styles of your own (see “Custom Styles” below).

### Light Canvas Toggle

The light/dark icon in the toolbar toggles between a light canvas against dark mode. This allows for just the writing space to have a light background with dark text while the rest of the interface is in dark mode to resemble the dark-on-white typography of print media.

### Export to Word (.docx)

Enter the `Colophon: Export to Word (.docx)` command or select “Export to Word (.docx)” from the editor menu to display the export modal. Select the page dimensions, enter margins, and adjust the scale (%) to export the manuscript to a .docx file. The visual appearance of the text in the word processor should very closely resemble its appearance in the writing canvas.

### Spell Checking

Your setting in “Editor” > “Spellcheck” maps onto Colophon’s main editor and footnote editor as well. Toggle that setting to enable or disable spell checking in Colophon.

### Custom Styles

Place a plain-text file with the .yaml file name extension in the “Styles folder” (as defined in settings) and Colophon will recognize it as a possible stylesheet. When you enable individual YAML snippets, their properties will merge with the defaults and be accessible in the plugin.

The structure is simple: each key must be lowercase alphanumeric and its styles indented below as individual properties. If you wish to override any individual property of an existing style, just include that property under the same key as the style.

**Default Styles**: The default styles (in YAML) are the following:

```yaml
supertitle:
    after-paragraph: 18pt
    before-paragraph: 0pt
    font-family: "var(--font-text-theme), var(--font-text-override)"
    font-size: 11.5pt
    font-variant: regular
    line-spacing: 14pt
    name: Supertitle
    text-align: center
    type: paragraph
title:
    after-paragraph: 4pt
    before-paragraph: 0pt
    font-family: "var(--font-text-theme), var(--font-text-override)"
    font-size: 18pt
    font-variant: Regular
    line-spacing: 18pt
    name: Title
    text-align: center
    type: paragraph
subtitle:
    after-paragraph: 28pt
    font-family: "var(--font-text-theme), var(--font-text-override)"
    font-size: 14pt
    font-variant: Regular
    line-spacing: 18pt
    name: Subtitle
    text-align: center
    type: paragraph
epigraph:
    after-paragraph: 56pt
    before-paragraph: 48pt
    font-family: "var(--font-text-theme), var(--font-text-override)"
    font-size: 11.5pt
    font-variant: Regular
    left-indent: 1in
    line-spacing: 16pt
    name: Epigraph
    right-indent: 1in
    type: paragraph
body-first:
    after-paragraph: 0pt
    before-paragraph: 0pt
    first-indent: 0in
    following-style: body
    font-family: "var(--font-text-theme), var(--font-text-override)"
    font-size: 11.5pt
    font-variant: Regular
    left-indent: 0in
    line-spacing: 16pt
    name: Body First
    text-align: left
    type: paragraph
body:
    after-paragraph: 0pt
    before-paragraph: 0pt
    first-indent: 0.3in
    font-family: "var(--font-text-theme), var(--font-text-override"
    font-size: 11.5pt
    font-variant: Regular
    left-indent: 0pt
    line-spacing: 16pt
    name: Body
    text-align: left
    type: paragraph
footnote:
    after-paragraph: 0pt
    before-paragraph: 0pt
    first-indent: 0pt
    font-family: "var(--font-text-theme), var(--font-text-override)"
    font-size: 7pt
    font-variant: Regular
    format: integer
    left-indent: 0in
    line-spacing: 9pt
    name: Footnote
    right-indent: 0pt
    space-between-notes: 10pt
    type: paragraph
footnote-number:
    font-family: "var(--font-text-theme), var(--font-text-override)"
    font-size: 7pt
    font-weight: bold
    line-spacing: 9pt
    name: Footnote Number
    type: paragraph
footnote-symbol:
    align: 4pt
    color: "var(--text-normal)"
    font-family: "var(--font-text-theme), var(--font-text-override)"
    font-size: 7pt
    format: integer
    line-height: 0
    name: Footnote Symbol
    type: footnote
heading-1:
    after-paragraph: 14pt
    before-paragraph: 28pt
    first-indent: 0in
    following-style: body-first
    font-family: "var(--font-text-theme), var(--font-text-override)"
    font-size: 11.5pt
    font-variant: Italic
    keep-with-next: true
    left-indent: 0in
    line-spacing: 28pt
    name: "Heading 1"
    right-indent: 0in
    text-align: left
    type: paragraph
heading-2:
    after-paragraph: 14pt
    before-paragraph: 28pt
    capitalization: small-caps
    character-spacing: 2%
    first-indent: 0in
    following-style: body-first
    font-family: "var(--font-text-theme), var(--font-text-override)"
    font-size: 11.5pt
    font-variant: Regular
    keep-with-next: true
    left-indent: 0in
    line-spacing: 28pt
    name: Heading 2
    right-indent: 0in
    text-align: left
    type: paragraph
heading-3:
    after-paragraph: 14pt
    before-paragraph: 28pt
    first-indent: 0in
    following-style: body-first
    font-family: "var(--font-text-theme), var(--font-text-override)"
    font-size: 11.5pt
    font-variant: Regular
    keep-with-next: true
    left-indent: 0in
    line-spacing: 28pt
    name: Heading 3
    right-indent: 0in
    text-align: center
    type: paragraph
bullet:
    defaults:
        align: 0pt
        color: inherit
        list-type: unordered
        marker: •
        marker-indent: 0in
        size: 100%
        text-indent: 0.25in
    name: Bullet
    type: list
numbered:
    defaults:
        align: 0pt
        color: inherit
        list-type: ordered
        marker: decimal
        marker-indent: 0in
        size: 100%
        suffix: .
        text-indent: 0.25in
    name: Numbered
    type: list
```

**Example of adding a style**: Simply write your own key with properties in your YAML file to add this style to the list.

```yaml
heading-4:
    after-paragraph: 14pt
    before-paragraph: 28pt
    first-indent: 0.3in
    following-style: body-first
    font-family: "var(--font-text-theme), var(--font-text-override)"
    font-size: 11.5pt
    font-weight: bold
    keep-with-next: true
    left-indent: 0in
    line-spacing: 28pt
    name: Heading 4
    right-indent: 0in
    text-align: left
    type: paragraph
```

**Changing the visual scale**: If the text appears either too small or too large, it’s better to adjust the visual scale of the interface using the `scale` property than to change all the font sizes, line spacings, and indents, since these measurements are mapped directly to the .docx export. The default setting is `100%`, but to adjust this, simply add it to your custom YAML snippet, like so:

```yaml
scale: 120%
```

**Property names and units**: Notice that the property names are not CSS style names but rather the format settings that are typical in a word processor. This is by design: it allows you to recreate your document templates in the stylesheet more directly. The following units may be appended to number values for properties that use measurements:

- `pt`: Points
- `pc`: Picas
- `in`: Inches
- `cm`: Centimeters
- `mm`: Millimeters
- `px`: Pixels

The properties themselves correspond to usual word processor labels:

- `after-paragraph`: Added line space below paragraph
- `align`: Baseline shift; positive values upward, negative values downward
- `before-paragraph`: Added line space above paragraph
- `capitalization`: `small-caps | all-caps`
- `character-spacing`: Space in between characters
- `color`: Color of text
- `defaults`: Used only with `list` style types; properties for all indent levels unless an indent level is specified
- `first-indent`: Distance of the first line from the left edge of the paragraph
- `font-family`: Font name (excluding variants); default uses whatever has been set by the current Obsidian theme and user setting
- `font-size`: Size of the font
- `font-variant`: Specific variant name of the font
- `format`: Used only with the `footnote` style; `integer | lower-roman | upper-roman | lower-alpha | upper-alpha | [array of character symbols]`
- `left-indent`: Distance of the left edge of the paragraph from margin
- `line-spacing`: Leading or line height
- `list-type`: `ordered | unordered`
- `marker`: Used only with `list` style types; `decimal | disc | circle | square | none | [character]`
- `marker-indent`: Distance of the list marker from the left edge of the paragraph
- `name`: Display name of the style
- `right-indent`: Distance of the right edge of the paragraph from margin
- `size`: Used only with `list` style types; relative size of the marker (default: `100%`)
- `space-between-notes`: Used only with `footnote` style; the gap space in between footnotes in .docx export
- `suffix`: Used only with `list` style types; the character(s) to follow the marker.
- `text-align`: `left | center | right`
- `text-indent`: Distance of the list text from the left edge of the paragraph
- `type`: `paragraph | character | list`

## Contributing

We welcome contributions from developers interested in improving the long-form writing experience in Obsidian.

### Philosophy

Colophon aims to keep the codebase lightweight, understandable, and fast:

- **Vanilla JavaScript**: It uses modern ES6+ JavaScript.
- **No TypeScript**: The project is pure JS to reduce tooling complexity and build times.
- **No Frameworks**: We avoid UI frameworks like React or Vue. The UI is built with native DOM APIs and Obsidian’s API.
- **Tiptap/ProseMirror**: The core editor is powered by Tiptap (a headless wrapper for ProseMirror). ProseMirror complements the CodeMirror environment already powering Obsidian’s Markdown editor.

### Development Setup

1. Clone the repository into your vault’s `.obsidian/plugins/` directory.
2. Install dependencies:
```
pnpm install
```

or

```
npm install
```

3. Build commands

```
pnpm build
```

Creates a minified bundle at `main.js` Obsidian will load. Be sure to use “Force Refresh” to reload after making any changes.

### Project Structure

Colophon stores the ProseMirror document in a “sidecar” block at the bottom of the Markdown file. This ensures the file interacts with ProseMirror correctly, but appears in the vault as another regular Markdown file.