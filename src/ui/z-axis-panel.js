import { setIcon } from 'obsidian';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { generateExtensions } from '../extensions/universal-block';
import { Substitutions } from '../extensions/substitutions';
import { InternalLink } from '../extensions/internal-link';
import { TiptapLinkSuggest } from './tiptap-link-suggest';

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

        // Track active IDs
        const activeIds = new Set(footnotes.map(f => f.id));

        // 1. Cleanup old editors/elements
        for (const [id, editor] of this.editors) {
            if (!activeIds.has(id)) {
                editor.destroy();
                this.editors.delete(id);
                const itemEl = listEl.querySelector(`[data-footnote-id="${id}"]`);
                if (itemEl) itemEl.remove();
            }
        }

        // 2. Sync existing or create new
        footnotes.forEach((fn, index) => {
            let itemEl = listEl.querySelector(`[data-footnote-id="${fn.id}"]`);
            
            if (!itemEl) {
                // CREATE
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
                // UPDATE SEQUENCE
                const markerEl = itemEl.querySelector('.colophon-footnote-number');
                if (markerEl && markerEl.getText() !== `${fn.number}.`) {
                    markerEl.setText(`${fn.number}.`);
                }
                
                // DATA SYNC (Canvas -> Sidebar)
                // Only if NOT focused and content actually differs
                const editor = this.editors.get(fn.id);
                if (editor && !editor.isFocused) {
                    const currentJSON = JSON.stringify(editor.getJSON());
                    const incomingJSON = JSON.stringify(fn.content);
                    if (currentJSON !== incomingJSON) {
                        editor.commands.setContent(fn.content, false);
                    }
                }
            }
        });

        // 3. Re-order DOM to match sequence
        footnotes.forEach((fn, index) => {
            const el = listEl.querySelector(`[data-footnote-id="${fn.id}"]`);
            if (el && listEl.children[index] !== el) {
                listEl.insertBefore(el, listEl.children[index]);
            }
        });
    }

    createMiniEditor(id, content, element) {
        // Use shared extensions from main adapter
        const extensions = this.view.adapter.sharedExtensions;
        const isSpellcheckEnabled = this.view.app.vault.getConfig('spellcheck');

        const editor = new Editor({
            element: element,
            app: this.view.app,
            plugin: this.view.plugin,
            extensions: extensions,
            content: content,
            onUpdate: ({ editor }) => {
                // Push change to adapter
                this.view.adapter.updateFootnote(id, editor.getJSON());
            },
            onSelectionUpdate: ({ editor }) => {
                this.view.updateActiveEditor(editor);
            },
            onFocus: ({ editor }) => {
                this.view.updateActiveEditor(editor);
            },
            editorProps: {
                attributes: {
                    class: 'colophon-footnote-editor footnote',
                    spellcheck: isSpellcheckEnabled ? 'true' : 'false',
                }
            }
        });

        this.editors.set(id, editor);

        // Add internal link suggestions to footnote editor
        if (this.view.app && this.view.plugin) {
            new TiptapLinkSuggest(this.view.app, this.view.plugin, editor);
        }
    }

    renderComments() {
        this.contentEl.empty();
        this.contentEl.createDiv({ text: 'Comments coming soon...' });
    }

    show(tab = 'footnotes', callback = null) {
        this.activeTab = tab;
        this.isVisible = true;
        this.containerEl.addClass('is-visible');
        this.titleEl.setText(tab === 'footnotes' ? 'Footnotes' : 'Comments');
        this.update();
        
        if (callback) {
            // Use requestAnimationFrame to ensure DOM is ready
            requestAnimationFrame(() => callback());
        }
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
    }

    destroy() {
        this.cleanupEditors();
        if (this.containerEl) {
            this.containerEl.remove();
        }
    }
}
