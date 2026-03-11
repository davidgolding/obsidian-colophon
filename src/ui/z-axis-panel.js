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
        
        // 1. Initial state check
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

        // 2. Identify current focused editor to protect it
        let focusedId = null;
        for (const [id, editor] of this.editors) {
            if (editor.isFocused) {
                focusedId = id;
                break;
            }
        }

        // 3. Remove orphaned items
        const activeIds = new Set(footnotes.map(f => f.id));
        for (const [id, editor] of this.editors) {
            if (!activeIds.has(id)) {
                editor.destroy();
                this.editors.delete(id);
                const itemEl = listEl.querySelector(`[data-footnote-id="${id}"]`);
                if (itemEl) itemEl.remove();
            }
        }

        // 4. Update or Create items
        footnotes.forEach((fn) => {
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
                if (markerEl && markerEl.getText() !== `${fn.number}.`) {
                    markerEl.setText(`${fn.number}.`);
                }
                
                // IMPORTANT: If this item is focused, DO NOT touch its editor content.
                // If not focused, we could potentially update it if the main document 
                // changed (e.g. undo), but for simplicity and focus stability, we 
                // trust Tiptap's internal state unless the editor is missing.
                if (!this.editors.has(fn.id)) {
                    const editorContainer = itemEl.querySelector('.colophon-footnote-editor-container');
                    this.createMiniEditor(fn.id, fn.content, editorContainer);
                }
            }
        });

        // 5. Correct visual order
        const currentOrder = Array.from(listEl.children);
        footnotes.forEach((fn, index) => {
            const expectedEl = listEl.querySelector(`[data-footnote-id="${fn.id}"]`);
            if (expectedEl && listEl.children[index] !== expectedEl) {
                listEl.insertBefore(expectedEl, listEl.children[index]);
            }
        });
    }

    createMiniEditor(id, content, element) {
        // Use the shared extensions from the main adapter to ensure schema parity and no warnings
        const extensions = this.view.adapter.sharedExtensions;
        const isSpellcheckEnabled = this.view.app.vault.getConfig('spellcheck');

        const editor = new Editor({
            element: element,
            app: this.view.app,
            plugin: this.view.plugin,
            extensions: extensions,
            content: content,
            onUpdate: ({ editor }) => {
                // Use colophon-sync meta or equivalent if we added it, 
                // or just trust the check in updateFootnote
                this.view.adapter.updateFootnote(id, editor.getJSON());
            },
            editorProps: {
                attributes: {
                    class: 'colophon-footnote-editor',
                    spellcheck: isSpellcheckEnabled ? 'true' : 'false',
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
