const { SuggestModal } = require('obsidian');

class LinkSuggestModal extends SuggestModal {
    constructor(app, editor, range) {
        super(app);
        this.editor = editor; // Tiptap editor instance
        this.range = range; // { from, to } of the '[[' trigger
    }

    getSuggestions(query) {
        const files = this.app.vault.getFiles();
        return files.filter(file =>
            file.path.toLowerCase().includes(query.toLowerCase()) ||
            file.basename.toLowerCase().includes(query.toLowerCase())
        );
    }

    renderSuggestion(file, el) {
        el.createEl('div', { text: file.basename });
        el.createEl('small', { text: file.path });
    }

    onChooseSuggestion(file, evt) {
        // Insert the link: [[filename]]
        // We replace the '[[' trigger as well
        const linkText = file.basename;

        if (this.editor && !this.editor.isDestroyed) {
            const { schema } = this.editor.state;
            const tr = this.editor.state.tr;

            tr.replaceWith(this.range.from, this.range.to, schema.text(linkText, [
                schema.marks.wikilink.create({ href: linkText })
            ]));

            // Insert a space after to ensure we are out of the mark (redundant with inclusive: false but good UX)
            tr.insert(tr.mapping.map(this.range.to), schema.text(' '));

            this.editor.view.dispatch(tr);
        }
    }
}

module.exports = LinkSuggestModal;
