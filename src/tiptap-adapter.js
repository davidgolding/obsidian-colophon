const { Editor, Mark, Extension, mergeAttributes } = require('@tiptap/core');
const { StarterKit } = require('@tiptap/starter-kit');
const { Paragraph } = require('@tiptap/extension-paragraph');
const { Heading } = require('@tiptap/extension-heading');
const Underline = require('@tiptap/extension-underline');
const Subscript = require('@tiptap/extension-subscript');
const Superscript = require('@tiptap/extension-superscript');
const TextStyle = require('@tiptap/extension-text-style');
const { InputRule } = require('@tiptap/core');
const PopoverMenu = require('./popover-menu');
const Footnote = require('./extensions/footnote');
const Substitutions = require('./extensions/substitutions');
const InternalLink = require('./extensions/internallink');
const StandardLink = require('./extensions/standard-link');

// Custom extension to handle the Enter key
const EnterKeyHandler = Extension.create({
    name: 'enterKeyHandler',

    addKeyboardShortcuts() {
        return {
            'Enter': () => {
                const { state } = this.editor;
                const { $from } = state.selection;
                const currentNode = $from.parent;

                if (currentNode.attrs.class !== 'body') {
                    // If so, split the block and set the new one to be a default paragraph
                    return this.editor.chain().focus().splitBlock().setNode('paragraph', { class: 'body' }).run();
                }

                // For all other cases, use the default behavior
                return this.editor.commands.splitBlock();
            },
        };
    },
});

// Custom Paragraph with Class Support
const CustomParagraph = Paragraph.extend({
    addAttributes() {
        return {
            class: {
                default: "body",
                parseHTML: element => element.getAttribute('class'),
                renderHTML: attributes => {
                    if (!attributes.class) {
                        return {}
                    }
                    return { class: attributes.class }
                },
            },
        }
    },
});

// Custom Heading with Class Support
const CustomHeading = Heading.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            level: {
                default: 1,
                keepOnSplit: false,
            },
            class: {
                default: "heading-1",
                parseHTML: element => element.getAttribute('class'),
                renderHTML: attributes => {
                    if (!attributes.class) {
                        return {}
                    }
                    return { class: attributes.class }
                },
            },
        }
    },
});

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
    constructor(app, containerEl, isSpellcheckEnabled, settings, onUpdate) {
        this.app = app;
        this.containerEl = containerEl;
        this.isSpellcheckEnabled = isSpellcheckEnabled;
        this.settings = settings;
        this.onUpdate = onUpdate; // Callback when editor content changes
        this.editor = null;
        this.isLoaded = false;
        this.popover = null;
        this.footnotes = []; // Store footnote definitions: { id, content }
        this.listeners = []; // Listeners for footnote updates
    }

    normalizeDoc(doc) {
        if (!doc || !doc.content) {
            return doc;
        }
        doc.content.forEach(node => {
            if (node.type === 'paragraph') {
                if (!node.attrs || node.attrs.class === null || node.attrs.class === undefined) {
                    node.attrs = { ...node.attrs, class: 'body' };
                }
            } else if (node.type === 'heading') {
                if (!node.attrs || node.attrs.class === null || node.attrs.class === undefined) {
                    const level = node.attrs?.level || 1;
                    node.attrs = { ...node.attrs, class: `heading-${level}` };
                }
            }
        });
        return doc;
    }

    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    updateSettings(newSettings) {
        this.settings = newSettings;
        // Re-initialize editor to apply new input rules
        // We need to save current state first
        if (this.editor) {
            const content = this.editor.getJSON();
            const selection = this.editor.state.selection;
            this.editor.destroy();
            this.initEditor(content);
            // Restore selection? Might be tricky with new editor instance
            // For now, just reloading is safer for settings changes
        }
    }

    load(markdown, data, filePath) {
        this.filePath = filePath;

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

        // Normalize content to ensure all nodes have a class
        content = this.normalizeDoc(content);

        this.initEditor(content);
        this.isLoaded = true;
    }

    initEditor(content) {
        this.editor = new Editor({
            element: this.containerEl,
            extensions: [
                StarterKit.configure({
                    paragraph: false,
                    heading: false,
                }),
                EnterKeyHandler,
                CustomParagraph,
                CustomHeading,
                Underline,
                Subscript,
                Superscript,
                TextStyle,
                SmallCaps,
                Footnote,
                Substitutions.configure({
                    smartQuotes: this.settings.smartQuotes,
                    smartDashes: this.settings.smartDashes,
                    doubleQuoteStyle: this.settings.doubleQuoteStyle,
                    singleQuoteStyle: this.settings.singleQuoteStyle,
                }),
                InternalLink.configure({
                    app: this.app,
                    getFilePath: () => this.filePath
                }),
                StandardLink.configure({
                    app: this.app,
                    getFilePath: () => this.filePath
                })
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
