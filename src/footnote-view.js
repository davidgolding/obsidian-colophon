const { ItemView, WorkspaceLeaf, Notice, setIcon } = require('obsidian');
const { Editor, mergeAttributes } = require('@tiptap/core');
const { StarterKit } = require('@tiptap/starter-kit');
const Underline = require('@tiptap/extension-underline');
const Subscript = require('@tiptap/extension-subscript');
const Superscript = require('@tiptap/extension-superscript');
const TextStyle = require('@tiptap/extension-text-style');
const PopoverMenu = require('./popover-menu');
const Substitutions = require('./extensions/substitutions');
const InternalLink = require('./extensions/internallink');

const FOOTNOTE_VIEW_TYPE = 'colophon-footnote-view';

class FootnoteView extends ItemView {
    constructor(leaf, settings) {
        super(leaf);
        this.settings = settings || { smartQuotes: true, smartDashes: true, doubleQuoteStyle: '“|”', singleQuoteStyle: '‘|’' };
        this.adapter = null;
        this.editors = new Map(); // Map<id, Editor>
        this.popover = null;
    }

    getViewType() {
        return FOOTNOTE_VIEW_TYPE;
    }

    getDisplayText() {
        return 'Footnotes';
    }

    getIcon() {
        return 'list';
    }

    async onOpen() {
        const container = this.contentEl;
        container.empty();
        container.addClass('colophon-footnote-view');

        // Initialize Popover (shared instance)
        // We pass null as editor initially, it will be updated on trigger
        this.popover = new PopoverMenu(null, container);
        this.popover.setMode('footnote');

        this.render();
    }

    async onClose() {
        // Cleanup editors
        this.editors.forEach(editor => editor.destroy());
        this.editors.clear();

        if (this.popover) {
            this.popover.destroy();
        }

        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }

    updateSettings(newSettings) {
        this.settings = newSettings;
        // We need to re-initialize editors to apply new input rules
        // This is a bit heavy, but necessary for input rules
        // We can just clear and re-render
        this.render(true); // Force re-render
    }

    setAdapter(adapter) {
        // Unsubscribe from previous adapter if exists
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }

        this.adapter = adapter;

        if (this.adapter) {
            // Subscribe to updates
            this.unsubscribe = this.adapter.subscribe(() => {
                this.render();
            });
        }

        this.render();
    }

    render(force = false) {
        const container = this.contentEl;

        if (!this.adapter) {
            container.empty();
            this.editors.forEach(editor => editor.destroy());
            this.editors.clear();
            container.createEl('div', {
                text: 'No active manuscript.',
                cls: 'colophon-footnote-empty'
            });
            return;
        }

        const footnotes = this.adapter.getFootnotes();

        if (!footnotes || footnotes.length === 0) {
            container.empty();
            this.editors.forEach(editor => editor.destroy());
            this.editors.clear();
            container.createEl('div', {
                text: 'No footnotes yet.',
                cls: 'colophon-footnote-empty'
            });
            return;
        }

        // We need a container for the list if it doesn't exist
        let list = container.querySelector('.colophon-footnote-list');
        if (!list) {
            container.empty();
            list = container.createEl('div', { cls: 'colophon-footnote-list' });
        }

        // Track active IDs to remove old ones
        const activeIds = new Set(footnotes.map(f => f.id));

        // Remove old editors
        for (const [id, editor] of this.editors) {
            if (!activeIds.has(id) || force) {
                editor.destroy();
                this.editors.delete(id);
                const el = list.querySelector(`[data-footnote-id="${id}"]`);
                if (el) el.remove();
            }
        }

        // Update or Create editors
        footnotes.forEach((fn, index) => {
            let item = list.querySelector(`[data-footnote-id="${fn.id}"]`);

            if (!item) {
                item = list.createEl('div', { cls: 'colophon-footnote-item' });
                item.dataset.footnoteId = fn.id;

                // Header
                const header = item.createEl('div', { cls: 'colophon-footnote-header' });
                header.createSpan({ text: `${fn.number || index + 1}. `, cls: 'colophon-footnote-number' });

                // Editor Container
                const editorContainer = item.createEl('div', { cls: 'colophon-footnote-editor-container' });

                // Initialize Tiptap
                const editor = new Editor({
                    element: editorContainer,
                    extensions: [
                        StarterKit,
                        Underline,
                        Subscript,
                        Superscript,
                        TextStyle,
                        Substitutions.configure({
                            smartQuotes: this.settings.smartQuotes,
                            smartDashes: this.settings.smartDashes,
                            doubleQuoteStyle: this.settings.doubleQuoteStyle,
                            singleQuoteStyle: this.settings.singleQuoteStyle,
                        }),
                        InternalLink.configure({
                            app: this.app
                        })
                    ],
                    content: fn.content, // Handles string or JSON
                    onUpdate: ({ editor }) => {
                        // Sync back to adapter
                        // We store JSON now
                        this.adapter.updateFootnote(fn.id, editor.getJSON());
                    },
                    editorProps: {
                        attributes: {
                            class: 'colophon-footnote-editor-content',
                        },
                    },
                });

                // Add Context Menu Listener for Popover
                editor.view.dom.addEventListener('contextmenu', (e) => {
                    // Check if there is a selection
                    const { from, to } = editor.state.selection;
                    if (from !== to) {
                        e.preventDefault();
                        e.stopPropagation();

                        // Update popover's editor reference
                        this.popover.editor = editor;

                        // Calculate position relative to container
                        const rect = this.contentEl.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const y = e.clientY - rect.top;

                        this.popover.show(x, y);
                    }
                });

                this.editors.set(fn.id, editor);
            } else {
                // Update Number
                const numberSpan = item.querySelector('.colophon-footnote-number');
                if (numberSpan) numberSpan.innerText = `${fn.number || index + 1}. `;

                // Update Content? 
                // Only if it's significantly different and we are NOT focused?
                // If we update content while typing, cursor jumps.
                // We assume the editor's internal state is the source of truth while focused.
                // But if we undo in main doc and it reverts footnote content?
                // For now, we skip content update if editor exists to avoid cursor issues.
                // The adapter is the source of truth, but the editor is the local state.
            }
        });

        // Re-order items in DOM if needed?
        // footnotes is ordered. We should ensure DOM order matches.
        footnotes.forEach(fn => {
            const item = list.querySelector(`[data-footnote-id="${fn.id}"]`);
            if (item) list.appendChild(item); // Moves it to end, effectively sorting if we iterate in order
        });
    }

    focusFootnote(id) {
        const editor = this.editors.get(id);
        if (editor) {
            editor.commands.focus();
            // Scroll into view
            const item = this.contentEl.querySelector(`[data-footnote-id="${id}"]`);
            if (item) {
                item.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }

    getFocusedEditor() {
        for (const editor of this.editors.values()) {
            if (editor.isFocused) {
                return editor;
            }
        }
        return null;
    }
}

module.exports = {
    FootnoteView,
    FOOTNOTE_VIEW_TYPE
};
