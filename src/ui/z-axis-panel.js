import { setIcon, debounce } from 'obsidian';
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
        
        this.lastFootnotesJSON = null;

        // Debounce update to avoid excessive re-renders during typing
        this.update = debounce(this.update.bind(this), 250);

        this.render();
    }

    render() {
        this.containerEl = this.parentEl.createDiv({ cls: 'colophon-z-axis-panel' });
        
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
        
        // Performance optimization: Skip if data is unchanged
        const currentJSON = JSON.stringify(footnotes);
        if (this.lastFootnotesJSON === currentJSON) return;
        this.lastFootnotesJSON = currentJSON;
        
        if (footnotes.length === 0) {
            this.cleanupEditors();
            this.contentEl.empty();
            this.contentEl.createDiv({ 
                cls: 'colophon-panel-empty', 
                text: 'The margins are quiet.' 
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

        // 1. Cleanup old editors/elements/data
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
                // CREATE PREVIEW (Lazy Load)
                itemEl = listEl.createDiv({ cls: 'colophon-footnote-item' });
                itemEl.dataset.footnoteId = fn.id;

                const markerEl = itemEl.createDiv({ 
                    cls: 'colophon-footnote-number', 
                    text: `${fn.number}.` 
                });
                
                markerEl.onclick = (e) => {
                    e.stopPropagation();
                    this.view.adapter.focusMarker(fn.id);
                };

                const editorContainer = itemEl.createDiv({ cls: 'colophon-footnote-editor-container' });
                
                // Initial static preview
                this.renderPreview(fn.id, fn.content, editorContainer);

                // Initialize editor on click or focus
                editorContainer.onclick = () => {
                    if (!this.editors.has(fn.id)) {
                        this.createMiniEditor(fn.id, fn.content, editorContainer);
                    }
                };
            } else {
                // UPDATE SEQUENCE
                const markerEl = itemEl.querySelector('.colophon-footnote-number');
                if (markerEl && markerEl.getText() !== `${fn.number}.`) {
                    markerEl.setText(`${fn.number}.`);
                }
                
                // DATA SYNC (Canvas -> Sidebar)
                const editor = this.editors.get(fn.id);
                if (editor) {
                    // Update active editor if not focused
                    if (!editor.isFocused) {
                        const currentJSON = JSON.stringify(editor.getJSON());
                        const incomingJSON = JSON.stringify(fn.content);
                        if (currentJSON !== incomingJSON) {
                            editor.commands.setContent(fn.content, false);
                        }
                    }
                } else {
                    // Update preview if data changed
                    const editorContainer = itemEl.querySelector('.colophon-footnote-editor-container');
                    if (editorContainer) {
                        this.renderPreview(fn.id, fn.content, editorContainer);
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

    renderPreview(id, content, container) {
        // If an editor already exists, don't overwrite with a preview
        if (this.editors.has(id)) return;

        container.empty();
        const previewEl = container.createDiv({ cls: 'colophon-footnote-preview' });
        
        // Recursive renderer for Tiptap JSON to simple HTML
        const renderNode = (node, parentEl) => {
            if (node.type === 'text') {
                let el = parentEl;
                if (node.marks) {
                    node.marks.forEach(mark => {
                        let tag = 'span';
                        let cls = '';
                        
                        if (mark.type === 'bold') tag = 'strong';
                        else if (mark.type === 'italic') tag = 'em';
                        else if (mark.type === 'underline') tag = 'u';
                        else if (mark.type === 'strike') tag = 's';
                        else if (mark.type === 'superscript') tag = 'sup';
                        else if (mark.type === 'subscript') tag = 'sub';
                        else if (mark.type === 'smallCaps') cls = 'colophon-small-caps';
                        
                        const markEl = document.createElement(tag);
                        if (cls) markEl.className = cls;
                        el.appendChild(markEl);
                        el = markEl;
                    });
                }
                el.appendChild(document.createTextNode(node.text));
            } else if (node.type === 'internalLink') {
                const linkEl = parentEl.createSpan({ cls: 'colophon-internal-link' });
                const target = node.attrs?.target || '';
                const alias = node.attrs?.alias;
                linkEl.textContent = alias || target.split('/').pop().replace('.md', '').replace('.colophon', '');
                linkEl.title = `Click to open ${target}`;
            } else {
                let el = parentEl;
                if (node.type === 'paragraph' || node.type === 'body') {
                    el = parentEl.createEl('p', { cls: node.type });
                }
                
                if (node.content) {
                    node.content.forEach(child => renderNode(child, el));
                }
            }
        };
        
        if (content && content.content) {
            renderNode(content, previewEl);
        } else {
            previewEl.setText('Click to edit...');
        }
        
        // Add focusable attribute to allow Tab navigation
        previewEl.tabIndex = 0;
        previewEl.onfocus = () => {
            if (!this.editors.has(id)) {
                this.createMiniEditor(id, content, container);
            }
        };
    }

    createMiniEditor(id, content, element) {
        element.empty();
        
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
            onBlur: ({ editor }) => {
                // When focus is lost, we can choose to destroy the editor to save memory
                // or keep it alive. Given the "Lazy Load" requirement, destroying on blur
                // is the most aggressive memory optimization.
                
                // Save current content one last time
                const finalContent = editor.getJSON();
                this.view.adapter.updateFootnote(id, finalContent);
                
                // Destroy after a short delay to allow click events on toolbar to process if needed
                // or just destroy if it's a true blur
                setTimeout(() => {
                    if (!editor.isFocused && this.editors.has(id)) {
                        editor.destroy();
                        this.editors.delete(id);
                        this.renderPreview(id, finalContent, element);
                    }
                }, 150);
            },
            editorProps: {
                attributes: {
                    class: 'colophon-footnote-editor footnote',
                    spellcheck: isSpellcheckEnabled ? 'true' : 'false',
                }
            }
        });

        this.editors.set(id, editor);

        // Focus immediately
        editor.commands.focus('end');

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
        if (this.activeTab !== tab) {
            this.lastFootnotesJSON = null;
        }
        this.activeTab = tab;
        this.isVisible = true;
        this.containerEl.addClass('is-visible');
        this.update();
        
        if (this.view.toolbar) {
            this.view.toolbar.update();
        }

        if (callback) {
            // Use requestAnimationFrame to ensure DOM is ready
            requestAnimationFrame(() => callback());
        }
    }

    hide() {
        this.isVisible = false;
        this.containerEl.removeClass('is-visible');
        
        if (this.view.toolbar) {
            this.view.toolbar.update();
        }
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
