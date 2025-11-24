const { SuggestModal } = require('obsidian');
const { TextSelection } = require('@tiptap/pm/state');

class LinkSuggestModal extends SuggestModal {
    constructor(app, editor, range) {
        super(app);
        this.app = app;
        this.editor = editor; // Tiptap editor instance
        this.range = range; // { from, to } of the '[[' trigger

        this.updateListener = () => this.updateAndFilterSuggestions();
    }

    onOpen() {
        super.onOpen();
        this.editor.on('update', this.updateListener);
        this.updateAndFilterSuggestions(); // Initial call
    }

    onClose() {
        super.onClose();
        this.editor.off('update', this.updateListener);
    }

    updateAndFilterSuggestions() {
        const query = this.getEditorQuery();
        if (query === null) {
            this.close();
            return;
        }
        this.inputEl.value = query;
        this.onInput(); // Triggers getSuggestions in the base class
    }

    getEditorQuery() {
        try {
            const currentState = this.editor.state;
            const currentPos = currentState.selection.from;

            // Close if cursor is before the start of the link trigger
            if (currentPos < this.range.from + 2) return null;

            // Close if the trigger `[[` is no longer present
            if (currentState.doc.textBetween(this.range.from, this.range.from + 2) !== '[[') return null;

            return currentState.doc.textBetween(this.range.from + 2, currentPos);
        } catch (e) {
            // This can happen if the state becomes invalid, good to have a fallback.
            return null;
        }
    }

    getSuggestions(query) {
        const files = this.app.vault.getMarkdownFiles();
        if (!query) return files;

        const lowerCaseQuery = query.toLowerCase();
        return files.filter(file =>
            file.path.toLowerCase().includes(lowerCaseQuery) ||
            file.basename.toLowerCase().includes(lowerCaseQuery)
        );
    }

    renderSuggestion(file, el) {
        el.createEl('div', { text: file.basename });
        el.createEl('small', { text: file.path });
    }

    onChooseSuggestion(file, evt) {
        const linkText = file.basename;

        if (this.editor && !this.editor.isDestroyed) {
            const { schema, tr } = this.editor.state;

            // The range to replace is from the start of the `[[` to where the cursor is *now*.
            const from = this.range.from;
            const to = this.editor.state.selection.from;

            tr.replaceWith(from, to, schema.text(linkText, [
                schema.marks.internallink.create({ href: linkText })
            ]));

            // Insert a space after the new link and move selection there
            const endOfLink = from + linkText.length;
            tr.insert(endOfLink, schema.text(' '));
            tr.setSelection(TextSelection.create(tr.doc, endOfLink + 1));

            this.editor.view.dispatch(tr);
        }
    }
}

module.exports = LinkSuggestModal;
