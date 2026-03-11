import { EditorSuggest, TFile } from 'obsidian';

export class LinkSuggest extends EditorSuggest {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }

    onTrigger(cursor, editor, file) {
        // We only trigger inside Colophon files
        if (file.extension !== 'colophon') return null;

        const line = editor.getLine(cursor.line);
        const sub = line.substring(0, cursor.ch);

        // Check for Wikilink trigger [[
        const wikiMatch = sub.match(/\[\[([^\]]*)$/);
        if (wikiMatch) {
            return {
                start: { line: cursor.line, ch: sub.lastIndexOf('[[') },
                end: cursor,
                query: wikiMatch[1]
            };
        }

        // Check for Markdown link trigger [ (only if enabled)
        const useMarkdownLinks = this.app.vault.getConfig('useMarkdownLinks');
        if (useMarkdownLinks) {
            const mdMatch = sub.match(/\[([^\]]*)$/);
            if (mdMatch) {
                // Ensure we aren't inside a completed link [text](url)
                const rest = line.substring(cursor.ch);
                if (rest.startsWith('](')) return null;

                return {
                    start: { line: cursor.line, ch: sub.lastIndexOf('[') },
                    end: cursor,
                    query: mdMatch[1]
                };
            }
        }

        return null;
    }

    getSuggestions(context) {
        const query = context.query.toLowerCase();
        const files = this.app.vault.getFiles();
        
        // Filter based on "Show all file types" setting if needed
        const showUnsupported = this.app.vault.getConfig('showUnsupportedFiles');

        return files
            .filter(file => {
                if (!showUnsupported && !['md', 'colophon', 'canvas'].includes(file.extension)) {
                    return false;
                }
                return file.path.toLowerCase().includes(query) || file.basename.toLowerCase().includes(query);
            })
            .sort((a, b) => a.basename.localeCompare(b.basename))
            .slice(0, 100);
    }

    renderSuggestion(file, el) {
        el.createEl('div', { text: file.basename, cls: 'suggestion-title' });
        el.createEl('small', { text: file.path, cls: 'suggestion-content' });
    }

    selectSuggestion(file, evt) {
        const { start, end } = this.context;
        const useMarkdownLinks = this.app.vault.getConfig('useMarkdownLinks');
        
        // Use relative path or absolute based on Obsidian settings
        const linkPath = this.app.metadataCache.fileToLinktext(file, this.context.file.path);
        
        let replacement = '';
        if (useMarkdownLinks) {
            replacement = `[${file.basename}](${linkPath})`;
        } else {
            replacement = `[[${linkPath}]]`;
        }

        this.context.editor.replaceRange(replacement, start, end);
    }
}
