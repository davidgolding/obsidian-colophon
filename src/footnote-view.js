const { ItemView, WorkspaceLeaf, Notice, setIcon, Menu } = require('obsidian');
const { Editor, mergeAttributes } = require('@tiptap/core');
const { StarterKit } = require('@tiptap/starter-kit');
const Underline = require('@tiptap/extension-underline');
const { Subscript } = require('@tiptap/extension-subscript');
const { Superscript } = require('@tiptap/extension-superscript');
const TextStyle = require('@tiptap/extension-text-style');
// PopoverMenu removed
const Substitutions = require('./extensions/substitutions');
const InternalLink = require('./extensions/internallink');
const CommentMark = require('./extensions/comment-mark');

const FOOTNOTE_VIEW_TYPE = 'colophon-footnote-view';

class FootnoteView extends ItemView {
    constructor(leaf, settings, isSpellcheckEnabled) {
        super(leaf);
        this.settings = settings || { smartQuotes: true, smartDashes: true, doubleQuoteStyle: '“|”', singleQuoteStyle: '‘|’' };
        this.isSpellcheckEnabled = isSpellcheckEnabled;
        this.adapter = null;
        this.editors = new Map(); // Map<id, Editor>
    }

    getViewType() {
        return FOOTNOTE_VIEW_TYPE;
    }

    getDisplayText() {
        return 'Footnotes';
    }

    getIcon() {
        return 'list-ordered';
    }

    async onOpen() {
        await super.onOpen();
        const container = this.contentEl;
        container.empty();
        container.addClass('colophon-footnote-view');

        // Initialize Popover removed

        this.render();
    }

    getEphemeralState() {
        const state = super.getEphemeralState();
        state.scroll = this.contentEl.scrollTop;
        return state;
    }

    setEphemeralState(state) {
        super.setEphemeralState(state);
        if (state.scroll) {
            this.contentEl.scrollTop = state.scroll;
        }
    }

    async onClose() {
        // Cleanup editors
        this.editors.forEach(editor => editor.destroy());
        this.editors.clear();

        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }

    updateSettings(newSettings) {
        this.settings = newSettings;
        // We need to re-initialize editors to apply new input rules
        // This is a bit heavy, but necessary for input rules
        // We can just clear and re-render
        this.render(true); // Force re-render
    }

    setAdapter(adapter) {
        // Save scroll state to current adapter before switching
        if (this.adapter) {
            this.adapter.footnoteScrollState = this.contentEl.scrollTop;
        }

        // Unsubscribe from previous adapter if exists
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }

        this.adapter = adapter;

        if (this.adapter) {
            // Subscribe to updates
            this.unsubscribe = this.adapter.subscribe((event) => {
                if (event && event.type === 'remove-comment-mark') {
                    this.removeCommentMark(event.id);
                } else if (event && event.type === 'scroll-to-comment') {
                    this.scrollToComment(event.id);
                } else {
                    this.render();
                }
            });
        }

        this.render();

