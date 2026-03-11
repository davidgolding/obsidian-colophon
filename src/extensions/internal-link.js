import { Node, mergeAttributes, InputRule } from '@tiptap/core';

export const InternalLink = Node.create({
    name: 'internalLink',
    group: 'inline',
    inline: true,
    selectable: true,
    atom: true,

    addAttributes() {
        return {
            target: {
                default: null,
            },
            alias: {
                default: null,
            },
            blockId: {
                default: null,
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'span[data-colophon-link]',
            },
        ];
    },

    renderHTML({ node, HTMLAttributes }) {
        const { target, alias } = node.attrs;
        return [
            'span',
            mergeAttributes(HTMLAttributes, { 
                'data-colophon-link': target,
                'class': 'colophon-internal-link',
                'title': `Click to open ${target}`
            }),
            alias || target.split('/').pop().replace('.md', '').replace('.colophon', '')
        ];
    },

    renderText({ node }) {
        const { target, alias } = node.attrs;
        return alias || target;
    },

    addNodeView() {
        return ({ node, HTMLAttributes, getPos, editor }) => {
            const dom = document.createElement('span');
            dom.className = 'colophon-internal-link';
            dom.setAttribute('data-colophon-link', node.attrs.target);
            
            const render = () => {
                // Ensure getPos is a function before calling
                const pos = typeof getPos === 'function' ? getPos() : null;
                if (pos === null) return;

                const { selection } = editor.state;
                
                // Show brackets if:
                // 1. Cursor is inside/on the node
                // 2. Node is fully selected
                // 3. Cursor is immediately before or after the node
                const isSelected = (selection.from >= pos && selection.to <= pos + node.nodeSize) ||
                                 (selection.from === pos) || (selection.to === pos + node.nodeSize);
                
                if (isSelected) {
                    dom.classList.add('is-selected');
                    const target = node.attrs.target;
                    const alias = node.attrs.alias;
                    // We use visible text for the brackets so the user can see/edit
                    dom.textContent = alias ? `[[${target}|${alias}]]` : `[[${target}]]`;
                } else {
                    dom.classList.remove('is-selected');
                    dom.textContent = node.attrs.alias || node.attrs.target.split('/').pop().replace('.md', '').replace('.colophon', '');
                }
            };

            dom.addEventListener('click', (e) => {
                // In Obsidian, links open on Cmd/Ctrl+Click OR if already in 'render' mode
                const shouldOpen = e.metaKey || e.ctrlKey || dom.classList.contains('is-selected');
                
                if (shouldOpen) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const app = editor.options.app;
                    if (app) {
                        app.workspace.openLinkText(node.attrs.target, '', e.metaKey || e.ctrlKey || e.shiftKey);
                    }
                }
            });

            // Tiptap selection update event
            const onUpdate = () => render();
            editor.on('selectionUpdate', onUpdate);
            editor.on('transaction', onUpdate); // More frequent updates

            render();

            return {
                dom,
                destroy() {
                    editor.off('selectionUpdate', onUpdate);
                    editor.off('transaction', onUpdate);
                }
            };
        };
    },

    addCommands() {
        return {
            insertInternalLink: (attributes) => ({ chain }) => {
                return chain()
                    .insertContent({
                        type: this.name,
                        attrs: attributes,
                    })
                    .run();
            },
        };
    },

    addInputRules() {
        return [
            // Wikilink [[Target]] -> InternalLink
            new InputRule({
                find: /\[\[([^\]]+)\]\]$/,
                handler: ({ state, range, match }) => {
                    const target = match[1];
                    const [path, alias] = target.split('|');
                    
                    return state.tr.replaceWith(
                        range.from,
                        range.to,
                        this.type.create({
                            target: path.trim(),
                            alias: alias ? alias.trim() : null,
                        })
                    );
                },
            }),
            // Markdown Link [Alias](Target) -> InternalLink
            new InputRule({
                find: /\[([^\]]+)\]\(([^)]+)\)$/,
                handler: ({ state, range, match }) => {
                    const alias = match[1];
                    const target = match[2];

                    return state.tr.replaceWith(
                        range.from,
                        range.to,
                        this.type.create({
                            target: target.trim(),
                            alias: alias.trim(),
                        })
                    );
                },
            }),
        ];
    },
});
