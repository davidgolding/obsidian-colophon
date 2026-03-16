import { setIcon, debounce } from 'obsidian';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { generateExtensions } from '../extensions/universal-block';
import { Substitutions } from '../extensions/substitutions';
import { InternalLink } from '../extensions/internal-link';
import { TiptapLinkSuggest } from './tiptap-link-suggest';

/**
 * ZAxisPanel handles the rendering and editing of footnotes and comments.
 * It is decoupled from the main view and can be hosted locally within a leaf 
 * or globally in the Obsidian right sidebar.
 */
export class ZAxisPanel {
    constructor(app, plugin, provider, parentEl) {
        this.app = app;
        this.plugin = plugin;
        this.provider = provider;
        this.parentEl = parentEl;
        
        this.containerEl = null;
        this.isVisible = false;
        this.activeTab = 'footnotes'; // 'footnotes' | 'comments'
        this.editors = new Map(); // id -> Editor instance
        this.extensions = null; // Memoized extensions
        
        this.lastFootnotesJSON = null;

        // Debounce update to avoid excessive re-renders during typing
        this.update = debounce(this.refresh.bind(this), 250);

        this.render();
    }

    render() {
        this.containerEl = this.parentEl.createDiv({ cls: 'colophon-z-axis-panel' });
        
        // Content Area
        this.contentEl = this.containerEl.createDiv({ cls: 'colophon-panel-content' });
        
        this.refresh();
    }

    update() {
        // This is replaced by the debounced refresh in constructor
    }

    refresh() {
        if (!this.isVisible) return;
        
        if (this.activeTab === 'footnotes') {
            this.renderFootnotes();
        } else {
            this.renderComments();
        }
    }

    renderFootnotes() {
        const adapter = this.provider.getAdapter();
        if (!adapter) {
            this.cleanupEditors();
            this.contentEl.empty();
            this.contentEl.createDiv({ 
                cls: 'colophon-panel-empty', 
                text: 'The margins are quiet.' 
            });
            return;
        }
        
        const footnotes = adapter.getFootnotes();
        
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
            }
        }
        
        // Ensure ALL orphaned items are removed from DOM (including lazy-loaded previews)
        const allItems = listEl.querySelectorAll('.colophon-footnote-item');
        allItems.forEach(item => {
            const id = item.dataset.footnoteId;
            if (!activeIds.has(id)) {
                item.remove();
            }
        });

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
                    const adapter = this.provider.getAdapter();
                    if (adapter) adapter.focusMarker(fn.id);
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
        
        const adapter = this.provider.getAdapter();
        if (!adapter) return;

        // Use shared extensions from main adapter
        const extensions = adapter.sharedExtensions;
        const isSpellcheckEnabled = this.app.vault.getConfig('spellcheck');

        const editor = new Editor({
            element: element,
            app: this.app,
            plugin: this.plugin,
            extensions: extensions,
            content: content,
            onUpdate: ({ editor }) => {
                // Push change to adapter
                const adapter = this.provider.getAdapter();
                if (adapter) adapter.updateFootnote(id, editor.getJSON());
            },
            onSelectionUpdate: ({ editor }) => {
                this.provider.updateActiveEditor(editor);
            },
            onFocus: ({ editor }) => {
                this.provider.updateActiveEditor(editor);
            },
            onBlur: ({ editor }) => {
                // When focus is lost, we can choose to destroy the editor to save memory
                // or keep it alive. Given the "Lazy Load" requirement, destroying on blur
                // is the most aggressive memory optimization.
                
                // Save current content one last time
                const finalContent = editor.getJSON();
                const adapter = this.provider.getAdapter();
                if (adapter) adapter.updateFootnote(id, finalContent);
                
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
                handleKeyDown: (view, event) => {
                    // Shift+Tab to jump back to main editor marker
                    if (event.key === 'Tab' && event.shiftKey) {
                        event.preventDefault();
                        const adapter = this.provider.getAdapter();
                        if (adapter) adapter.focusMarker(id);
                        return true;
                    }
                    return false;
                },
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
        if (this.app && this.plugin) {
            new TiptapLinkSuggest(this.app, this.plugin, editor);
        }
    }

    focusEditor(id) {
        // Use a timeout to ensure DOM and Tiptap have settled and main editor has finished its cycle
        setTimeout(() => {
            let editor = this.editors.get(id);
            
            if (!editor) {
                // Find the element and create it (Lazy Load bypass)
                const itemEl = this.containerEl.querySelector(`[data-footnote-id="${id}"]`);
                if (itemEl) {
                    const container = itemEl.querySelector('.colophon-footnote-editor-container');
                    const adapter = this.provider.getAdapter();
                    const footnotes = adapter ? adapter.getFootnotes() : [];
                    const fn = footnotes.find(f => f.id === id);
                    if (fn && container) {
                        this.createMiniEditor(id, fn.content, container);
                        editor = this.editors.get(id);
                    }
                }
            }
            
            if (editor) {
                editor.commands.focus('end');
                const el = this.containerEl.querySelector(`[data-footnote-id="${id}"]`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 50);
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
        
        // Immediate sync update instead of debounced
        this.refresh();
        
        const toolbar = this.provider.getToolbar ? this.provider.getToolbar() : null;
        if (toolbar) {
            toolbar.update();
        }

        if (callback) {
            // Use requestAnimationFrame to ensure DOM is ready
            requestAnimationFrame(() => callback());
        }
    }

    hide() {
        this.isVisible = false;
        this.containerEl.removeClass('is-visible');
        
        const toolbar = this.provider.getToolbar ? this.provider.getToolbar() : null;
        if (toolbar) {
            toolbar.update();
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
