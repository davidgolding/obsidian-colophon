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
        return ['sup', mergeAttributes(HTMLAttributes, { 'data-footnote-reference': '' }), `${HTMLAttributes.number}`]
    },
});

const FootnoteExtension = Node.create({
    name: 'footnote',

    addExtensions() {
        return [
            FootnoteReference,
        ]
    },

    addProseMirrorPlugins() {
        const { Plugin, PluginKey } = require('@tiptap/pm/state');

        return [
            new Plugin({
                key: new PluginKey('footnote-reindexer'),
                appendTransaction: (transactions, oldState, newState) => {
                    // Check if any transaction changed the document
                    const docChanged = transactions.some(tr => tr.docChanged);
                    if (!docChanged) return;

                    const { tr } = newState;
                    let modified = false;
                    let index = 1;

                    newState.doc.descendants((node, pos) => {
                        if (node.type.name === 'footnoteReference') {
                            const currentNumber = node.attrs.number;
                            // Convert to int just in case
                            const currentNumInt = parseInt(currentNumber, 10);

                            if (currentNumInt !== index) {
                                tr.setNodeMarkup(pos, undefined, {
                                    ...node.attrs,
                                    number: index
                                });
                                modified = true;
                            }
                            index++;
                        }
                    });

                    if (modified) {
                        return tr;
                    }
                }
            })
        ]
    },

    addCommands() {
        return {
            addFootnote: () => ({ editor, tr, dispatch }) => {
                const { selection } = editor.state;
                const id = crypto.randomUUID();

                // Calculate next number (naive implementation, real re-indexing happens on update usually)
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

                    // Dispatch event for sidebar to pick up (if needed, or sidebar just reacts to doc change)
                }

                return true;
            },
        }
    },
});

module.exports = {
    FootnoteExtension,
    FootnoteReference
};
