import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

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
            setSearchQuery: (query) => ({ editor, storage }) => {
                storage.query = query;
                this.updateSearch(editor);
                return true;
            },
            setSearchOptions: (options) => ({ editor, options: currentOptions }) => {
                Object.assign(currentOptions, options);
                this.updateSearch(editor);
                return true;
            },
            nextSearchResult: () => ({ editor, storage }) => {
                if (storage.results.length === 0) return false;
                storage.activeIndex = (storage.activeIndex + 1) % storage.results.length;
                this.focusActiveResult(editor);
                return true;
            },
            previousSearchResult: () => ({ editor, storage }) => {
                if (storage.results.length === 0) return false;
                storage.activeIndex = (storage.activeIndex - 1 + storage.results.length) % storage.results.length;
                this.focusActiveResult(editor);
                return true;
            },
            replace: (replaceWith) => ({ editor, storage }) => {
                const { activeIndex, results } = storage;
                if (activeIndex === -1 || results.length === 0) return false;

                const { from, to } = results[activeIndex];
                editor.chain().focus().insertContentAt({ from, to }, replaceWith).run();
                
                // Re-search to update positions
                this.updateSearch(editor);
                return true;
            },
            replaceAll: (replaceWith) => ({ editor, storage }) => {
                const { results } = storage;
                if (results.length === 0) return false;

                let chain = editor.chain().focus();
                // Replace from end to beginning to keep positions stable
                [...results].reverse().forEach(({ from, to }) => {
                    chain = chain.insertContentAt({ from, to }, replaceWith);
                });
                
                chain.run();
                this.updateSearch(editor);
                return true;
            },
        };
    },

    updateSearch(editor) {
        const { query } = this.storage;
        const { caseSensitive, disableRegex, wholeWord } = this.options;
        const results = [];

        if (!query) {
            this.storage.results = [];
            this.storage.activeIndex = -1;
            editor.view.dispatch(editor.state.tr);
            return;
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
            // Invalid regex, clear results
            this.storage.results = [];
            this.storage.activeIndex = -1;
            editor.view.dispatch(editor.state.tr);
            return;
        }

        const { doc } = editor.state;
        doc.descendants((node, pos) => {
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

        this.storage.results = results;
        if (results.length > 0 && this.storage.activeIndex === -1) {
            this.storage.activeIndex = 0;
        } else if (results.length === 0) {
            this.storage.activeIndex = -1;
        } else if (this.storage.activeIndex >= results.length) {
            this.storage.activeIndex = results.length - 1;
        }

        editor.view.dispatch(editor.state.tr);
    },

    focusActiveResult(editor) {
        const { activeIndex, results } = this.storage;
        if (activeIndex === -1 || results.length === 0) return;

        const { from } = results[activeIndex];
        editor.commands.setTextSelection(from);
        editor.commands.scrollIntoView();
        editor.view.dispatch(editor.state.tr);
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
