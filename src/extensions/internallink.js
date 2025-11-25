const { Mark, InputRule, mergeAttributes } = require('@tiptap/core');
const { Plugin, PluginKey } = require('@tiptap/pm/state');
const LinkSuggestModal = require('../link-suggest-modal');

const InternalLink = Mark.create({
    name: 'internallink',

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
        return ['a', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
    },

    addInputRules() {
        return [
            new InputRule({
                find: /\[\[([^|\]]+)(?:\|([^\]]+))?\]\]$/,
                handler: ({ state, range, match }) => {
                    const { tr } = state;
                    const start = range.from;
                    const end = range.to;
                    const href = match[1];
                    const alias = match[2];
                    const text = alias || href;

                    tr.replaceWith(start, end, state.schema.text(text, [
                        state.schema.marks.internallink.create({ href, text: alias })
                    ]));

                    return tr;
                },
            }),
        ]
    },

    addProseMirrorPlugins() {
        const extension = this;
        const editor = extension.editor;

        // Find the range of a mark at a given position
        const findMarkRange = ($pos, markType) => {
            const mark = $pos.marks().find(m => m.type === markType);
            if (!mark) return null;

            let from = $pos.pos, to = $pos.pos;
            let startIndex = $pos.index();
            
            // Scan backward
            for (let i = startIndex; i >= 0; i--) {
                const node = $pos.parent.child(i);
                if (mark.isInSet(node.marks)) {
                    from = $pos.start() + node.content.findIndex(node).offset;
                } else {
                    break;
                }
            }

            // Scan forward
            for (let i = startIndex; i < $pos.parent.childCount; i++) {
                const node = $pos.parent.child(i);
                if (mark.isInSet(node.marks)) {
                    to = $pos.start() + node.content.findIndex(node).offset + node.nodeSize;
                } else {
                    break;
                }
            }
            
            return { from, to, mark };
        };

        const livePreviewPlugin = new Plugin({
            key: new PluginKey('internallink-live-preview'),
            state: {
                init() {
                    return { activeLink: null }; // { from, to, text }
                },
                apply(tr, value, oldState, newState) {
                    const { selection } = tr;
                    const oldActiveLink = value.activeLink;
                    let activeLink = null;

                    if (oldActiveLink) {
                        const { from, to } = oldActiveLink;
                        const mappedFrom = tr.mapping.map(from);
                        const mappedTo = tr.mapping.map(to);

                        if (selection.from >= mappedFrom && selection.to <= mappedTo) {
                            activeLink = { from: mappedFrom, to: mappedTo, text: newState.doc.textBetween(mappedFrom, mappedTo) };
                        }
                    }
                    
                    if (selection.empty) {
                        const markRange = findMarkRange(selection.$from, newState.schema.marks.internallink);
                        if (markRange) {
                            const { from, to, mark } = markRange;
                            const alias = mark.attrs.text;
                            const text = alias ? `[[${mark.attrs.href}|${alias}]]` : `[[${mark.attrs.href}]]`;
                            activeLink = { from, to, text, mark };
                        }
                    }

                    if (JSON.stringify(activeLink) === JSON.stringify(oldActiveLink)) {
                        return value;
                    }
                    
                    return { activeLink };
                }
            },
            view(editorView) {
                return {
                    update: (view, prevState) => {
                        const pluginState = this.key.getState(view.state);
                        const prevPluginState = this.key.getState(prevState);

                        if (pluginState.activeLink && !prevPluginState.activeLink) {
                            // ENTERING link
                            const { from, to, text } = pluginState.activeLink;
                            view.dispatch(
                                view.state.tr
                                    .removeMark(from, to)
                                    .replaceWith(from, to, view.state.schema.text(text))
                                    .setMeta('addToHistory', false)
                            );
                        } else if (!pluginState.activeLink && prevPluginState.activeLink) {
                            // LEAVING link
                            const { from, to } = prevPluginState.activeLink;
                            const text = prevState.doc.textBetween(from, to);
                            const match = text.match(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/);

                            const tr = view.state.tr;
                            
                            if (match) {
                                const href = match[1];
                                const alias = match[2];
                                const linkText = alias || href;
                                tr.replaceWith(from, to, view.state.schema.text(linkText, [
                                    view.state.schema.marks.internallink.create({ href, text: alias })
                                ]));
                            } else {
                                // No longer a valid link, just leave the text
                                // No transaction needed as the text is already there.
                            }

                            if (tr.docChanged) {
                                view.dispatch(tr);
                            }
                        }
                    }
                }
            }
        });

        // Plugin for the '[[...]]' suggestion modal
        const suggestionPlugin = new Plugin({
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
                handleTextInput(view, from, to, text) {
                    if (text === '[' && extension.options.app) {
                        const prevChar = view.state.doc.textBetween(from - 1, from);
                        if (prevChar === '[') {
                            setTimeout(() => {
                                const modal = new LinkSuggestModal(extension.options.app, extension.editor, { from: from - 1, to: from + 1 });
                                modal.open();
                            }, 0);
                        }
                    }
                    return false;
                }
            },
        });

        return [suggestionPlugin, livePreviewPlugin];
    },
});

module.exports = InternalLink;