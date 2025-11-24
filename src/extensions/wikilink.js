const { Mark, InputRule, mergeAttributes } = require('@tiptap/core');
const { Plugin } = require('@tiptap/pm/state');
const LinkSuggestModal = require('../link-suggest-modal');

const Wikilink = Mark.create({
    name: 'wikilink',

    inclusive: false,

    addOptions() {
        return {
            app: null, // Obsidian App instance
            HTMLAttributes: {
                class: 'internal-link',
            },
        }
    },

    parseHTML() {
        return [
            {
                tag: 'a.internal-link',
            },
        ]
    },

    renderHTML({ HTMLAttributes }) {
        return ['a', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
    },

    addAttributes() {
        return {
            href: {
                default: null,
            },
        }
    },

    addInputRules() {
        return [
            new InputRule({
                find: /\[\[([^\]]+)\]\]$/,
                handler: ({ state, range, match }) => {
                    const { tr } = state;
                    const start = range.from;
                    const end = range.to;
                    const text = match[1];

                    tr.replaceWith(start, end, state.schema.text(text, [
                        state.schema.marks.wikilink.create({ href: text })
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
                            const target = event.target.closest('.internal-link');
                            if (!target) return false;

                            const href = target.getAttribute('href');

                            if (href && extension.options.app) {
                                event.preventDefault();
                                event.stopPropagation();

                                const sourcePath = extension.options.getFilePath ? extension.options.getFilePath() : '';
                                const isMod = navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? event.metaKey : event.ctrlKey;
                                const isAlt = event.altKey;

                                if (isMod && isAlt) {
                                    // Cmd/Ctrl + Opt/Alt + Click -> Split Leaf
                                    extension.options.app.workspace.openLinkText(href, sourcePath, 'split');
                                } else if (isMod) {
                                    // Cmd/Ctrl + Click -> New Tab
                                    extension.options.app.workspace.openLinkText(href, sourcePath, 'tab');
                                } else {
                                    // Click -> Active Leaf
                                    extension.options.app.workspace.openLinkText(href, sourcePath, false);
                                }
                                return true;
                            }
                            return false;
                        }
                    },
                    handleTextInput(view, from, to, text) {
                        if (text === '[' && extension.options.app) {
                            // Check previous character
                            const prevChar = view.state.doc.textBetween(from - 1, from);
                            if (prevChar === '[') {
                                // We have '[['
                                // Trigger Modal
                                // We need to pass the range of '[['
                                const range = { from: from - 1, to: to + 1 }; // -1 for prev [, +1 for current [ (which is being inserted)
                                // Wait, handleTextInput is called BEFORE insertion?
                                // "Called when the user types text... before the text is applied."
                                // So 'from' is where the new char will be.
                                // If we return true, we suppress insertion.
                                // We want insertion to happen, THEN trigger?
                                // Or trigger and handle insertion ourselves?

                                // Let's let it insert, then trigger.
                                setTimeout(() => {
                                    const modal = new LinkSuggestModal(extension.options.app, extension.editor, { from: from - 1, to: from + 1 });
                                    modal.open();
                                }, 0);
                            }
                        }
                        return false;
                    }
                },
            }),
        ]
    },
});

module.exports = Wikilink;
