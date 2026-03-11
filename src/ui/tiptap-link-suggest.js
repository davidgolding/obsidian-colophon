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
        const { $from, empty } = selection;
        
        // Only trigger if selection is a simple cursor (empty)
        if (!empty) {
            this.close();
            return;
        }

        // Get text before cursor in current node
        const textBefore = $from.parent.textBetween(0, $from.parentOffset, null, '\0');
        
        // Tiptap textBetween with \0 returns a special character for atom nodes.
        // We only want to trigger if we are typing actual text.
        
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
                // Peek ahead to make sure we aren't in a completed link [text](url)
                const textAfter = $from.parent.textBetween($from.parentOffset, $from.parent.content.size, null, '\0');
                if (textAfter.startsWith('](')) {
                    this.close();
                    return;
                }

                this.showSuggestions(mdMatch[1], $from.pos - mdMatch[1].length - 1, $from.pos, 'md');
                return;
            }
        }

        this.close();
    }

    showSuggestions(query, start, end, type) {
        this.context = { query, start, end, type };
        
        // Split query into parts for "all parts must match" (any order)
        const queryParts = query.toLowerCase().split(/\s+/).filter(p => p.length > 0);
        
        const showUnsupported = this.app.vault.getConfig('showUnsupportedFiles');
        const files = this.app.vault.getFiles()
            .filter(file => {
                if (!showUnsupported && !['md', 'colophon', 'canvas'].includes(file.extension)) {
                    return false;
                }
                const path = file.path.toLowerCase();
                const name = file.basename.toLowerCase();
                
                // If no query, show all (limited)
                if (queryParts.length === 0) return true;
                
                // Every part of the query must match either path or name
                return queryParts.every(part => path.includes(part) || name.includes(part));
            })
            .sort((a, b) => {
                const q = query.toLowerCase();
                const aName = a.basename.toLowerCase();
                const bName = b.basename.toLowerCase();

                // 1. Exact name match
                if (aName === q && bName !== q) return -1;
                if (bName === q && aName !== q) return 1;

                // 2. Starts with match
                if (aName.startsWith(q) && !bName.startsWith(q)) return -1;
                if (bName.startsWith(q) && !aName.startsWith(q)) return 1;

                // 3. Alphabetical
                return aName.localeCompare(bName);
            })
            .slice(0, 50);

        if (files.length === 0 && queryParts.length > 0) {
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
        
        // Position relative to viewport
        this.suggestionEl.style.position = 'fixed';
        this.suggestionEl.style.top = `${coords.bottom + 5}px`;
        this.suggestionEl.style.left = `${coords.left}px`;
        this.suggestionEl.style.display = 'flex'; // Use flex for column layout

        this.suggestionEl.empty();
        
        // 1. Suggestions List
        const listEl = this.suggestionEl.createDiv({ cls: 'suggestion' });

        this.suggestions.forEach((file, i) => {
            const itemEl = listEl.createDiv({ 
                cls: `suggestion-item ${i === this.selectedIndex ? 'is-selected' : ''}` 
            });
            itemEl.createDiv({ text: file.basename, cls: 'suggestion-title' });
            itemEl.createDiv({ text: file.path, cls: 'suggestion-content' });
            
            itemEl.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.selectedIndex = i;
                this.selectCurrent();
            });
        });

        // 2. Instructions Footer (Always render)
        const footerEl = this.suggestionEl.createDiv({ cls: 'prompt-instructions' });
        
        const leftIns = footerEl.createDiv({ cls: 'prompt-instruction' });
        leftIns.innerHTML = '<span class="prompt-instruction-command">Type #</span> to link heading';
        
        const centerIns = footerEl.createDiv({ cls: 'prompt-instruction' });
        centerIns.innerHTML = '<span class="prompt-instruction-command">Type ^</span> to link blocks';
        
        const rightIns = footerEl.createDiv({ cls: 'prompt-instruction' });
        rightIns.innerHTML = '<span class="prompt-instruction-command">Type |</span> to change display text';

        // Flip position if it overflows bottom
        const rect = this.suggestionEl.getBoundingClientRect();
        if (rect.bottom > window.innerHeight) {
            this.suggestionEl.style.top = `${coords.top - rect.height - 5}px`;
        }
    }

    moveSelection(dir) {
        this.selectedIndex = (this.selectedIndex + dir + this.suggestions.length) % this.suggestions.length;
        this.render();
    }

    selectCurrent() {
        const file = this.suggestions[this.selectedIndex];
        if (!file) return;

        const { start, end } = this.context;
        const activeFile = this.app.workspace.getActiveFile();
        const linkPath = this.app.metadataCache.fileToLinktext(file, activeFile ? activeFile.path : '');
        
        // Insert the actual internalLink node instead of text
        this.editor.chain()
            .focus()
            .deleteRange({ from: start, to: end })
            .insertContent({
                type: 'internalLink',
                attrs: {
                    target: linkPath,
                    alias: file.basename !== linkPath ? file.basename : null
                }
            })
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
