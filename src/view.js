import { TextFileView } from 'obsidian';
import { TiptapAdapter } from './tiptap-adapter';
import { ColophonToolbar } from './ui/toolbar';
import { ZAxisPanel } from './ui/z-axis-panel';

export const VIEW_TYPE_COLOPHON = 'colophon-view';

export class ColophonView extends TextFileView {
    constructor(leaf, plugin) {
        super(leaf);
        this.plugin = plugin;
        this.adapter = null;
        this.docType = 'manuscript'; // 'manuscript' | 'script'
        this.activeEditor = null;
    }

    updateActiveEditor(editor) {
        this.activeEditor = editor;
        if (this.toolbar) {
            this.toolbar.update();
        }
    }

    getViewType() {
        return VIEW_TYPE_COLOPHON;
    }

    getDisplayText() {
        return this.file ? this.file.basename : 'No File';
    }

    getIcon() {
        return this.docType === 'script' ? 'clapperboard' : 'feather';
    }

    async onOpen() {
        await super.onOpen();
        
        this.contentEl.addClass('colophon-view');
        this.contentEl.addClass('colophon-workspace');

        // Idempotency: If mainLayout already exists, just ensure it's attached to the new contentEl
        if (this.mainLayout) {
            if (this.mainLayout.parentElement !== this.contentEl) {
                this.contentEl.empty();
                this.contentEl.appendChild(this.mainLayout);
            }
            this.refreshSidebarVisibility();
            return;
        }

        // Main Layout Container (Editor + Sidebar)
        this.mainLayout = this.contentEl.createDiv({ cls: 'colophon-main-layout' });

        // Add scroll container which is the target for our FixedFeed logic and CSS
        this.scrollContainer = this.mainLayout.createDiv({ cls: 'colophon-scroll-container' });

        // Add Z-Axis Panel (Sidebar)
        this.zAxisPanel = new ZAxisPanel(
            this.app, 
            this.plugin, 
            {
                getAdapter: () => this.adapter,
                updateActiveEditor: (editor) => this.updateActiveEditor(editor),
                getToolbar: () => this.toolbar
            },
            this.mainLayout
        );

        // Target the standard Obsidian header elements
        const viewHeader = this.containerEl.querySelector('.view-header');
        if (viewHeader) {
            viewHeader.addClass('colophon-view-header');
            const titleContainer = viewHeader.querySelector('.view-header-title-container');
            if (titleContainer) {
                // Ensure it's not hidden (it might be by our CSS)
                titleContainer.style.display = 'flex';
                this.toolbar = new ColophonToolbar(this, titleContainer);
            }
        }

        this.refreshSidebarVisibility();
    }

    async onClose() {
        await super.onClose();
        if (this.adapter) {
            this.adapter.destroy();
            this.adapter = null;
        }
        if (this.zAxisPanel) {
            this.zAxisPanel.destroy();
            this.zAxisPanel = null;
        }
        if (this.scrollContainer) {
            this.scrollContainer.empty();
        }
    }

    refreshSidebarVisibility() {
        const isGlobal = this.plugin.settings.sidebarLocation === 'global';
        
        if (isGlobal) {
            this.mainLayout.addClass('is-global-sidebar');
            if (this.zAxisPanel) {
                this.zAxisPanel.hide();
            }
        } else {
            this.mainLayout.removeClass('is-global-sidebar');
        }
    }

    // --- Panel Toggles ---

    toggleFootnotes() {
        if (this.plugin.settings.sidebarLocation === 'global') {
            this.plugin.openSidebar();
            return;
        }
        if (this.zAxisPanel) {
            this.zAxisPanel.toggle('footnotes');
        }
    }

    toggleComments() {
        if (this.plugin.settings.sidebarLocation === 'global') {
            this.plugin.openSidebar();
            return;
        }
        if (this.zAxisPanel) {
            this.zAxisPanel.toggle('comments');
        }
    }

    showFootnotes() {
        if (this.plugin.settings.sidebarLocation === 'global') {
            this.plugin.openSidebar();
            return;
        }
        if (this.zAxisPanel) {
            this.zAxisPanel.show('footnotes');
        }
    }

    showComments() {
        if (this.plugin.settings.sidebarLocation === 'global') {
            this.plugin.openSidebar();
            return;
        }
        if (this.zAxisPanel) {
            this.zAxisPanel.show('comments');
        }
    }

    /**
     * Called when the file content is modified externally or when loading.
     */
    setViewData(data, clear) {
        // Optimization: Skip if data hasn't changed to preserve undo history and selection
        if (!clear && data === this.lastLoadedData) {
            return;
        }
        this.lastLoadedData = data;

        let parsedData = { type: 'manuscript', doc: null, footnotes: {}, comments: {} };

        try {
            if (data && data.trim() !== '') {
                parsedData = JSON.parse(data);
            }
        } catch (e) {
            console.error('Colophon: Error parsing file data', e);
        }

        // Migration: Convert 'paragraph' to 'body' if present (legacy support)
        if (parsedData && parsedData.doc) {
            this.migrateContent(parsedData.doc);
        }

        this.docType = parsedData.type || 'manuscript';

        // Apply class for specific styling
        this.contentEl.removeClass('type-manuscript', 'type-script');
        this.contentEl.addClass(`type-${this.docType}`);

        this.updateSettings(); // Apply initial settings like fixedFeed class

        const isSpellcheckEnabled = this.app.vault.getConfig('spellcheck');

        if (!this.adapter) {
            this.adapter = new TiptapAdapter(this.scrollContainer, {
                content: parsedData.doc,
                footnotes: parsedData.footnotes || {},
                comments: parsedData.comments || {},
                type: this.docType,
                settings: this.plugin ? this.plugin.settings : null,
                isSpellcheckEnabled: isSpellcheckEnabled,
                app: this.app,
                plugin: this.plugin,
                view: this,
                onUpdate: () => {
                    this.requestSave();
                    if (this.toolbar) this.toolbar.update();
                    
                    // Update whichever panel is active
                    if (this.plugin.settings.sidebarLocation === 'global') {
                        this.plugin.sidebarManager.update();
                    } else if (this.zAxisPanel) {
                        this.zAxisPanel.update();
                    }
                }
            });
        } else {
            // If clear is true, it means we are reloading the file entirely
            if (clear) {
                this.adapter.type = this.docType; // Update type if it changed
                this.adapter.setContent(parsedData.doc || {}, parsedData.footnotes || {}, parsedData.comments || {});

                // Force update attributes if type or spellcheck changed
                if (this.adapter.editor) {
                    this.adapter.editor.setOptions({
                        editorProps: {
                            attributes: {
                                class: `colophon-editor type-${this.docType}`,
                                spellcheck: isSpellcheckEnabled ? 'true' : 'false',
                            },
                        }
                    });
                }
            }
        }
    }