        // Restore scroll state if available
        if (this.adapter && this.adapter.footnoteScrollState !== undefined) {
            // We need to wait for DOM update? synchronous render should be fine unless images load.
            // But let's set it.
            this.contentEl.scrollTop = this.adapter.footnoteScrollState;
        } else {
            // Reset to top if no state
            this.contentEl.scrollTop = 0;
        }
    }

    render(force = false) {
        const container = this.contentEl;

        if (!this.adapter) {
            container.empty();
            this.editors.forEach(editor => editor.destroy());
            this.editors.clear();
            container.createEl('div', {
                text: 'No active manuscript.',
                cls: 'colophon-footnote-empty'
            });
            return;
        }

        const footnotes = this.adapter.getFootnotes();

        if (!footnotes || footnotes.length === 0) {
            container.empty();
            this.editors.forEach(editor => editor.destroy());
            this.editors.clear();
            container.createEl('div', {
                text: 'No footnotes yet.',
                cls: 'colophon-footnote-empty'
            });
            return;
        }

        // We need a container for the list if it doesn't exist
        let list = container.querySelector('.colophon-footnote-list');
        if (!list) {
            container.empty();
            list = container.createEl('div', { cls: 'colophon-footnote-list' });
        }

        // Track active IDs to remove old ones
        const activeIds = new Set(footnotes.map(f => f.id));

        // Remove old editors
        for (const [id, editor] of this.editors) {
            if (!activeIds.has(id) || force) {
                editor.destroy();
                this.editors.delete(id);
                const el = list.querySelector(`[data-footnote-id="${id}"]`);
                if (el) el.remove();
            }
        }

        // Update or Create editors
        footnotes.forEach((fn, index) => {
            let item = list.querySelector(`[data-footnote-id="${fn.id}"]`);

            if (!item) {
                item = list.createEl('div', { cls: 'colophon-footnote-item' });
                item.dataset.footnoteId = fn.id;

                // Header
                const header = item.createEl('div', { cls: 'colophon-footnote-header' });
                header.createSpan({ text: `${fn.number || index + 1}. `, cls: 'colophon-footnote-number' });

                // Editor Container
                const editorContainer = item.createEl('div', { cls: 'colophon-footnote-editor-container' });

                // Initialize Tiptap
                const editor = new Editor({
                    element: editorContainer,
                    extensions: [
                        StarterKit,
                        Underline,
                        Subscript,
                        Superscript,
                        TextStyle,
                        Substitutions.configure({
                            smartQuotes: this.settings.smartQuotes,
                            smartDashes: this.settings.smartDashes,
                            doubleQuoteStyle: this.settings.doubleQuoteStyle,
                            singleQuoteStyle: this.settings.singleQuoteStyle,
                        }),
                        InternalLink.configure({
                            app: this.app
                        }),
                        CommentMark
                    ],
                    content: fn.content, // Handles string or JSON
                    onUpdate: ({ editor }) => {
                        // Sync back to adapter
                        // We store JSON now
                        this.adapter.updateFootnote(fn.id, editor.getJSON());
                    },
                    editorProps: {
                        attributes: {
                            class: 'colophon-footnote-editor-content',
                            spellcheck: this.isSpellcheckEnabled ? 'true' : 'false',
                        },
                        handleDOMEvents: {
                            contextmenu: (view, event) => {
                                if (!view.state.selection.empty) {
                                    event.preventDefault();
                                    const menu = new Menu();
                                    menu.addItem((item) => {
                                        item
                                            .setTitle('Add comment')
                                            .setIcon('message-square')
                                            .onClick(() => {
                                                // We need to call addComment on the adapter
                                                // But adapter.addComment uses adapter.editor (main editor)
                                                // We need to add comment to THIS editor (footnote editor)
                                                // Does adapter support adding comment to arbitrary editor?
                                                // No, adapter.addComment uses this.editor.
                                                // We need to implement addComment logic for footnote editor here.

                                                const id = `comment-${Date.now()}`;
                                                editor.chain().focus().setComment(id).run();

                                                // Add data via adapter
                                                // We need to ensure adapter.commentsManager adds it
                                                if (this.adapter) {
                                                    this.adapter.commentsManager.addComment(id, this.adapter.settings.authorName);
                                                    this.adapter.triggerUpdate();

                                                    // Request panel open
                                                    if (this.adapter.listeners) {
                                                        this.adapter.listeners.forEach(listener => listener({ type: 'open-comments-panel' }));
                                                    }

                                                    // Focus the new comment card
                                                    setTimeout(() => {
                                                        if (this.adapter.listeners) {
                                                            this.adapter.listeners.forEach(listener => listener({ type: 'focus-comment', id }));
                                                        }
                                                    }, 100);
                                                }
                                            });
                                    });
                                    menu.showAtMouseEvent(event);
                                    return true;
                                }
                                return false;
                            },
                            dblclick: (view, event) => {
                                const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
                                if (pos) {
                                    const $pos = view.state.doc.resolve(pos.pos);
                                    const commentMark = $pos.marks().find(m => m.type.name === 'comment');

                                    if (commentMark) {
                                        const id = commentMark.attrs.id;
                                        if (this.adapter && this.adapter.listeners) {
                                            this.adapter.listeners.forEach(listener => listener({ type: 'open-comments-panel' }));
                                            setTimeout(() => {
                                                this.adapter.listeners.forEach(listener => listener({ type: 'focus-comment', id }));
                                            }, 50);
                                        }
                                        return true;
                                    }
                                }
                                return false;
                            }
                        }
                    },
                    onFocus: ({ editor }) => {
                        if (this.adapter && this.adapter.toolbar) {
                            this.adapter.toolbar.setActiveEditor(editor, true);
                        }
                    },
                    onSelectionUpdate: ({ editor }) => {
                        if (this.adapter && this.adapter.toolbar) {
                            this.adapter.toolbar.update();
                        }
                    }
                });

                this.editors.set(fn.id, editor);
            } else {
                // Update Number
                const numberSpan = item.querySelector('.colophon-footnote-number');
                if (numberSpan) numberSpan.innerText = `${fn.number || index + 1}. `;

                // Update Content? 
                // Only if it's significantly different and we are NOT focused?
                // If we update content while typing, cursor jumps.
                // We assume the editor's internal state is the source of truth while focused.
                // But if we undo in main doc and it reverts footnote content?
                // For now, we skip content update if editor exists to avoid cursor issues.
                // The adapter is the source of truth, but the editor is the local state.
            }
        });

        // Re-order items in DOM if needed?
        // footnotes is ordered. We should ensure DOM order matches.
        footnotes.forEach(fn => {
            const item = list.querySelector(`[data-footnote-id="${fn.id}"]`);
            if (item) list.appendChild(item); // Moves it to end, effectively sorting if we iterate in order
        });
    }

    focusFootnote(id) {
        const editor = this.editors.get(id);
        if (editor) {
            editor.commands.focus();
            // Scroll into view
            const item = this.contentEl.querySelector(`[data-footnote-id="${id}"]`);
            if (item) {
                item.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }

    getFocusedEditor() {
        for (const editor of this.editors.values()) {
            if (editor.isFocused) {
                return editor;
            }
        }
        return null;
    }

    removeCommentMark(id) {
        this.editors.forEach(editor => {
            if (!editor || editor.isDestroyed) return;

            const ranges = [];
            editor.state.doc.descendants((node, pos) => {
                if (node.marks) {
                    const mark = node.marks.find(m => m.type.name === 'comment' && m.attrs.id === id);
                    if (mark) {
                        ranges.push({ from: pos, to: pos + node.nodeSize });
                    }
                }
            });

            if (ranges.length > 0) {
                const tr = editor.state.tr;
                ranges.forEach(range => {
                    tr.removeMark(range.from, range.to, editor.schema.marks.comment);
                });
                editor.view.dispatch(tr);

                // Also update the footnote content in adapter
                // We need to find which footnote this editor belongs to
                // We can iterate map entries
                for (const [fnId, ed] of this.editors.entries()) {
                    if (ed === editor) {
                        this.adapter.updateFootnote(fnId, editor.getJSON());
                        break;
                    }
                }
            }
        });
    }

    scrollToComment(id) {
        for (const [fnId, editor] of this.editors.entries()) {
            let from = null;
            let to = null;
            editor.state.doc.descendants((node, pos) => {
                if (node.marks) {
                    const mark = node.marks.find(m => m.type.name === 'comment' && m.attrs.id === id);
                    if (mark) {
                        if (from === null) from = pos;
                        to = pos + node.nodeSize;
                    }
                }
            });

            if (from !== null && to !== null) {
                // Found it
                editor.chain()
                    .focus()
                    .setTextSelection({ from, to })
                    .scrollIntoView()
                    .run();

                // Also scroll the footnote item into view in the sidebar
                const item = this.contentEl.querySelector(`[data-footnote-id="${fnId}"]`);
                if (item) {
                    item.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                return;
            }
        }
    }
}

module.exports = {
    FootnoteView,
    FOOTNOTE_VIEW_TYPE
};
