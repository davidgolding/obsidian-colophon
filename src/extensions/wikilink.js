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



    addAttributes() {
        return {
            href: {
                default: null,
            },
            text: {
                default: null,
            },
        }
    },

    renderHTML({ HTMLAttributes }) {
        // If we have an alias (text attribute), we want to render that text content?
        // Marks wrap text. We can't easily change the text content of the mark from here without being a Node.
        // BUT, for Wikilinks, the text inside the editor IS the link text.
        // If we type [[Note|Alias]], we want the editor to show "Alias".
        // This means we need to replace the whole [[...]] with just "Alias" and apply the mark.
        // So the mark itself doesn't need to render text, the InputRule needs to insert the alias as text.

        return ['a', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
    },

    addInputRules() {
        return [
            new InputRule({
                // Match [[Note]] or [[Note|Alias]]
                // Group 1: Note (href)
                // Group 2: Alias (optional)
                find: /\[\[([^|\]]+)(?:\|([^\]]+))?\]\]$/,
                handler: ({ state, range, match }) => {
                    const { tr } = state;
                    const start = range.from;
                    const end = range.to;
                    const href = match[1];
                    const alias = match[2];
                    const text = alias || href; // Display text is alias if present, else href

                    tr.replaceWith(start, end, state.schema.text(text, [
                        state.schema.marks.wikilink.create({ href, text: alias }) // Store alias in attrs just in case
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
