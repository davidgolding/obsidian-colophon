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
                
                if (editor.options.plugin && editor.options.plugin.adapter) {
                    editor.options.plugin.adapter.focusNote(node.attrs.id);
                }
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
                // Match the trigger either with or without a space
                // but only at the end of a line/word
                find: new RegExp(`\\(\\($`),
                handler: ({ state, range, editor }) => {
                    const id = `fn-${crypto.randomUUID()}`;
                    const { tr } = state;

                    tr.replaceWith(range.from, range.to, this.type.create({ id }));
                    
                    // Signal the adapter to focus this new note
                    // We use a small delay to ensure the DOM has updated
                    setTimeout(() => {
                        if (editor.options.plugin && editor.options.plugin.adapter) {
                            editor.options.plugin.adapter.focusNote(id);
                        }
                    }, 10);

                    return tr;
                },
            }),
        ];
    },
});
