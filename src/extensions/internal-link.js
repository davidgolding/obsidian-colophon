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
            dom.textContent = node.attrs.alias || node.attrs.target.split('/').pop().replace('.md', '').replace('.colophon', '');

            dom.addEventListener('click', (e) => {
                // Shift or Alt click to open in new leaf
                const newLeaf = e.shiftKey || e.altKey || e.metaKey;
                
                // Get Obsidian app from editor options (passed via TiptapAdapter)
                const app = editor.options.app;
                if (app) {
                    app.workspace.openLinkText(node.attrs.target, '', newLeaf);
                }
            });

            return {
                dom,
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
