# Desired Interface

- We already have a Tiptap/ProseMirror instance running within an Obsidian plugin. It’s pretty bare bones at the moment. All of our UI descriptions will be built onto this initial scaffolding.
- The main text editing column we’ll call the “canvas.” This will never be confused with other parts of the Obsidian interface or with the plugin’s modals, sidebars, toolbars, or footnotes.
- Footnotes appear as superscript markers wherever the user creates them in the canvas.
- Footnote text appears as individual mini-canvases of Tiptap editable areas in a dedicated contextual sidebar within Obsidian’s “Right Sidebar” area.
- Footnote text blocks are properly tracked and synchronized with their corresponding markers. Whenever Tiptap re-numbers or sequences the footnote values in the canvas, the order of corresponding footnote text blocks are corrected and the elements are dynamically moved to always be in sync with the footnote markers.
- Immediately above the canvas is a contextual toolbar. It contains a select menu of block-level options on the left side. Next comes a horizontal row of indicator buttons that are represented each with an icon from Lucide. These buttons apply and reflect the inline-level “markers” of the cursor location or selected text in either the canvas or the footnote block, whichever is in focus.
- On the right side of the toolbar is an icon for a comments sidebar. When clicked, it exposes a sidebar within the main workleaf, not a sidebar element within one of Obsidian’s sidebars. This comments sidebar contains individual comment blocks that are associated with selected text in the canvas. These comment blocks contain user-specific comments as well as replies. The comments sidebar is scrollable verically in case the run of comments exceeds the vertical height of the canvas.
- The plugin settings provides an interface for editing global and block-level attributes of text in the canvas and footnotes.
	- The block-level settings section is comprised of rows.
	- Each row represents a block-level entity that has a name, a hotkey trigger, and a syntax trigger. The select menu of block-level options in the canvas toolbar is populated with these block-level entities, showing just their names as defined here in this settings row.
	- The hotkey trigger uses the same settings interface as the “Hotkeys” settings in Obsidian. This is to provide the user with the option of assigning a hotkey combination that when pressed in a Colophon canvas editing scenario will apply the corresponding block-level entity to the text.
	- The syntax trigger is a text field that allows the user to define a string of text that when typed in the canvas will trigger a block-level application of the corresponding block-level entity. This syntax trigger text will be replaced immediately with an empty string in the canvas, the cursor will continue as it should, but the effect will be as if the user clicked on the block-level select menu as selected that particular entity from the list.
	- Within the block-level settings row is a subgroup of properties rows. These properties define the appearance and behavior of the given block-level entity. The top-most row provides an “add” button that creates a new property row within the subgroup.
	- Each property row starts with a select menu that filters out any existing properties for the given block-level entity (to prevent duplication). This select menu has a list of property ids (that also function as their names). Based on the property, the rest of the row is populated with the correct fields to define that property.
	- The list of properties includes:
		- `after-block`: Line spacing added below the entity.
		- `before-block`: Line spacing added above the entity.
		- `capitalization`: `none | small-caps | all-caps`
		- `color`: Color of text.
		- `first-indent`: Distance of the first line from the left edge of the entity.
		- `following-entity`: The ID of the block-level entity that should be applied to the next block (usually when the user hits return to start another paragraph after this one).
		- `font-family`: Font name (excluding variants); default uses whatever has been set by the current Obsidian theme and user setting.
		- `font-size`: Size of the font.
		- `font-variant`: Specific variant name of the font.
		- `inline-spacing`: Space in between characters.
		- `left-indent`: Distance of the left edge of the entity from margin.
		- `line-spacing`: Leading/line height.
		- `list-type`: `ordered | unordered`
		- `marker`: `decimal | disc | circle | square | none | [character]`
		- `marker-baseline`: The baseline shift of the list marker; zero is the x-height of the line; positive values move upward, negative downward.
		- `marker-indent`: Distance of the list marker from the left edge of the entity; negative values place the marker outside the entity.
		- `marker-outdent`: Distance of left edge of the line’s text from the right edge of the marker.
		- `marker-size`: Relative size of the list marker (default 100%).
		- `marker-suffix`: The character(s) to follow the list marker.
		- `right-indent`: Distance of the right edge of the entity from margin.
		- `space-between-notes`: Gap space between footnotes in .docx export.
		- `text-align`: `left | center | right`
	- The `units` select menu contains:
		- `pt`: Points
		- `pc`: Picas
		- `in`: Inches
		- `cm`: Centimeters
		- `mm`: Millimeters
		- `px`: Pixels
		- `em`: Ems
		- `rem`: Rems
	- Whenever a `measurement` type property is presented in these settings, it has a numeric field for the value followed by the `units` select menu. The setting is saved as `Xpt` where `X` is the user-provided value and `pt` is the unit of points in the select menu, for example.
	- Four other select menus are possible as property options:
		- `cap_menu`:
			- label: `None` / value: `none`
			- label: `Small Caps` / value: `small-caps`
			- label: `All Caps` / value: `all-caps`
		- `list_type_menu`:
			- label: `None` / value: `none`
			- label: `Ordered` / value: `ordered`
			- label: `Unordered` / value: `unordered`
		- `marker_menu`:
			- label: `•` / value: `disc`
			- label: `°` / value: `circle`
			- label: `■` / value: `square`
			- label: `1, 2, 3, etc.` / value: `decimal`
			- label: `i, ii, iii, iv, etc.` / value: `lower-roman`
			- label: `I, II, III, IV, etc.` / value: `upper-roman`
			- label: `a, b, c, etc.` / value: `lower-latin`
			- label: `A, B, C, etc.` / value: `upper-latin`
			- label: `None` / value: `none`
		- `align_menu`:
			- label: `Left` / value: `left`
			- label: `Center` / value: `center`
			- label: `Right` / value: `right`
	- The property options that appear when a given property is selected is based on the following:
		- `after-block`: `measurement`
		- `before-block`: `measurement`
		- `capitalization`: `cap_menu`
		- `color`: a color picker
		- `first-indent`: `measurement`
		- `following-entity`: text field
		- `font-family`: text field
		- `font-size`: `measurement`
		- `font-variant`: text field
		- `inline-spacing`: `measurement`
		- `left-indent`: `measurement`
		- `line-spacing`: `measurement`
		- `list-type`: `list_type_menu`
		- `marker`: `marker_menu`
		- `marker-baseline`: `measurement`
		- `marker-indent`: `measurement`
		- `marker-outdent`: `measurement`
		- `marker-size`: percent field
		- `marker-suffix`: text field
		- `right-indent`: `measurement`
		- `space-between-notes`: `measurement`
		- `text-align`: `align_menu`
	- The settings are saved as is typical for an Obsidian plugin. The plugin, as well as the Tiptap adapter and all else that needs these user-defined settings, must derive their values from the saved settings.
	- See the “default settings” definition below for what should be saved in `data.json` as the default settings.

