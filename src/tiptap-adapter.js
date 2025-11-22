const { Editor, Mark, mergeAttributes } = require('@tiptap/core');
const { StarterKit } = require('@tiptap/starter-kit');
const Underline = require('@tiptap/extension-underline');
const Subscript = require('@tiptap/extension-subscript');
const Superscript = require('@tiptap/extension-superscript');
const TextStyle = require('@tiptap/extension-text-style');
const PopoverMenu = require('./popover-menu');
const { FootnoteExtension } = require('./tiptap-footnotes');

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
    }

    load(markdown, data) {
        if (this.editor) {
            this.editor.destroy();
        }

        let content = data;
        if (!content) {
            content = this.parseMarkdown(markdown);
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
                FootnoteExtension
            ],
            editorProps: {
                attributes: {
                    spellcheck: this.isSpellcheckEnabled ? 'true' : 'false',
                },
            },
            content: content,
            onUpdate: ({ editor }) => {
                if (this.onUpdate) {
                    this.onUpdate(editor.getJSON());
                }
            },
        });

        // Initialize Popover
        this.popover = new PopoverMenu(this.editor, this.containerEl);

        // Add Context Menu Listener
        this.editor.view.dom.addEventListener('contextmenu', (e) => {
            // Check if there is a selection
            const { from, to } = this.editor.state.selection;
            // Allow popover even without selection if we want to add actions like "Insert Footnote" at cursor?
            // User asked for "Add footnote" to the selection popover.
            // Usually selection popover implies selection.
            // But for "Insert Footnote" it might be useful at cursor.
            // Let's stick to selection for now as per request "selection popover".

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

    parseMarkdown(markdown) {
        // Regex for footnote definitions: [^id]: content
        const definitionRegex = /^\[\^([a-zA-Z0-9-]+)\]: (.*)$/gm;
        // Regex for footnote references: [^id]
        const referenceRegex = /\[\^([a-zA-Z0-9-]+)\]/g;

        // 1. Extract Definitions
        const definitions = new Map();
        let match;
        while ((match = definitionRegex.exec(markdown)) !== null) {
            definitions.set(match[1], match[2]);
        }

        // Remove definitions from markdown to process body
        const bodyMarkdown = markdown.replace(definitionRegex, '').trim();

        // 2. Process Body
        // Split by double newline for paragraphs
        const paragraphs = bodyMarkdown.split(/\n\n+/);

        const content = [];

        paragraphs.forEach(pText => {
            if (!pText.trim()) return;

            // Check if it's a heading
            const headingMatch = pText.match(/^(#{1,6})\s+(.*)/);
            if (headingMatch) {
                content.push({
                    type: 'heading',
                    attrs: { level: headingMatch[1].length },
                    content: [{ type: 'text', text: headingMatch[2] }]
                });
                return;
            }

            // Process paragraph text for references
            const inlineContent = [];
            let lastIndex = 0;
            let refMatch;

            // Reset regex lastIndex
            referenceRegex.lastIndex = 0;

            while ((refMatch = referenceRegex.exec(pText)) !== null) {
                // Text before reference
                if (refMatch.index > lastIndex) {
                    inlineContent.push({
                        type: 'text',
                        text: pText.substring(lastIndex, refMatch.index)
                    });
                }

                // Reference
                const id = refMatch[1];
                // Find number based on order? Or just use ID?
                // For simplicity, let's map IDs to numbers based on appearance order or definition order.
                // Let's assume ID is the number for now if it's numeric, or generate one.
                // Actually, let's just pass the ID. The extension can handle display.
                // But we defined 'number' attr.

                inlineContent.push({
                    type: 'footnoteReference',
                    attrs: { id: id, number: id } // Using ID as number for now
                });

                lastIndex = referenceRegex.lastIndex;
            }

            // Remaining text
            if (lastIndex < pText.length) {
                inlineContent.push({
                    type: 'text',
                    text: pText.substring(lastIndex)
                });
            }

            content.push({
                type: 'paragraph',
                content: inlineContent
            });
        });

        // 3. Append Definitions to content
        definitions.forEach((defContent, id) => {
            content.push({
                type: 'footnoteDefinition',
                attrs: { id: id, number: id },
                content: [{
                    type: 'paragraph',
                    content: [{ type: 'text', text: defContent }]
                }]
            });
        });

        return {
            type: 'doc',
            content: content
        };
    }

    addFootnote() {
        if (this.editor) {
            this.editor.chain().focus().addFootnote().run();
        }
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
