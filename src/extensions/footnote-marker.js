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
                
                // Dispatch custom event to be caught by the view/adapter
                dom.dispatchEvent(new CustomEvent('colophon-focus-footnote', {
                    bubbles: true,
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
        // Escape regex special characters in the trigger
        const escapedTrigger = this.options.trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        return [
            new InputRule({
                find: new RegExp(`\\(\\($`),
                handler: ({ state, range }) => {
                    const id = `fn-${crypto.randomUUID()}`;
                    const { tr } = state;

                    tr.replaceWith(range.from, range.to, this.type.create({ id }));
                    
                    // Signal creation to be caught by adapter
                    // We use a timeout to let the node render first
                    setTimeout(() => {
                        const event = new CustomEvent('colophon-create-footnote', {
                            bubbles: true,
                            detail: { id }
                        });
                        document.body.dispatchEvent(event);
                    }, 50);

                    return tr;
                },
            }),
        ];
    },
});