    /**
     * Called to save the file.
     */
    getViewData() {
        if (!this.adapter) return '';

        // Garbage collection: Only keep comments that are still referenced in the document
        const activeThreadIds = this.adapter.getActiveCommentThreadIds();
        const cleanedComments = {};
        
        if (this.adapter.comments) {
            for (const threadId in this.adapter.comments) {
                if (activeThreadIds.has(threadId)) {
                    cleanedComments[threadId] = this.adapter.comments[threadId];
                }
            }
        }

        const data = {
            type: this.docType,
            doc: this.adapter.getJSON(),
            footnotes: this.adapter.footnotes,
            comments: cleanedComments
        };
        return JSON.stringify(data, null, 2);
    }

    clear() {
        if (this.adapter && this.adapter.editor) {
            this.adapter.editor.commands.clearContent();
        }
    }

    toggleBold() {
        const editor = this.activeEditor || (this.adapter ? this.adapter.editor : null);
        if (editor) editor.chain().focus().toggleBold().run();
    }

    toggleItalic() {
        const editor = this.activeEditor || (this.adapter ? this.adapter.editor : null);
        if (editor) editor.chain().focus().toggleItalic().run();
    }

    toggleStrike() {
        const editor = this.activeEditor || (this.adapter ? this.adapter.editor : null);
        if (editor) editor.chain().focus().toggleStrike().run();
    }

    toggleUnderline() {
        const editor = this.activeEditor || (this.adapter ? this.adapter.editor : null);
        if (editor) editor.chain().focus().toggleUnderline().run();
    }

    toggleSuperscript() {
        const editor = this.activeEditor || (this.adapter ? this.adapter.editor : null);
        if (editor) editor.chain().focus().toggleSuperscript().unsetSubscript().run();
    }

    toggleSubscript() {
        const editor = this.activeEditor || (this.adapter ? this.adapter.editor : null);
        if (editor) editor.chain().focus().toggleSubscript().unsetSuperscript().run();
    }

    toggleSmallCaps() {
        const editor = this.activeEditor || (this.adapter ? this.adapter.editor : null);
        if (editor) editor.chain().focus().toggleSmallCaps().run();
    }

    insertFootnote() {
        if (!this.adapter) return;
        if (this.docType === 'script') return;

        const id = `fn-${crypto.randomUUID()}`;
        this.adapter.editor.chain().insertContent({
            type: 'footnoteMarker',
            attrs: { id }
        }).run();

        // Focus will handle opening the panel and scrolling to the new note
        this.adapter.focusNote(id);
    }

    insertComment() {
        if (!this.adapter) return;
        
        const editor = this.activeEditor || this.adapter.editor;
        if (!editor || editor.state.selection.empty) return;

        const threadId = `comment-${crypto.randomUUID()}`;
        const author = this.plugin.settings.authorName || this.app.vault.getName();
        const date = new Date().toISOString();

        // 1. Mark the text in the editor
        editor.chain().focus().setMark('commentHighlight', { threadId }).run();

        // 2. Initialize metadata
        if (!this.adapter.comments[threadId]) {
            this.adapter.comments[threadId] = [{
                author,
                date,
                content: { type: 'doc', content: [{ type: 'body' }] },
                replies: []
            }];
        }

        // 3. Open Sidebar and focus the new comment
        this.showComments();
        
        // Use a timeout to ensure sidebar has rendered
        setTimeout(() => {
            if (this.zAxisPanel) {
                this.zAxisPanel.focusComment(threadId);
            } else if (this.plugin.settings.sidebarLocation === 'global') {
                const sidebarLeaf = this.app.workspace.getLeavesOfType('colophon-sidebar')[0];
                if (sidebarLeaf && sidebarLeaf.view.zAxisPanel) {
                    sidebarLeaf.view.zAxisPanel.focusComment(threadId);
                }
            }
        }, 100);
    }

    updateSettings() {
        const settings = this.plugin.settings;

        // Toggle typewriter mode class for CSS padding
        if (settings.fixedFeedPosition) {
            this.contentEl.addClass('is-fixed-feed');
        } else {
            this.contentEl.removeClass('is-fixed-feed');
        }

        if (this.adapter) {
            this.adapter.updateSettings(settings);
        }
        
        this.refreshSidebarVisibility();
    }

    migrateContent(node) {
        if (!node) return;

        if (node.type === 'paragraph') {
            node.type = 'body';
        }

        if (node.content && Array.isArray(node.content)) {
            node.content.forEach(child => this.migrateContent(child));
        }
    }
}
