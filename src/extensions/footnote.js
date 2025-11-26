const { Node, mergeAttributes } = require('@tiptap/core');

const Footnote = Node.create({
    name: 'footnote',

    group: 'inline',

    inline: true,

    atom: true,

    addAttributes() {
        return {
            id: {
                default: null,
                parseHTML: element => element.getAttribute('data-id'),
                renderHTML: attributes => {
                    return {
                        'data-id': attributes.id,
                    }
                },
            },
            number: {
                default: null,
                // Number is transient, calculated at render time usually, but we can store it for now
                // or rely on the decoration logic. For simplicity, let's try to keep it in sync or just render a placeholder if needed.
                // Actually, for a simple implementation, we might just render [*] and let the view handle the numbering,
                // but Tiptap nodes can be reactive.
                // Let's stick to ID for the data model.
            }
        }
    },

    parseHTML() {
        return [
            {
                tag: 'span[data-type="footnote"]',
            },
        ]
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'footnote', class: 'colophon-footnote' }),
            ['sup', { class: 'footnote-symbol' }, HTMLAttributes.number || '#']
        ]
    },

    addCommands() {
        return {
            addFootnote: () => ({ commands }) => {
                const id = `fn-${Date.now()}`;
                return commands.insertContent({
                    type: this.name,
                    attrs: { id, number: '#' }, // Initial placeholder
                })
            },
        }
    },
});

module.exports = Footnote;
