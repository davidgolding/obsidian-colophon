const { Mark, InputRule, mergeAttributes } = require('@tiptap/core');
const { Plugin } = require('@tiptap/pm/state');

const StandardLink = Mark.create({
    name: 'standardLink',

    inclusive: false,

    addOptions() {
        return {
            app: null, // Obsidian App instance
            HTMLAttributes: {
                class: 'standard-link',
            },
        }
    },

    addAttributes() {
        return {
            href: {
                default: null,
            },
        }
    },

    parseHTML() {
        return [
            {
                tag: 'a[href]:not(.internal-link)',
            },
        ]
    },

    renderHTML({ HTMLAttributes }) {
        return ['a', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
    },

    addInputRules() {
        return [
            new InputRule({
                find: /\[([^\]]+)\]\(([^)]+)\)$/,
                handler: ({ state, range, match }) => {
                    const { tr } = state;
                    const start = range.from;
                    const end = range.to;
                    const text = match[1];
                    const href = match[2];

                    tr.replaceWith(start, end, state.schema.text(text, [
                        state.schema.marks.standardLink.create({ href })
                    ]));

                    return tr;
                },
            }),
        ]
    },

    addProseMirrorPlugins() {
        const extension = this;
        return [
            new Plugin({
                props: {
                    handleDOMEvents: {
                        click(view, event) {
                            const target = event.target.closest('a.standard-link');
                            if (!target) return false;

                            const href = target.getAttribute('href');

                            if (href && extension.options.app) {
                                event.preventDefault();
                                event.stopPropagation();

                                // Check if it's an external link
                                const isExternal = /^(http|https|mailto|tel):/.test(href);

                                if (isExternal) {
                                    // Let Obsidian handle external links (or window.open)
                                    window.open(href, '_blank');
                                    return true;
                                }

                                // Internal Link Logic
                                const sourcePath = extension.options.getFilePath ? extension.options.getFilePath() : '';
                                const isMod = navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? event.metaKey : event.ctrlKey;
                                const isAlt = event.altKey;

                                if (isMod && isAlt) {
                                    extension.options.app.workspace.openLinkText(href, sourcePath, 'split');
                                } else if (isMod) {
                                    extension.options.app.workspace.openLinkText(href, sourcePath, 'tab');
                                } else {
                                    extension.options.app.workspace.openLinkText(href, sourcePath, false);
                                }
                                return true;
                            }
                            return false;
                        }
                    },
                },
            }),
        ]
    },
});

module.exports = StandardLink;
