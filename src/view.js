import { TextFileView, setIcon } from 'obsidian';
import { TiptapAdapter } from './tiptap-adapter';
import { ColophonToolbar } from './ui/toolbar';
import { ZAxisPanel } from './ui/z-axis-panel';
import { FindReplaceBar } from './ui/find-replace-bar';

export const VIEW_TYPE_COLOPHON = 'colophon-view';

export class ColophonView extends TextFileView {
    constructor(leaf, plugin) {
        super(leaf);
        this.plugin = plugin;
        this.adapter = null;
        this.docType = 'manuscript'; // 'manuscript' | 'script'
        this.activeEditor = null;
        this.wordCountIndicator = null;
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

    onPaneMenu(menu, source) {
        super.onPaneMenu(menu, source);
        menu.addItem((item) => {
            item
                .setTitle('Export to DOCX format')
                .setIcon('download')
                .onClick(() => {
                    this.app.commands.executeCommandById('colophon-writer:export-to-docx');
                });
        });
        menu.addItem((item) => {
            item
                .setTitle('Export to Markdown format')
                .setIcon('file-text')
                .onClick(() => {
                    this.app.commands.executeCommandById('colophon-writer:export-to-markdown');
                });
        });

        menu.addItem((item) => {
            const isVisible = this.plugin.settings.showWordCount;
            item
                .setTitle(isVisible ? 'Hide word count' : 'Show word count')
                .setIcon('hash')
                .onClick(() => {
                    this.toggleWordCount();
                });
        });

        menu.addItem((item) => {
            const isScript = this.docType === 'script';
            item
                .setTitle(isScript ? 'Switch to Manuscript mode' : 'Switch to Script mode')
                .setIcon(isScript ? 'feather' : 'clapperboard')
                .onClick(() => {
                    this.toggleMode();
                });
        });
    }

    toggleMode() {
        this.docType = this.docType === 'script' ? 'manuscript' : 'script';
        
        // Initial block migration if changing mode on empty-ish file
        const { state } = this.adapter.editor;
        if (state.doc.content.size <= 2) { // Just one empty block
            const newType = this.docType === 'script' ? 'script-action' : 'body';
            this.adapter.editor.chain().setNode(newType).run();
        }

        this.updateViewMode();
        this.requestSave();
    }

    updateViewMode() {
        this.contentEl.removeClass('type-manuscript', 'type-script', 'is-manuscript-mode', 'is-script-mode');
        this.contentEl.addClass(`type-${this.docType}`);
        this.contentEl.addClass(`is-${this.docType}-mode`);

        if (this.scrollContainer) {
            this.scrollContainer.removeClass('is-manuscript-mode', 'is-script-mode');
            this.scrollContainer.addClass(`is-${this.docType}-mode`);
        }

        if (this.adapter) {
            this.adapter.type = this.docType;
            if (this.adapter.editor) {
                const isSpellcheckEnabled = this.app.vault.getConfig('spellcheck');
                this.adapter.editor.setOptions({
                    editorProps: {
                        attributes: {
                            class: `colophon-editor colophon-main-editor type-${this.docType} is-${this.docType}-mode`,
                            spellcheck: isSpellcheckEnabled ? 'true' : 'false',
                        },
                    }
                });
            }
        }

        if (this.leaf && this.leaf.tabHeaderInnerIconEl) {
            setIcon(this.leaf.tabHeaderInnerIconEl, this.getIcon());
            this.icon = this.getIcon();
        }
    }

    toggleWordCount() {
        this.plugin.settings.showWordCount = !this.plugin.settings.showWordCount;
        this.plugin.saveSettings();
        this.updateWordCountIndicator();
    }

    updateWordCountIndicator() {
        if (!this.plugin.settings.showWordCount) {
            if (this.wordCountIndicator) {
                this.wordCountIndicator.remove();
                this.wordCountIndicator = null;
            }
            return;
        }

        if (!this.wordCountIndicator) {
            this.wordCountIndicator = this.contentEl.createDiv({ cls: 'colophon-word-count-indicator' });
        }

        const counts = this.adapter ? this.adapter.getWordCount() : { doc: 0, total: 0 };
        this.wordCountIndicator.setText(`${counts.doc} words / ${counts.total} with footnotes`);
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

        // Body container for horizontal split
        this.layoutBody = this.mainLayout.createDiv({ cls: 'colophon-layout-body' });

        // Add scroll container which is the target for our FixedFeed logic and CSS
        this.scrollContainer = this.layoutBody.createDiv({ cls: 'colophon-scroll-container colophon-editor-host' });

        // Add Z-Axis Panel (Sidebar)
        this.zAxisPanel = new ZAxisPanel(
            this.app, 
            this.plugin, 
            {
                getAdapter: () => this.adapter,
                updateActiveEditor: (editor) => this.updateActiveEditor(editor),
                getActiveEditor: () => this.activeEditor,
                getToolbar: () => this.toolbar
            },
            this.layoutBody
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

        this.updateWordCountIndicator();
        this.refreshSidebarVisibility();

        this.findReplaceBar = new FindReplaceBar(this, this.mainLayout);
        this.mainLayout.prepend(this.findReplaceBar.containerEl);

        // Shortcut listener for when focus is in the view but not necessarily in the editor
        // Use capture to supersede global Obsidian hotkeys for find navigation
        this.registerDomEvent(this.contentEl, 'keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                e.stopPropagation();
                this.findReplaceBar.open();
            } else if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === 'f') {
                e.preventDefault();
                e.stopPropagation();
                this.findReplaceBar.openReplace();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
                e.preventDefault();
                e.stopPropagation();
                if (e.shiftKey) {
                    if (this.adapter && this.adapter.editor) this.adapter.editor.commands.previousSearchResult();
                } else {
                    if (this.adapter && this.adapter.editor) this.adapter.editor.commands.nextSearchResult();
                }
            }
        }, { capture: true });
    }

    showZAxisTab(tab) {
        if (this.zAxisPanel) {
            this.zAxisPanel.show(tab);
        }
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
            this.plugin.settings.lastZAxisState = {
                visible: this.zAxisPanel.isVisible,
                activeTab: this.zAxisPanel.activeTab
            };
            this.plugin.saveSettings();
        }
    }

    toggleComments() {
        if (this.plugin.settings.sidebarLocation === 'global') {
            this.plugin.openSidebar();
            return;
        }
        if (this.zAxisPanel) {
            this.zAxisPanel.toggle('comments');
            this.plugin.settings.lastZAxisState = {
                visible: this.zAxisPanel.isVisible,
                activeTab: this.zAxisPanel.activeTab
            };
            this.plugin.saveSettings();
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

        // Data Cleanup: If comments were accidentally saved into footnotes (due to a bug in renderPreview focus), move them back.
        if (parsedData && parsedData.footnotes) {
            this.migrateComments(parsedData);
        }

        this.docType = parsedData.type || 'manuscript';

        this.updateViewMode();
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
                    if (this.findReplaceBar) this.findReplaceBar.updateInfo();
                    this.updateWordCountIndicator();
                    
                    // Update whichever panel is active
                    if (this.plugin.settings.sidebarLocation === 'global') {
                        this.plugin.sidebarManager.update();
                    } else if (this.zAxisPanel) {
                        this.zAxisPanel.debouncedUpdate();
                    }
                }
            });
            
            // Restore sidebar state if needed
            if (this.zAxisPanel && this.plugin.settings.sidebarLocation !== 'global' && this.plugin.settings.lastZAxisState.visible) {
                this.zAxisPanel.show(this.plugin.settings.lastZAxisState.activeTab);
            } else if (this.zAxisPanel && this.zAxisPanel.isVisible) {
                this.zAxisPanel.update();
            }
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
                                class: `colophon-editor colophon-main-editor type-${this.docType} is-${this.docType}-mode`,
                                spellcheck: isSpellcheckEnabled ? 'true' : 'false',
                            },
                        }
                    });
                }
                
                // Ensure sidebar updates with new content
                if (this.zAxisPanel && this.zAxisPanel.isVisible) {
                    this.zAxisPanel.update();
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

        // 1. Initialize metadata FIRST so garbage collection finds it if setMark triggers an immediate save
        if (!this.adapter.comments) this.adapter.comments = {};
        this.adapter.comments[threadId] = [{
            author,
            date,
            content: { type: 'doc', content: [{ type: 'body' }] },
            replies: []
        }];

        // 2. Mark the text in the editor
        editor.chain().focus().setMark('commentHighlight', { threadId }).run();

        // 3. Focus the new comment (handles sidebar logic and editor instantiation)
        this.adapter.focusComment(threadId);
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

    migrateComments(data) {
        if (!data.comments) data.comments = {};
        
        for (const key in data.footnotes) {
            if (key.startsWith('comment-')) {
                // Key format: "comment-UUID:index"
                const parts = key.split(':');
                if (parts.length === 2) {
                    const threadId = parts[0];
                    const index = parseInt(parts[1]);
                    const content = data.footnotes[key];

                    if (!data.comments[threadId]) {
                        data.comments[threadId] = [];
                    }

                    // If thread is missing the metadata for this index, initialize it
                    if (!data.comments[threadId][index]) {
                        data.comments[threadId][index] = {
                            author: this.plugin.settings.authorName || this.app.vault.getName(),
                            date: new Date().toISOString(),
                            content: content,
                            replies: []
                        };
                    } else {
                        // Just update content
                        data.comments[threadId][index].content = content;
                    }

                    // Delete from footnotes
                    delete data.footnotes[key];
                }
            }
        }
    }
}
