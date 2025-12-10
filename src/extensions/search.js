const { Extension } = require('@tiptap/core');
const { Decoration, DecorationSet } = require('prosemirror-view');
const { Plugin, PluginKey } = require('prosemirror-state');

const Search = Extension.create({
    name: 'search',

    addOptions() {
        return {
            searchResultClass: 'colophon-search-match',
            searchResultCurrentClass: 'colophon-search-match-active',
            caseSensitive: false,
        };
    },

    addStorage() {
        return {
            searchTerm: '',
            results: [],
            currentIndex: -1,
        };
    },

    addCommands() {
        return {
            setSearchTerm: (searchTerm) => ({ editor, tr, dispatch }) => {
                this.storage.searchTerm = searchTerm;
                this.storage.currentIndex = -1;
                this.storage.results = []; // Will be repopulated by plugin

                if (dispatch) {
                    tr.setMeta('search', { searchTerm });
                }
                return true;
            },

            clearSearch: () => ({ editor, tr, dispatch }) => {
                this.storage.searchTerm = '';
                this.storage.results = [];
                this.storage.currentIndex = -1;

                if (dispatch) {
                    tr.setMeta('search', { searchTerm: '' });
                }
                return true;
            },

            findNext: () => ({ editor, tr, dispatch }) => {
                if (this.storage.results.length === 0) return false;

                let nextIndex = this.storage.currentIndex + 1;
                if (nextIndex >= this.storage.results.length) nextIndex = 0;

                this.storage.currentIndex = nextIndex;

                if (dispatch) {
                    tr.setMeta('search', { type: 'navigate', index: nextIndex });
                    editor.commands.scrollToCurrentMatch();
                }

                return true;
            },

            findPrevious: () => ({ editor, tr, dispatch }) => {
                if (this.storage.results.length === 0) return false;

                let prevIndex = this.storage.currentIndex - 1;
                if (prevIndex < 0) prevIndex = this.storage.results.length - 1;

                this.storage.currentIndex = prevIndex;

                if (dispatch) {
                    tr.setMeta('search', { type: 'navigate', index: prevIndex });
                    editor.commands.scrollToCurrentMatch();
                }

                return true;
            },

            scrollToCurrentMatch: () => ({ editor, view }) => {
                const { results, currentIndex } = this.storage;
                if (currentIndex >= 0 && currentIndex < results.length) {
                    const result = results[currentIndex];
                    // We can just scroll to the position
                    // We don't necessarily want to move the selection/cursor
                    // but standard Find usually does specific highlighting.
                    // ProseMirror scrollIntoView needs a pos or a separate command.

                    // Simple approach: create a dummy selection or just use window scroll?
                    // Better: Editor view scroll

                    // Note: view.dispatch with scrollIntoView does it for SELECTION.
                    // We can manually scroll the dom element of the decoration.
                    // But decorations are created by the plugin.

                    // We can set a flag and handle it in plugin's view update/transaction?
                    // Actually, if we just run a transaction that does nothing but has 'scrollIntoView', it might not work
                    // unless selection is there.

                    // Let's rely on logic in the plugin or view to find the DOM node.
                    // Or we can cheat and set a temporary TextSelection?
                    // Users might not want to lose their cursor place?
                    // Browser "Find" does NOT move the caret usually, just scrolls viewport.

                    // We will implement `scrollToMatch` logic in `addProseMirrorPlugins` view methods or here using DOM.
                    // However, we need to wait for the decoration to be rendered.

                    // Use a slight timeout to ensure DOM is ready?
                    setTimeout(() => {
                        const dom = view.dom.querySelector(`.${this.options.searchResultCurrentClass}`);
                        if (dom) {
                            dom.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    }, 50);

                    return true;
                }
                return false;
            }
        };
    },

    addKeyboardShortcuts() {
        return {
            'Mod-g': () => this.editor.commands.findNext(),
            'Shift-Mod-g': () => this.editor.commands.findPrevious(),
            'Mod-f': () => {
                // We don't need to do anything as the view handles opening,
                // but capturing it here prevents native find if focused.
                // We can try to dispatch a custom event or rely on the global command.
                // Since our global command works, we can just return true to stop propagation?
                // Actually we want to open the search panel.
                // The global command `editor:open-search` is patched.
                // But if the editor is focused, Tiptap might catch Mod-f before Obsidian keymap?
                // If we return false, it bubbles.
                return false;
            }
        };
    },

    addProseMirrorPlugins() {
        const { searchResultClass, searchResultCurrentClass } = this.options;
        const extension = this;

        return [
            new Plugin({
                key: new PluginKey('search'),
                state: {
                    init() {
                        return DecorationSet.empty;
                    },
                    apply(tr, oldSet, oldState, newState) {
                        const meta = tr.getMeta('search');
                        const docChanged = tr.docChanged;

                        // If just navigating, we only need to update the classes (recreate decorations)
                        // If search term changed, fully recompute.
                        // If doc changed, recompute (mapping old set isn't enough if text inserted matches).

                        const searchTerm = extension.storage.searchTerm;

                        if (!searchTerm) {
                            extension.storage.results = [];
                            return DecorationSet.empty;
                        }

                        if (meta || docChanged) {
                            // Recompute all matches
                            // This can be expensive on huge docs, but usually fine for typical manuscripts.
                            // Optimized: regex search

                            const { caseSensitive } = extension.options;
                            const regex = new RegExp(searchTerm.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), caseSensitive ? 'g' : 'gi');

                            const decorations = [];
                            const results = [];

                            newState.doc.descendants((node, pos) => {
                                if (node.isText) {
                                    const text = node.text;
                                    let match;
                                    while ((match = regex.exec(text)) !== null) {
                                        const from = pos + match.index;
                                        const to = from + match[0].length;
                                        results.push({ from, to });
                                    }
                                }
                            });

                            extension.storage.results = results;
                            // Ensure currentIndex is valid
                            if (extension.storage.currentIndex >= results.length) {
                                extension.storage.currentIndex = -1;
                            }

                            // Build decorations
                            results.forEach((res, index) => {
                                const isCurrent = index === extension.storage.currentIndex;
                                const className = isCurrent ? `${searchResultClass} ${searchResultCurrentClass}` : searchResultClass;

                                decorations.push(
                                    Decoration.inline(res.from, res.to, { class: className })
                                );
                            });

                            return DecorationSet.create(newState.doc, decorations);
                        }

                        return oldSet.map(tr.mapping, newState.doc);
                    }
                },
                props: {
                    decorations(state) {
                        return this.getState(state);
                    }
                }
            })
        ];
    }
});

module.exports = Search;
