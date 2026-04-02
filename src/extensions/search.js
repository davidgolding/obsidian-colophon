import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const performSearch = (state, extension) => {
    const { query } = extension.storage;
    const { caseSensitive, disableRegex, wholeWord } = extension.options;
    const results = [];

    if (!query) {
        extension.storage.results = [];
        extension.storage.activeIndex = -1;
        return results;
    }

    let regex;
    try {
        if (disableRegex) {
            let escaped = query.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
            if (wholeWord) escaped = `\\b${escaped}\\b`;
            regex = new RegExp(escaped, caseSensitive ? 'g' : 'gi');
        } else {
            regex = new RegExp(query, caseSensitive ? 'g' : 'gi');
        }
    } catch (e) {
        extension.storage.results = [];
        extension.storage.activeIndex = -1;
        return results;
    }

    state.doc.descendants((node, pos) => {
        if (node.isText) {
            const text = node.text;
            let match;
            while ((match = regex.exec(text)) !== null) {
                results.push({
                    from: pos + match.index,
                    to: pos + match.index + match[0].length,
                });
            }
        }
    });

    extension.storage.results = results;
    
    if (results.length === 0) {
        extension.storage.activeIndex = -1;
    } else if (extension.storage.activeIndex === -1) {
        extension.storage.activeIndex = 0;
    } else if (extension.storage.activeIndex >= results.length) {
        extension.storage.activeIndex = 0;
    }

    return results;
};

const focusActiveResult = (editor, extension) => {
    if (editor.isDestroyed) return;
    const { activeIndex, results } = extension.storage;
    if (activeIndex === -1 || results.length === 0) return;

    const { from, to } = results[activeIndex];
    editor.commands.setTextSelection({ from, to });
    editor.commands.scrollIntoView();
};

export const Search = Extension.create({
    name: 'search',

    addOptions() {
        return {
            searchResultClass: 'colophon-search-result',
            activeSearchResultClass: 'colophon-search-result-active',
            caseSensitive: false,
            disableRegex: true,
            wholeWord: false,
        };
    },

    addStorage() {
        return {
            query: '',
            results: [],
            activeIndex: -1,
        };
    },

    addCommands() {
        return {
            setSearchQuery: (query) => ({ state, dispatch }) => {
                this.storage.query = query;
                performSearch(state, this);
                if (dispatch) {
                    dispatch(state.tr.setMeta('search-update', true));
                }
                return true;
            },
            setSearchOptions: (options) => ({ state, dispatch }) => {
                Object.assign(this.options, options);
                performSearch(state, this);
                if (dispatch) {
                    dispatch(state.tr.setMeta('search-update', true));
                }
                return true;
            },
            nextSearchResult: () => ({ editor, state, dispatch }) => {
                if (this.storage.results.length === 0) return false;
                this.storage.activeIndex = (this.storage.activeIndex + 1) % this.storage.results.length;
                
                if (dispatch) {
                    dispatch(state.tr.setMeta('search-update', true));
                    setTimeout(() => focusActiveResult(editor, this), 0);
                }
                return true;
            },
            previousSearchResult: () => ({ editor, state, dispatch }) => {
                if (this.storage.results.length === 0) return false;
                this.storage.activeIndex = (this.storage.activeIndex - 1 + this.storage.results.length) % this.storage.results.length;
                
                if (dispatch) {
                    dispatch(state.tr.setMeta('search-update', true));
                    setTimeout(() => focusActiveResult(editor, this), 0);
                }
                return true;
            },
            replace: (replaceWith) => ({ state, dispatch }) => {
                const { activeIndex, results } = this.storage;
                if (activeIndex === -1 || results.length === 0) return false;

                const { from, to } = results[activeIndex];
                
                if (dispatch) {
                    dispatch(state.tr.replaceWith(from, to, state.schema.text(replaceWith)));
                }
                return true;
            },
            replaceAll: (replaceWith) => ({ state, dispatch }) => {
                const { results } = this.storage;
                if (results.length === 0) return false;

                if (dispatch) {
                    let tr = state.tr;
                    [...results].reverse().forEach(({ from, to }) => {
                        tr = tr.replaceWith(from, to, state.schema.text(replaceWith));
                    });
                    dispatch(tr);
                }
                return true;
            },
        };
    },

    onUpdate({ editor, transaction }) {
        if (transaction && transaction.getMeta('search-update')) {
            return;
        }
        if (transaction && (transaction.docChanged || transaction.getMeta('search-options-changed'))) {
            setTimeout(() => {
                if (editor.isDestroyed) return;
                performSearch(editor.state, this);
                editor.view.dispatch(editor.state.tr.setMeta('search-update', true));
            }, 0);
        }
    },

    addKeyboardShortcuts() {
        return {
            'Mod-f': () => {
                const view = this.editor.options.adapter?.view;
                if (view && view.findReplaceBar) {
                    view.findReplaceBar.open();
                    return true;
                }
                return false;
            },
            'Mod-Alt-f': () => {
                const view = this.editor.options.adapter?.view;
                if (view && view.findReplaceBar) {
                    view.findReplaceBar.openReplace();
                    return true;
                }
                return false;
            },
            'Mod-g': () => {
                return this.editor.commands.nextSearchResult();
            },
            'Mod-Shift-g': () => {
                return this.editor.commands.previousSearchResult();
            },
        };
    },

    addProseMirrorPlugins() {
        const extension = this;
        return [
            new Plugin({
                key: new PluginKey('search'),
                props: {
                    decorations(state) {
                        const { results, activeIndex } = extension.storage;
                        const decorations = results.map((result, index) => {
                            const className = index === activeIndex 
                                ? `${extension.options.searchResultClass} ${extension.options.activeSearchResultClass}`
                                : extension.options.searchResultClass;
                            
                            return Decoration.inline(result.from, result.to, { class: className });
                        });

                        return DecorationSet.create(state.doc, decorations);
                    },
                },
            }),
        ];
    },
});
