const { Node, mergeAttributes } = require('@tiptap/core');

const FootnoteReference = Node.create({
    name: 'footnoteReference',
    inline: true,
    group: 'inline',
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
                default: 1,
            }
        }
    },

    parseHTML() {
        return [
            {
                tag: 'sup[data-footnote-reference]',
            },
        ]
    },

    renderHTML({ HTMLAttributes }) {
        return ['sup', mergeAttributes(HTMLAttributes, { 'data-footnote-reference': '' }), `[${HTMLAttributes.number}]`]
    },
});

const FootnoteDefinition = Node.create({
    name: 'footnoteDefinition',
    group: 'block',
    content: 'paragraph+',
    defining: true,

    addAttributes() {
        return {
            id: {
                default: null,
            },
            number: {
                default: 1,
            }
        }
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-footnote-definition]',
            },
        ]
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'div',
            mergeAttributes(HTMLAttributes, { 'data-footnote-definition': '', class: 'footnote-definition' }),
            ['span', { class: 'footnote-label', contenteditable: 'false' }, `[${HTMLAttributes.number}]: `],
            ['div', { class: 'footnote-content' }, 0]
        ]
    },
});

const FootnoteExtension = Node.create({
    name: 'footnote',

    addExtensions() {
        return [
            FootnoteReference,
            FootnoteDefinition,
        ]
    },

    addCommands() {
        return {
            addFootnote: () => ({ editor, tr, dispatch }) => {
                const { selection } = editor.state;
                const id = `fn-${Date.now()}`;

                // Calculate next number (naive implementation, real re-indexing happens on update usually)
                // For now, let's just find the max number in existing footnotes
                let maxNum = 0;
                editor.state.doc.descendants((node) => {
                    if (node.type.name === 'footnoteReference') {
                        maxNum = Math.max(maxNum, node.attrs.number);
                    }
                });
                const number = maxNum + 1;

                if (dispatch) {
                    // Insert Reference
                    const reference = editor.schema.nodes.footnoteReference.create({ id, number });
                    tr.insert(selection.from, reference);

                    // Insert Definition at end of doc
                    const definition = editor.schema.nodes.footnoteDefinition.create(
                        { id, number },
                        editor.schema.nodes.paragraph.create(null, [])
                    );

                    tr.insert(tr.doc.content.size, definition);

                    // Move cursor to definition
                    // The definition was inserted at tr.doc.content.size (before insertion).
                    // After insertion of reference (size 1) and definition (size ?), we need to calculate pos.
                    // Easier: just map the position.

                    // Actually, let's just focus the end of the document for now.
                    // A better way is to find the position of the newly inserted definition.
                }

                return true;
            },
        }
    },
});

module.exports = {
    FootnoteExtension,
    FootnoteReference,
    FootnoteDefinition
};
