import { Node, mergeAttributes, InputRule } from '@tiptap/core';

export const FootnoteMarker = Node.create({
    name: 'footnoteMarker',
    group: 'inline',
    inline: true,
    selectable: true,
    atom: true,

    addOptions() {
        return {
            trigger: '(( ',
        };
    },

    addAttributes() {
        return {
            id: {
                default: null,
            },
            number: {
                default: '?',
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'span[data-footnote-id]',
            },
        ];
    },

    renderHTML({ node, HTMLAttributes }) {
        return [
            'span',
            mergeAttributes(HTMLAttributes, {
                'class': 'colophon-footnote-marker',
                'data-footnote-id': node.attrs.id,
            }),
            node.attrs.number.toString(),
        ];
    },

    addNodeView() {
        return ({ node, HTMLAttributes, getPos, editor }) => {
            const dom = document.createElement('span');
            dom.className = 'colophon-footnote-marker';
            dom.dataset.footnoteId = node.attrs.id;
            dom.textContent = node.attrs.number.toString();

            dom.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Dispatch decoupled event
                document.body.dispatchEvent(new CustomEvent('colophon:footnote:focus', {
                    detail: { id: node.attrs.id }
                }));
            });

            return {
                dom,
                update: (updatedNode) => {
                    if (updatedNode.type !== node.type) return false;
                    dom.textContent = updatedNode.attrs.number.toString();
                    return true;
                }
            };
        };
    },

    addInputRules() {
        return [
            new InputRule({
                find: /\(\($/,
                handler: ({ state, range }) => {
                    const id = `fn-${crypto.randomUUID()}`;
                    const { tr } = state;

                    tr.replaceWith(range.from, range.to, this.type.create({ id }));
                    
                    // Signal creation to be caught by adapter
                    setTimeout(() => {
                        document.body.dispatchEvent(new CustomEvent('colophon:footnote:create', {
                            detail: { id }
                        }));
                    }, 10);

                    return tr;
                },
            }),
        ];
    },
});