## Default Settings

The default settings for block-level entities (expressed here in YAML) are:

```yaml
supertitle:
    after-block: 18pt
    before-block: 0pt
    font-family: "var(--font-text-theme), var(--font-text-override)"
    font-size: 11.5pt
    font-variant: regular
    line-spacing: 14pt
    name: Supertitle
    text-align: center
title:
    after-block: 4pt
    before-block: 0pt
    font-family: "var(--font-text-theme), var(--font-text-override)"
    font-size: 18pt
    font-variant: regular
    line-spacing: 18pt
    name: Title
    text-align: center
subtitle:
    after-block: 28pt
    font-family: "var(--font-text-theme), var(--font-text-override)"
    font-size: 14pt
    font-variant: regular
    line-spacing: 18pt
    name: Subtitle
    text-align: center
epigraph:
    after-block: 56pt
    before-block: 48pt
    font-family: "var(--font-text-theme), var(--font-text-override)"
    font-size: 11.5pt
    font-variant: regular
    left-indent: 1in
    line-spacing: 16pt
    name: Epigraph
    right-indent: 1in
body-first:
    after-block: 0pt
    before-block: 0pt
    first-indent: 0in
    following-entity: body
    font-family: "var(--font-text-theme), var(--font-text-override)"
    font-size: 11.5pt
    font-variant: regular
    left-indent: 0in
    line-spacing: 16pt
    name: Body First
    text-align: left
body:
    after-block: 0pt
    before-block: 0pt
    first-indent: 0.3in
    font-family: "var(--font-text-theme), var(--font-text-override"
    font-size: 11.5pt
    font-variant: regular
    left-indent: 0pt
    line-spacing: 16pt
    name: Body
    text-align: left
footnote:
    after-block: 0pt
    before-block: 0pt
    first-indent: 0pt
    font-family: "var(--font-text-theme), var(--font-text-override)"
    font-size: 7pt
    font-variant: regular
    left-indent: 0in
    line-spacing: 9pt
    name: Footnote
    right-indent: 0pt
    space-between-notes: 10pt
footnote-number:
    font-family: "var(--font-text-theme), var(--font-text-override)"
    font-size: 7pt
    font-weight: bold
    line-spacing: 9pt
    name: Footnote Number
footnote-symbol:
    align: 4pt
    color: "var(--text-normal)"
    font-family: "var(--font-text-theme), var(--font-text-override)"
    font-size: 7pt
    line-height: 0pt
    name: Footnote Symbol
heading-1:
    after-block: 14pt
    before-block: 28pt
    first-indent: 0in
    following-entity: body-first
    font-family: "var(--font-text-theme), var(--font-text-override)"
    font-size: 11.5pt
    font-variant: italic
    left-indent: 0in
    line-spacing: 28pt
    name: "Heading 1"
    right-indent: 0in
    text-align: left
heading-2:
    after-block: 14pt
    before-block: 28pt
    capitalization: small-caps
    character-spacing: 4pt
    first-indent: 0in
    following-entity: body-first
    font-family: "var(--font-text-theme), var(--font-text-override)"
    font-size: 11.5pt
    font-variant: regular
    left-indent: 0in
    line-spacing: 28pt
    name: "Heading 2"
    right-indent: 0in
    text-align: left
heading-3:
    after-block: 14pt
    before-block: 28pt
    first-indent: 0in
    following-entity: body-first
    font-family: "var(--font-text-theme), var(--font-text-override)"
    font-size: 11.5pt
    font-variant: regular
    left-indent: 0in
    line-spacing: 28pt
    name: "Heading 3"
    right-indent: 0in
    text-align: center
```