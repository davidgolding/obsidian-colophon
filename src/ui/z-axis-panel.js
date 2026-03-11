import { setIcon } from 'obsidian';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { generateExtensions } from '../extensions/universal-block';
import { Substitutions } from '../extensions/substitutions';
import { InternalLink } from '../extensions/internal-link';

export class ZAxisPanel {
    constructor(view, parentEl) {
        this.view = view;
        this.parentEl = parentEl;
        this.containerEl = null;
        this.isVisible = false;
        this.activeTab = 'footnotes'; // 'footnotes' | 'comments'
        this.editors = new Map(); // id -> Editor instance
        this.extensions = null; // Memoized extensions

        this.render();
    }

    render() {
        this.containerEl = this.parentEl.createDiv({ cls: 'colophon-z-axis-panel' });
        
        // Header
        const header = this.containerEl.createDiv({ cls: 'colophon-panel-header' });
        this.titleEl = header.createDiv({ cls: 'colophon-panel-title', text: 'Footnotes' });
        
        const closeBtn = header.createEl('button', { 
            cls: 'colophon-ui-btn colophon-icon-only colophon-panel-close',
            attr: { 'aria-label': 'Close Panel' }
        });
        setIcon(closeBtn, 'x');
        closeBtn.onclick = () => this.hide();

        // Content Area
        this.contentEl = this.containerEl.createDiv({ cls: 'colophon-panel-content' });
        
        this.update();
    }

    update() {
        if (!this.isVisible) return;
        
        if (this.activeTab === 'footnotes') {
            this.renderFootnotes();
        } else {
            this.renderComments();
        }
    }

    renderFootnotes() {
        if (!this.view.adapter) return;
        
        const footnotes = this.view.adapter.getFootnotes();
        
        // Check if we need to clear everything (e.g. document changed)
        if (footnotes.length === 0) {
            this.cleanupEditors();
            this.contentEl.empty();
            this.contentEl.createDiv({ 
                cls: 'colophon-panel-empty', 
                text: 'No footnotes in this document.' 
            });
            return;
        }

        // Ensure list container exists
        let listEl = this.contentEl.querySelector('.colophon-footnote-list');
        if (!listEl) {
            this.contentEl.empty();
            listEl = this.contentEl.createDiv({ cls: 'colophon-footnote-list' });
        }

        // Track current IDs to see what needs to be removed
        const activeIds = new Set(footnotes.map(f => f.id));

        // 1. Remove editors that no longer exist
        for (const [id, editor] of this.editors) {
            if (!activeIds.has(id)) {
                editor.destroy();
                this.editors.delete(id);
                const itemEl = listEl.querySelector(`[data-footnote-id="${id}"]`);
                if (itemEl) itemEl.remove();
            }
        }

        // 2. Add or update items
        footnotes.forEach((fn, index) => {
            let itemEl = listEl.querySelector(`[data-footnote-id="${fn.id}"]`);
            
            if (!itemEl) {
                // Create new item
                itemEl = listEl.createDiv({ cls: 'colophon-footnote-item' });
                itemEl.dataset.footnoteId = fn.id;

                const markerEl = itemEl.createDiv({ 
                    cls: 'colophon-footnote-number', 
                    text: `${fn.number}.` 
                });
                
                markerEl.onclick = () => {
                    this.view.adapter.focusMarker(fn.id);
                };

                const editorContainer = itemEl.createDiv({ cls: 'colophon-footnote-editor-container' });
                this.createMiniEditor(fn.id, fn.content, editorContainer);
            } else {
                // Update existing sequence number
                const markerEl = itemEl.querySelector('.colophon-footnote-number');
                if (markerEl) markerEl.setText(`${fn.number}.`);
                
                // Content synchronization logic:
                // We DON'T update the editor content here if the editor is focused,
                // because the editor is the source of truth during editing.
                const editor = this.editors.get(fn.id);
                if (editor && !editor.isFocused) {
                    // Only update if content changed externally (e.g. undo in main canvas)
                    // This check is a bit heavy, we might want to optimize it.
                    // For now, let's trust the Tiptap local state.
                }
            }
        });

        // 3. Ensure visual order matches sequence
        // (Iterate through footnotes and move elements to the end of listEl)
        footnotes.forEach(fn => {
            const itemEl = listEl.querySelector(`[data-footnote-id="${fn.id}"]`);
            if (itemEl) listEl.appendChild(itemEl);
        });
    }

    getExtensions() {
        if (this.extensions) return this.extensions;

        const dynamicBlocks = this.view.plugin.settings ? generateExtensions(this.view.plugin.settings) : [];
        
        this.extensions = [
            StarterKit.configure({
                paragraph: false,
                heading: false,
                codeBlock: false,
                blockquote: false,
                bulletList: false,
                orderedList: false,
                listItem: false,
                horizontalRule: false,
            }),
            Underline,
            ...dynamicBlocks,
            Substitutions.configure({
                smartQuotes: this.view.plugin.settings.smartQuotes,
                smartDashes: this.view.plugin.settings.smartDashes,
            }),
            InternalLink
        ];

        return this.extensions;
    }

    createMiniEditor(id, content, element) {
        const editor = new Editor({
            element: element,
            app: this.view.app,
            plugin: this.view.plugin,
            extensions: this.getExtensions(),
            content: content,
            onUpdate: ({ editor }) => {
                this.view.adapter.updateFootnote(id, editor.getJSON());
            },
            editorProps: {
                attributes: {
                    class: 'colophon-footnote-editor',
                }
            }
        });

        this.editors.set(id, editor);
    }

    renderComments() {
        this.contentEl.empty();
        this.contentEl.createDiv({ text: 'Comments coming soon...' });
    }

    show(tab = 'footnotes') {
        this.activeTab = tab;
        this.isVisible = true;
        this.containerEl.addClass('is-visible');
        this.titleEl.setText(tab === 'footnotes' ? 'Footnotes' : 'Comments');
        this.update();
    }

    hide() {
        this.isVisible = false;
        this.containerEl.removeClass('is-visible');
        this.cleanupEditors();
    }

    toggle(tab = 'footnotes') {
        if (this.isVisible && this.activeTab === tab) {
            this.hide();
        } else {
            this.show(tab);
        }
    }

    cleanupEditors() {
        this.editors.forEach(editor => editor.destroy());
        this.editors.clear();
        this.extensions = null; // Clear memoized extensions
    }

    destroy() {
        this.cleanupEditors();
        if (this.containerEl) {
            this.containerEl.remove();
        }
    }
}
