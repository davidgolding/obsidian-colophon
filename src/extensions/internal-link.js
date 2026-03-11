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

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(HTMLAttributes, { 'data-colophon-link': '' }), 0];
    },

    renderText({ node }) {
        const { target, alias } = node.attrs;
        return alias || target;
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
