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
            dom.title = `Click to open ${node.attrs.target}`;
            
            let lastIsSelected = null;
            let rafId = null;

            const updateView = () => {
                if (rafId) cancelAnimationFrame(rafId);
                
                rafId = requestAnimationFrame(() => {
                    const pos = typeof getPos === 'function' ? getPos() : null;
                    if (pos === null) return;

                    const { selection } = editor.state;
                    
                    // Show brackets if:
                    // 1. Selection intersects with the node
                    // 2. Cursor is immediately before (pos) or after (pos + nodeSize)
                    const isSelected = (selection.from >= pos && selection.from <= pos + node.nodeSize) ||
                                     (selection.to >= pos && selection.to <= pos + node.nodeSize);
                    
                    // Only update DOM if selection state changed
                    if (isSelected === lastIsSelected) return;
                    lastIsSelected = isSelected;

                    if (isSelected) {
                        dom.classList.add('is-selected');
                        const target = node.attrs.target;
                        const alias = node.attrs.alias;
                        // We use visible text for the brackets so the user can see/edit
                        const text = alias ? `[[${target}|${alias}]]` : `[[${target}]]`;
                        if (dom.textContent !== text) dom.textContent = text;
                    } else {
                        dom.classList.remove('is-selected');
                        const text = node.attrs.alias || node.attrs.target.split('/').pop().replace('.md', '').replace('.colophon', '');
                        if (dom.textContent !== text) dom.textContent = text;
                    }
                });
            };

            dom.addEventListener('mousedown', (e) => {
                // If Cmd/Ctrl is held, open immediately
                if (e.metaKey || e.ctrlKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    const app = editor.options.app;
                    if (app) {
                        app.workspace.openLinkText(node.attrs.target, '', e.shiftKey);
                    }
                    return;
                }
            });

            dom.addEventListener('click', (e) => {
                // In 'selected' mode (brackets visible), a simple click opens it
                if (dom.classList.contains('is-selected')) {
                    const app = editor.options.app;
                    if (app) {
                        app.workspace.openLinkText(node.attrs.target, '', e.shiftKey);
                    }
                }
            });

            // Listen to all relevant editor events
            editor.on('selectionUpdate', updateView);
            editor.on('transaction', updateView);

            // Initial render
            updateView();

            return {
                dom,
                update: (updatedNode) => {
                    if (updatedNode.type !== node.type) return false;
                    // If attributes changed, we need a full refresh
                    if (JSON.stringify(updatedNode.attrs) !== JSON.stringify(node.attrs)) {
                        node.attrs = updatedNode.attrs;
                        lastIsSelected = null; // Force update
                        updateView();
                    }
                    return true;
                },
                destroy: () => {
                    if (rafId) cancelAnimationFrame(rafId);
                    editor.off('selectionUpdate', updateView);
                    editor.off('transaction', updateView);
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
