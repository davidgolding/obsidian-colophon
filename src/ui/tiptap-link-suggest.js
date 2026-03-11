import { TFile } from 'obsidian';

/**
 * TiptapLinkSuggest - A custom suggester for Tiptap that mimics Obsidian's native link suggest.
 * Since ColophonView uses Tiptap instead of a standard Obsidian Editor, we can't use 
 * the built-in EditorSuggest class directly.
 */
export class TiptapLinkSuggest {
    constructor(app, plugin, adapter) {
        this.app = app;
        this.plugin = plugin;
        this.adapter = adapter;
        this.editor = adapter.editor;
        
        this.suggestionEl = null;
        this.suggestions = [];
        this.selectedIndex = 0;
        this.context = null;

        this.setup();
    }

    setup() {
        this.editor.on('selectionUpdate', () => this.onUpdate());
        this.editor.on('update', () => this.onUpdate());
        
        // Key handling for suggestions
        this.editor.setOptions({
            editorProps: {
                handleKeyDown: (view, event) => {
                    if (this.suggestionEl) {
                        if (event.key === 'ArrowDown') {
                            this.moveSelection(1);
                            return true;
                        }
                        if (event.key === 'ArrowUp') {
                            this.moveSelection(-1);
                            return true;
                        }
                        if (event.key === 'Enter' || event.key === 'Tab') {
                            this.selectCurrent();
                            return true;
                        }
                        if (event.key === 'Escape') {
                            this.close();
                            return true;
                        }
                    }
                    return false;
                }
            }
        });
    }

    onUpdate() {
        const { state } = this.editor;
        const { selection } = state;
        const { $from } = selection;
        
        // Get text before cursor in current node
        const textBefore = $from.parent.textBetween(0, $from.parentOffset, null, '\0');
        
        // Wikilink check [[
        const wikiMatch = textBefore.match(/\[\[([^\]]*)$/);
        if (wikiMatch) {
            this.showSuggestions(wikiMatch[1], $from.pos - wikiMatch[1].length - 2, $from.pos, 'wiki');
            return;
        }

        // Markdown link check [
        const useMarkdownLinks = this.app.vault.getConfig('useMarkdownLinks');
        if (useMarkdownLinks) {
            const mdMatch = textBefore.match(/\[([^\]]*)$/);
            if (mdMatch) {
                this.showSuggestions(mdMatch[1], $from.pos - mdMatch[1].length - 1, $from.pos, 'md');
                return;
            }
        }

        this.close();
    }

    showSuggestions(query, start, end, type) {
        this.context = { query, start, end, type };
        const q = query.toLowerCase();
        
        const showUnsupported = this.app.vault.getConfig('showUnsupportedFiles');
        const files = this.app.vault.getFiles()
            .filter(file => {
                if (!showUnsupported && !['md', 'colophon', 'canvas'].includes(file.extension)) {
                    return false;
                }
                return file.path.toLowerCase().includes(q) || file.basename.toLowerCase().includes(q);
            })
            .sort((a, b) => a.basename.localeCompare(b.basename))
            .slice(0, 10);

        if (files.length === 0) {
            this.close();
            return;
        }

        this.suggestions = files;
        this.render();
    }

    render() {
        if (!this.suggestionEl) {
            this.suggestionEl = document.createElement('div');
            this.suggestionEl.className = 'suggestion-container colophon-link-suggestions';
            document.body.appendChild(this.suggestionEl);
        }

        const coords = this.editor.view.coordsAtPos(this.context.end);
        this.suggestionEl.style.position = 'fixed';
        this.suggestionEl.style.top = `${coords.bottom + 5}px`;
        this.suggestionEl.style.left = `${coords.left}px`;
        this.suggestionEl.style.display = 'block';

        this.suggestionEl.empty();
        const listEl = this.suggestionEl.createDiv({ cls: 'suggestion' });

        this.suggestions.forEach((file, i) => {
            const itemEl = listEl.createDiv({ 
                cls: `suggestion-item ${i === this.selectedIndex ? 'is-selected' : ''}` 
            });
            itemEl.createDiv({ text: file.basename, cls: 'suggestion-title' });
            itemEl.createDiv({ text: file.path, cls: 'suggestion-content' });
            
            itemEl.addEventListener('click', () => {
                this.selectedIndex = i;
                this.selectCurrent();
            });
        });
    }

    moveSelection(dir) {
        this.selectedIndex = (this.selectedIndex + dir + this.suggestions.length) % this.suggestions.length;
        this.render();
    }

    selectCurrent() {
        const file = this.suggestions[this.selectedIndex];
        if (!file) return;

        const { start, end, type } = this.context;
        const activeFile = this.app.workspace.getActiveFile();
        const linkPath = this.app.metadataCache.fileToLinktext(file, activeFile ? activeFile.path : '');
        
        let replacement = '';
        if (type === 'md') {
            replacement = `[${file.basename}](${linkPath})`;
        } else {
            replacement = `[[${linkPath}]]`;
        }

        this.editor.chain()
            .focus()
            .insertContentAt({ from: start, to: end }, replacement)
            .run();

        this.close();
    }

    close() {
        if (this.suggestionEl) {
            this.suggestionEl.remove();
            this.suggestionEl = null;
        }
        this.suggestions = [];
        this.selectedIndex = 0;
        this.context = null;
    }
}
