const { Editor, Mark, mergeAttributes } = require('@tiptap/core');
const { StarterKit } = require('@tiptap/starter-kit');
const Underline = require('@tiptap/extension-underline');
const Subscript = require('@tiptap/extension-subscript');
const Superscript = require('@tiptap/extension-superscript');
const TextStyle = require('@tiptap/extension-text-style');
const PopoverMenu = require('./popover-menu');
const Footnote = require('./extensions/footnote');

// Custom Small Caps Extension
const SmallCaps = Mark.create({
    name: 'smallCaps',
    parseHTML() {
        return [
            {
                style: 'font-variant',
                getAttrs: value => (value === 'small-caps' ? {} : false),
            },
        ]
    },
    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(HTMLAttributes, { style: 'font-variant: small-caps' }), 0]
    },
    addCommands() {
        return {
            toggleSmallCaps: () => ({ commands }) => {
                return commands.toggleMark(this.name)
            },
        }
    },
});

class TiptapAdapter {
    constructor(containerEl, isSpellcheckEnabled, onUpdate) {
        this.containerEl = containerEl;
        this.isSpellcheckEnabled = isSpellcheckEnabled;
        this.onUpdate = onUpdate; // Callback when editor content changes
        this.editor = null;
        this.isLoaded = false;
        this.popover = null;
        this.footnotes = []; // Store footnote definitions: { id, content }
        this.listeners = []; // Listeners for footnote updates
    }

    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    load(markdown, data) {
        if (this.editor) {
            this.editor.destroy();
        }

        let content = null;

        // Handle Data Structure (Legacy vs New)
        if (data) {
            if (data.doc) {
                // New structure: { doc: ..., footnotes: ... }
                content = data.doc;
                this.footnotes = data.footnotes || [];
            } else {
                // Legacy structure: data IS the doc
                content = data;
                this.footnotes = [];
            }
        }

        // Fallback to parsing Markdown if no data
        if (!content) {
            content = {
                type: 'doc',
                content: markdown.split('\n\n').map(text => ({
                    type: 'paragraph',
                    content: text.trim() ? [{ type: 'text', text: text.trim() }] : []
                }))
            };
            this.footnotes = [];
        }

        this.editor = new Editor({
            element: this.containerEl,
            extensions: [
                StarterKit,
                Underline,
                Subscript,
                Superscript,
                TextStyle,
                SmallCaps,
                Footnote
            ],
            editorProps: {
                attributes: {
                    spellcheck: this.isSpellcheckEnabled ? 'true' : 'false',
                },
            },
            content: content,
            onUpdate: ({ editor }) => {
                this.triggerUpdate();
            },
        });

        // Initialize Popover
        this.popover = new PopoverMenu(this.editor, this.containerEl);
        this.popover.setMode('default');

        // Add Context Menu Listener
        this.editor.view.dom.addEventListener('contextmenu', (e) => {
            // Check if there is a selection
            const { from, to } = this.editor.state.selection;
            if (from !== to) {
                e.preventDefault();
                const rect = this.containerEl.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                this.popover.show(x, y);
            }
        });

        this.isLoaded = true;
    }

    triggerUpdate() {
        if (!this.editor) return;

        // 1. Calculate Footnote Numbers
        const footnotesInDoc = [];
        let index = 1;
        let hasChanges = false;

        this.editor.state.doc.descendants((node, pos) => {
            if (node.type.name === 'footnote') {
                const number = String(index++);
                footnotesInDoc.push({
                    id: node.attrs.id,
                    number: number,
                    pos: pos
                });

                // If the number in the node doesn't match the calculated number, we need to update it.
                // However, updating the document inside onUpdate can cause infinite loops if not careful.
                // We should only update if it's different.
                if (node.attrs.number !== number) {
                    // We can't dispatch a transaction synchronously inside onUpdate if it triggers another update immediately?
                    // Tiptap's onUpdate is called after the transaction. Dispatching a new one is fine usually.
                    // But to avoid infinite loops, we should check if we are already processing.
                    // Let's collect changes and apply them in a separate transaction if needed, 
                    // OR just rely on the view to render the number if we used decorations.
                    // Since we are using attributes, we MUST update the node.

                    // We'll defer the update to avoid conflict or use a flag.
                    // Actually, let's just store the need to update and do it.
                    // But wait, if we update the node, onUpdate fires again.
                    // We need to ensure we don't update if it's already correct.
                    // The check `node.attrs.number !== number` handles that.
                    hasChanges = true;
                }
            }
        });

        // 2. Sync with sidecar data
        // We want to keep the content from existing footnotes if IDs match
        const newFootnotesList = footnotesInDoc.map(fn => {
            const existing = this.footnotes.find(f => f.id === fn.id);
            return {
                id: fn.id,
                number: fn.number,
                content: existing ? existing.content : ''
            };
        });

        this.footnotes = newFootnotesList;

        // 3. Apply Numbering Updates to Document if needed
        if (hasChanges) {
            // We need to schedule this update to happen after the current cycle to avoid issues?
            // Or just do it. Tiptap/ProseMirror allows dispatching new transactions.
            // We just need to be careful about mapping positions if we do multiple.
            // But since we are just setting attributes, positions shouldn't change.

            // Let's try to do it in a microtask to be safe and avoid "applying transaction during dispatch" errors.
            Promise.resolve().then(() => {
                if (!this.editor || this.editor.isDestroyed) return;

                const tr = this.editor.state.tr;
                let modified = false;

                this.editor.state.doc.descendants((node, pos) => {
                    if (node.type.name === 'footnote') {
                        const targetNumber = footnotesInDoc.find(f => f.id === node.attrs.id)?.number;
                        if (targetNumber && node.attrs.number !== targetNumber) {
                            tr.setNodeMarkup(pos, null, { ...node.attrs, number: targetNumber });
                            modified = true;
                        }
                    }
                });

                if (modified) {
                    this.editor.view.dispatch(tr);
                }
            });
        }

        if (this.onUpdate) {
            this.onUpdate({
                doc: this.editor.getJSON(),
                footnotes: this.footnotes
            });
        }

        // Notify listeners (e.g. FootnoteView)
        this.listeners.forEach(listener => listener());
    }

    addFootnote() {
        if (this.editor) {
            const id = `fn-${Date.now()}`;
            this.editor.chain().focus().insertContent({
                type: 'footnote',
                attrs: { id, number: '#' }
            }).run();

            // The onUpdate will trigger and fix the numbering
            return id;
        }
    }

    updateFootnote(id, content) {
        const fn = this.footnotes.find(f => f.id === id);
        if (fn) {
            fn.content = content;
            // We don't need to update the editor doc for content changes, just the sidecar data
            // But we do need to trigger the onUpdate callback to save to disk
            if (this.onUpdate) {
                this.onUpdate({
                    doc: this.editor.getJSON(),
                    footnotes: this.footnotes
                });
            }
        }
    }

    getFootnotes() {
        return this.footnotes;
    }

    destroy() {
        if (this.popover) {
            this.popover.destroy();
        }
        if (this.editor) {
            this.editor.destroy();
            this.editor = null;
        }
    }

    focus() {
        if (this.editor) {
            this.editor.commands.focus();
        }
    }
}

module.exports = TiptapAdapter;
