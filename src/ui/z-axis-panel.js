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
        this.focusTimer = null;
        this.blurTimers = new Map(); // id -> timer

        // Debounce update to avoid excessive re-renders during typing
        this.update = debounce(this.refresh.bind(this), 250);

        this.render();
    }

    render() {
        this.containerEl = this.parentEl.createDiv({ cls: 'colophon-z-axis-panel' });
        
        // Panel Switcher (only for global sidebar or if explicitly enabled)
        this.renderSwitcher();

        // Content Area
        this.contentEl = this.containerEl.createDiv({ cls: 'colophon-panel-content' });
        
        this.refresh();
    }

    renderSwitcher() {
        const isGlobal = this.parentEl.classList.contains('colophon-sidebar-view');
        if (!isGlobal) return;

        this.switcherEl = this.containerEl.createDiv({ cls: 'colophon-panel-switcher' });
        const group = this.switcherEl.createDiv({ cls: 'colophon-switcher-group' });

        this.fnSwitchBtn = group.createEl('button', { 
            cls: 'colophon-switcher-btn', 
            text: 'Footnotes' 
        });
        this.fnSwitchBtn.onclick = () => this.show('footnotes');

        this.cmSwitchBtn = group.createEl('button', { 
            cls: 'colophon-switcher-btn', 
            text: 'Comments' 
        });
        this.cmSwitchBtn.onclick = () => this.show('comments');
        
        this.updateSwitcher();
    }

    updateSwitcher() {
        if (!this.switcherEl) return;

        this.fnSwitchBtn.classList.toggle('colophon-active', this.activeTab === 'footnotes');
        this.cmSwitchBtn.classList.toggle('colophon-active', this.activeTab === 'comments');
    }

    update() {
        // This is replaced by the debounced refresh in constructor
    }

    refresh() {
        if (!this.isVisible) return;
        
        this.updateSwitcher();

        if (this.activeTab === 'footnotes') {
            this.renderFootnotes();
        } else {
            this.renderComments();
        }
    }

    focusComment(threadId) {
        if (this.focusTimer) {
            clearTimeout(this.focusTimer);
        }

        // Switch to comments tab first
        this.show('comments', () => {
            // Wait for render
            this.focusTimer = setTimeout(() => {
                const el = this.containerEl.querySelector(`[data-thread-id="${threadId}"]`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    const editorId = `${threadId}:0`;
                    let editor = this.editors.get(editorId);

                    if (!editor) {
                        const editorContainer = el.querySelector('.colophon-comment-editor-container');
                        const adapter = this.provider.getAdapter();
                        if (editorContainer && adapter && adapter.comments[threadId]) {
                            const thread = adapter.comments[threadId];
                            this.createCommentEditor(threadId, 0, thread[0], editorContainer);
                            editor = this.editors.get(editorId);
                        }
                    }

                    if (editor) {
                        editor.commands.focus('end');
                    }
                }
                this.focusTimer = null;
            }, 100);
        });
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
                this.renderPreview(fn.id, fn.content, editorContainer, () => {
                    this.createMiniEditor(fn.id, fn.content, editorContainer);
                });

                // Initialize editor on click
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
                        this.renderPreview(fn.id, fn.content, editorContainer, () => {
                            this.createMiniEditor(fn.id, fn.content, editorContainer);
                        });
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

    renderPreview(id, content, container, onFocus = null) {
        // If an editor already exists, don't overwrite with a preview
        if (this.editors.has(id)) return;

        container.empty();
        const isComment = id.startsWith('comment-');
        const previewClass = isComment ? 'colophon-comment-preview' : 'colophon-footnote-preview';
        const previewEl = container.createDiv({ cls: previewClass });
        
        // Recursive renderer for Tiptap JSON to simple HTML
        const renderNode = (node, parentEl) => {
            if (!node) return;
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
                if (onFocus) {
                    onFocus();
                } else {
                    this.createMiniEditor(id, content, container);
                }
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
                // Cancel pending blur
                if (this.blurTimers.has(id)) {
                    clearTimeout(this.blurTimers.get(id));
                    this.blurTimers.delete(id);
                }
                this.provider.updateActiveEditor(editor);
            },
            onBlur: ({ editor }) => {
                // Save current content one last time
                const finalContent = editor.getJSON();
                const adapter = this.provider.getAdapter();
                if (adapter) adapter.updateFootnote(id, finalContent);
                
                // Destroy after a short delay to allow click events on toolbar to process if needed
                // or just destroy if it's a true blur
                const timer = setTimeout(() => {
                    if (!editor.isFocused && this.editors.has(id)) {
                        // Clear active editor if it was this one
                        const adapter = this.provider.getAdapter();
                        const activeEditor = this.provider.getActiveEditor ? this.provider.getActiveEditor() : (adapter ? adapter.view.activeEditor : null);
                        if (activeEditor === editor) {
                            this.provider.updateActiveEditor(null);
                        }
                        
                        editor.destroy();
                        this.editors.delete(id);
                        this.renderPreview(id, finalContent, element);
                    }
                    this.blurTimers.delete(id);
                }, 150);
                
                this.blurTimers.set(id, timer);
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
        if (this.focusTimer) {
            clearTimeout(this.focusTimer);
        }
        
        // Use a timeout to ensure DOM and Tiptap have settled and main editor has finished its cycle
        this.focusTimer = setTimeout(() => {
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
            this.focusTimer = null;
        }, 50);
    }

    renderComments() {
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

        const comments = adapter.comments || {};

        // Filter and sort by appearance order in document
        const threads = [];
        adapter.editor.state.doc.descendants((node) => {
            if (node.marks) {
                node.marks.forEach(mark => {
                    if (mark.type.name === 'commentHighlight' && mark.attrs.threadId) {
                        const threadId = mark.attrs.threadId;
                        if (comments[threadId] && !threads.some(t => t.id === threadId)) {
                            threads.push({ id: threadId, data: comments[threadId] });
                        }
                    }
                });
            }
        });

        if (threads.length === 0) {
            this.cleanupEditors();
            this.contentEl.empty();
            this.contentEl.createDiv({ 
                cls: 'colophon-panel-empty', 
                text: 'No comments here yet.' 
            });
            return;
        }

        // Ensure list container exists
        let listEl = this.contentEl.querySelector('.colophon-comment-list');
        if (!listEl) {
            this.contentEl.empty();
            listEl = this.contentEl.createDiv({ cls: 'colophon-comment-list' });
        }

        // Track active thread IDs for cleanup
        const activeThreads = new Set(threads.map(t => t.id));

        // 1. Cleanup old editors/elements
        for (const [id, editor] of this.editors) {
            if (id.startsWith('comment-') && !activeThreads.has(id.split(':')[0])) {
                editor.destroy();
                this.editors.delete(id);
            }
        }

        const allCards = listEl.querySelectorAll('.colophon-comment-thread');
        allCards.forEach(card => {
            if (!activeThreads.has(card.dataset.threadId)) {
                card.remove();
            }
        });

        // 2. Render/Sync Threads (Surgically)
        threads.forEach((thread, index) => {
            let threadEl = listEl.querySelector(`[data-thread-id="${thread.id}"]`);
            if (!threadEl) {
                threadEl = listEl.createDiv({ cls: 'colophon-comment-thread' });
                threadEl.dataset.threadId = thread.id;
            }

            this.renderCommentCard(thread.id, thread.data, threadEl);
        });

        // 3. Re-order DOM
        threads.forEach((thread, index) => {
            const el = listEl.querySelector(`[data-thread-id="${thread.id}"]`);
            if (el && listEl.children[index] !== el) {
                listEl.insertBefore(el, listEl.children[index]);
            }
        });
    }

    renderCommentCard(threadId, comments, container) {
        let cardEl = container.querySelector('.colophon-comment-card');
        if (!cardEl) {
            cardEl = container.createDiv({ cls: 'colophon-comment-card' });
        }

        let commentListEl = cardEl.querySelector('.colophon-comment-items');
        if (!commentListEl) {
            commentListEl = cardEl.createDiv({ cls: 'colophon-comment-items' });
        }

        // Cleanup orphaned comment elements (replies removed)
        const currentIndices = new Set(comments.map((_, i) => i.toString()));
        const existingItems = commentListEl.querySelectorAll('[data-comment-index]');
        existingItems.forEach(item => {
            if (!currentIndices.has(item.dataset.commentIndex)) {
                item.remove();
            }
        });

        comments.forEach((comment, index) => {
            let commentItem = commentListEl.querySelector(`[data-comment-index="${index}"]`);
            if (!commentItem) {
                const isReply = index > 0;
                commentItem = commentListEl.createDiv({ 
                    cls: isReply ? 'colophon-comment-reply' : 'colophon-comment-parent' 
                });
                commentItem.dataset.commentIndex = index;
                
                const header = commentItem.createDiv({ cls: 'colophon-comment-header' });
                header.createSpan({ cls: 'colophon-comment-author', text: comment.author });
                header.createSpan({ cls: 'colophon-comment-date' });

                commentItem.createDiv({ cls: 'colophon-comment-editor-container' });
            }

            // Sync Header Date
            const dateEl = commentItem.querySelector('.colophon-comment-date');
            const dateText = new Date(comment.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            if (dateEl.getText() !== dateText) {
                dateEl.setText(dateText);
            }

            const editorContainer = commentItem.querySelector('.colophon-comment-editor-container');
            const editorId = `${threadId}:${index}`;

            const editor = this.editors.get(editorId);
            if (editor) {
                // DATA SYNC (Canvas -> Sidebar)
                // Only set content if NOT focused and content actually changed
                if (!editor.isFocused) {
                    const currentJSON = JSON.stringify(editor.getJSON());
                    const incomingJSON = JSON.stringify(comment.content);
                    if (currentJSON !== incomingJSON) {
                        editor.commands.setContent(comment.content, false);
                    }
                }
            } else {
                // Preview or lazy editor
                this.renderPreview(editorId, comment.content, editorContainer, () => {
                    this.createCommentEditor(threadId, index, comment, editorContainer);
                });
                
                // Ensure click handler is present
                editorContainer.onclick = () => {
                    if (!this.editors.has(editorId)) {
                        this.createCommentEditor(threadId, index, comment, editorContainer);
                    }
                };
            }
        });

        // Sync Footer (create if not exists)
        let footer = cardEl.querySelector('.colophon-comment-footer');
        if (!footer) {
            footer = cardEl.createDiv({ cls: 'colophon-comment-footer' });
            
            const replyBtn = footer.createEl('button', { cls: 'colophon-comment-action' });
            setIcon(replyBtn.createSpan({ cls: 'colophon-comment-action-icon' }), 'reply');
            replyBtn.createSpan({ text: 'Reply' });
            replyBtn.onclick = () => this.addReply(threadId);

            const deleteBtn = footer.createEl('button', { cls: 'colophon-comment-action is-danger' });
            setIcon(deleteBtn.createSpan({ cls: 'colophon-comment-action-icon' }), 'trash-2');
            deleteBtn.createSpan({ text: 'Delete' });
            deleteBtn.onclick = () => this.deleteThread(threadId);
        }
    }

    addReply(threadId) {
        const adapter = this.provider.getAdapter();
        if (!adapter || !adapter.comments[threadId]) return;

        const author = this.plugin.settings.authorName || this.app.vault.getName();
        const date = new Date().toISOString();

        const newComment = {
            author,
            date,
            content: { type: 'doc', content: [{ type: 'body' }] },
            replies: []
        };
        adapter.comments[threadId].push(newComment);

        this.refresh();
        
        // Focus new reply
        const newIndex = adapter.comments[threadId].length - 1;
        setTimeout(() => {
            const threadEl = this.containerEl.querySelector(`[data-thread-id="${threadId}"]`);
            if (threadEl) {
                const lastItem = threadEl.querySelector('.colophon-comment-reply:last-of-type');
                const editorContainer = lastItem?.querySelector('.colophon-comment-editor-container');
                if (editorContainer) {
                    this.createCommentEditor(threadId, newIndex, newComment, editorContainer);
                }
            }
        }, 50);
    }

    deleteThread(threadId) {
        const adapter = this.provider.getAdapter();
        if (!adapter) return;

        // 1. Remove mark from main editor
        const { tr } = adapter.editor.state;
        adapter.editor.state.doc.descendants((node, pos) => {
            if (node.marks) {
                node.marks.forEach(mark => {
                    if (mark.type.name === 'commentHighlight' && mark.attrs.threadId === threadId) {
                        tr.removeMark(pos, pos + node.nodeSize, mark.type);
                    }
                });
            }
        });
        adapter.editor.view.dispatch(tr);

        // 2. Remove from metadata
        delete adapter.comments[threadId];

        this.refresh();
    }

    createCommentEditor(threadId, index, comment, element) {
        const editorId = `${threadId}:${index}`;
        if (this.editors.has(editorId)) return;

        element.empty();
        
        const adapter = this.provider.getAdapter();
        if (!adapter) return;

        const extensions = adapter.sharedExtensions;
        const isSpellcheckEnabled = this.app.vault.getConfig('spellcheck');

        // Deep clone the initial content to isolate editor state from the shared metadata
        const initialContent = JSON.parse(JSON.stringify(comment.content));

        const editor = new Editor({
            element: element,
            app: this.app,
            plugin: this.plugin,
            extensions: extensions,
            content: initialContent,
            onUpdate: ({ editor }) => {
                // Update by reference to the comment object to avoid index-shift bugs
                comment.content = editor.getJSON();
                const adapter = this.provider.getAdapter();
                if (adapter && adapter.onUpdate) {
                    adapter.onUpdate();
                }
            },
            onSelectionUpdate: ({ editor }) => {
                this.provider.updateActiveEditor(editor);
            },
            onFocus: ({ editor }) => {
                if (this.blurTimers.has(editorId)) {
                    clearTimeout(this.blurTimers.get(editorId));
                    this.blurTimers.delete(editorId);
                }
                this.provider.updateActiveEditor(editor);
            },
            onBlur: ({ editor }) => {
                const finalContent = editor.getJSON();
                // Final sync by reference
                comment.content = finalContent;
                const adapter = this.provider.getAdapter();
                if (adapter && adapter.onUpdate) {
                    adapter.onUpdate();
                }
                
                const timer = setTimeout(() => {
                    if (!editor.isFocused && this.editors.has(editorId)) {
                        // Clear active editor if it was this one
                        const activeEditor = this.provider.getActiveEditor ? this.provider.getActiveEditor() : (adapter ? adapter.view.activeEditor : null);
                        if (activeEditor === editor) {
                            this.provider.updateActiveEditor(null);
                        }

                        editor.destroy();
                        this.editors.delete(editorId);
                        this.renderPreview(editorId, finalContent, element);
                    }
                    this.blurTimers.delete(editorId);
                }, 150);
                
                this.blurTimers.set(editorId, timer);
            },
            editorProps: {
                attributes: {
                    class: 'colophon-comment-editor',
                    spellcheck: isSpellcheckEnabled ? 'true' : 'false',
                }
            }
        });

        this.editors.set(editorId, editor);
        editor.commands.focus('end');

        // Add internal link suggestions to comment editor
        if (this.app && this.plugin) {
            new TiptapLinkSuggest(this.app, this.plugin, editor);
        }
    }

    show(tab = 'footnotes', callback = null) {
        if (this.activeTab !== tab) {
            this.lastFootnotesJSON = null;
            // Clear active editor when switching tabs to prevent stale references in toolbar
            this.provider.updateActiveEditor(null);
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
