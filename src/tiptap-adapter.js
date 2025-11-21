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
        // We need to handle the new footnote format: <sup data-fn="id">1</sup>
        // But also keep backward compatibility or handle standard MD footnotes if we want to migrate them?
        // For now, let's focus on the new format.

        // Simple parser that converts Markdown to Tiptap JSON
        // This is a simplified version. For a production app, we might want a more robust parser.

        const lines = markdown.split('\n');
        const content = [];

        let inCodeBlock = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Headings
            const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
            if (headingMatch) {
                content.push({
                    type: 'heading',
                    attrs: { level: headingMatch[1].length },
                    content: this.parseInline(headingMatch[2])
                });
                continue;
            }

            // Paragraphs (default)
            if (line.trim() === '') continue;

            content.push({
                type: 'paragraph',
                content: this.parseInline(line)
            });
        }

        return {
            type: 'doc',
            content: content
        };
    }

    parseInline(text) {
        const content = [];
        // Regex for our footnote: <sup data-fn="id">label</sup>
        // And basic formatting

        // This is a very naive parser. In a real scenario, use a proper tokenizer.
        // For this task, let's assume we just need to handle text and footnotes for now.

        // Split by footnote tag
        const parts = text.split(/(<sup data-fn="[^"]+">.*?<\/sup>)/g);

        parts.forEach(part => {
            if (!part) return;

            const fnMatch = part.match(/<sup data-fn="([^"]+)">((?:.|\n)*?)<\/sup>/);
            if (fnMatch) {
                content.push({
                    type: 'footnoteReference',
                    attrs: {
                        id: fnMatch[1],
                        number: fnMatch[2] // The label/number
                    }
                });
            } else {
                // Text node
                content.push({
                    type: 'text',
                    text: part
                });
            }
        });

        return content;
    }

    serializeMarkdown() {
        const json = this.editor.getJSON();
        let markdown = '';

        json.content.forEach(block => {
            if (block.type === 'heading') {
                markdown += '#'.repeat(block.attrs.level) + ' ' + this.serializeInline(block.content) + '\n\n';
            } else if (block.type === 'paragraph') {
                markdown += this.serializeInline(block.content) + '\n\n';
            }
            // Add other block types here
        });

        return markdown.trim();
    }

    serializeInline(content) {
        if (!content) return '';
        return content.map(node => {
            if (node.type === 'text') {
                // Handle marks (bold, italic, etc) if we had them implemented in serializer
                return node.text;
            } else if (node.type === 'footnoteReference') {
                return `<sup data-fn="${node.attrs.id}">${node.attrs.number}</sup>`;
            }
            return '';
        }).join('');
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
