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

        this.render();
    }

    render() {
        this.containerEl = this.parentEl.createDiv({ cls: 'colophon-z-axis-panel' });
        
        // Header
        const header = this.containerEl.createDiv({ cls: 'colophon-panel-header' });
        
        // Use a more editorial title style
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
        this.contentEl.empty();

        if (footnotes.length === 0) {
            this.contentEl.createDiv({ 
                cls: 'colophon-panel-empty', 
                text: 'No footnotes in this document.' 
            });
            return;
        }

        const listEl = this.contentEl.createDiv({ cls: 'colophon-footnote-list' });

        footnotes.forEach(fn => {
            const itemEl = listEl.createDiv({ cls: 'colophon-footnote-item' });
            itemEl.dataset.footnoteId = fn.id;

            const markerEl = itemEl.createDiv({ 
                cls: 'colophon-footnote-number', 
                text: `${fn.number}.` 
            });
            
            // Navigation: Clicking number scrolls canvas to marker
            markerEl.onclick = () => {
                this.view.adapter.focusMarker(fn.id);
            };

            const editorContainer = itemEl.createDiv({ cls: 'colophon-footnote-editor-container' });
            
            // Initialize mini-editor
            this.createMiniEditor(fn.id, fn.content, editorContainer);
        });
    }

    createMiniEditor(id, content, element) {
        // Cleanup existing if any
        if (this.editors.has(id)) {
            this.editors.get(id).destroy();
        }

        // We MUST include the dynamic block extensions (like 'body', 'footnote')
        // so that Tiptap recognizes the node types in the content.
        const dynamicExtensions = this.view.plugin.settings ? generateExtensions(this.view.plugin.settings) : [];

        const editor = new Editor({
            element: element,
            // Pass app/plugin to options just like main editor
            app: this.view.app,
            plugin: this.view.plugin,
            extensions: [
                StarterKit.configure({
                    // Disable core nodes that we handle via universal-block or customize
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
                ...dynamicExtensions,
                Substitutions.configure({
                    smartQuotes: this.view.plugin.settings.smartQuotes,
                    smartDashes: this.view.plugin.settings.smartDashes,
                }),
                InternalLink
            ],
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
    }

    destroy() {
        this.cleanupEditors();
        if (this.containerEl) {
            this.containerEl.remove();
        }
    }
}
