import { Plugin, TFolder, TFile, Modal, Notice } from 'obsidian';
import { ColophonView, VIEW_TYPE_COLOPHON } from './view';
import { ColophonSidebarView, VIEW_TYPE_COLOPHON_SIDEBAR } from './sidebar-view';
import { DEFAULT_SETTINGS } from './settings-data';
import { StyleManager } from './style-manager';
import { ColophonSettingTab } from './settings-tab';
import { MetadataManager } from './metadata-manager';
import { SidebarManager } from './sidebar-manager';
import { ExportModal } from './ui/export-modal';
import MarkdownBridge from './markdown-bridge';

export default class ColophonPlugin extends Plugin {
    async onload() {
        // ... Load Settings ...
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

        // Initialize Bridge
        this.markdownBridge = new MarkdownBridge();

        // Initialize Managers
        this.metadataManager = new MetadataManager(this);
        this.metadataManager.setup();

        this.sidebarManager = new SidebarManager(this);
        this.sidebarManager.setup();

        // Initialize Style Manager
        this.styleManager = new StyleManager();
        this.styleManager.applyStyles(this.settings);

        this.addSettingTab(new ColophonSettingTab(this.app, this));

        // 1. Register the View
        this.registerView(
            VIEW_TYPE_COLOPHON,
            (leaf) => new ColophonView(leaf, this)
        );

        this.registerView(
            VIEW_TYPE_COLOPHON_SIDEBAR,
            (leaf) => new ColophonSidebarView(leaf, this)
        );

        // 2. Register the File Extension
        this.registerExtensions(['colophon'], VIEW_TYPE_COLOPHON);

        // 3. Ribbon Icon - New Manuscript
        this.addRibbonIcon('feather', 'New Colophon Manuscript', () => {
            this.createNewColophonFile('manuscript');
        });

        // 4. Commands
        this.addCommand({
            id: 'new-manuscript',
            name: 'New Manuscript',
            callback: () => this.createNewColophonFile('manuscript')
        });

        this.addCommand({
            id: 'open-sidebar',
            name: 'Open Sidebar',
            callback: () => this.openSidebar()
        });

        this.addCommand({
            id: 'open-find-replace',
            name: 'Open Find/Replace',
            checkCallback: (checking) => {
                const view = this.app.workspace.getActiveViewOfType(ColophonView);
                if (view) {
                    if (!checking) {
                        if (view.findReplaceBar) view.findReplaceBar.open();
                    }
                    return true;
                }
                return false;
            }
        });

        this.addCommand({
            id: 'open-replace',
            name: 'Open Replace',
            checkCallback: (checking) => {
                const view = this.app.workspace.getActiveViewOfType(ColophonView);
                if (view) {
                    if (!checking) {
                        if (view.findReplaceBar) view.findReplaceBar.openReplace();
                    }
                    return true;
                }
                return false;
            }
        });

        this.addCommand({
            id: 'find-next',
            name: 'Find Next',
            checkCallback: (checking) => {
                const view = this.app.workspace.getActiveViewOfType(ColophonView);
                if (view && view.adapter && view.adapter.editor) {
                    if (!checking) {
                        view.adapter.editor.commands.nextSearchResult();
                    }
                    return true;
                }
                return false;
            }
        });

        this.addCommand({
            id: 'find-previous',
            name: 'Find Previous',
            checkCallback: (checking) => {
                const view = this.app.workspace.getActiveViewOfType(ColophonView);
                if (view && view.adapter && view.adapter.editor) {
                    if (!checking) {
                        view.adapter.editor.commands.previousSearchResult();
                    }
                    return true;
                }
                return false;
            }
        });

        this.addCommand({
            id: 'export-to-docx',
            name: 'Export to Word (.docx)',
            checkCallback: (checking) => {
                const view = this.app.workspace.getActiveViewOfType(ColophonView);
                if (view && view.adapter) {
                    if (!checking) {
                        new ExportModal(this.app, (exportSettings) => {
                            view.adapter.editor.commands.exportToDocx({
                                settings: exportSettings,
                                footnotes: view.adapter.footnotes,
                                comments: view.adapter.comments,
                                stylesConfig: this.settings.blocks
                            });
                        }).open();
                    }
                    return true;
                }
                return false;
            }
        });

        this.addCommand({
            id: 'export-to-markdown',
            name: 'Export to Markdown (.md)',
            checkCallback: (checking) => {
                const view = this.app.workspace.getActiveViewOfType(ColophonView);
                if (view && view.adapter) {
                    if (!checking) {
                        this.exportToMarkdown(view);
                    }
                    return true;
                }
                return false;
            }
        });

        this.addCommand({
            id: 'insert-internal-link',
            name: 'Insert Internal Link',
            checkCallback: (checking) => {
                const view = this.app.workspace.getActiveViewOfType(ColophonView);
                if (view && view.adapter) {
                    if (!checking) {
                        view.adapter.editor.commands.insertContent('[[');
                    }
                    return true;
                }
                return false;
            }
        });

        this.addCommand({
            id: 'insert-footnote',
            name: 'Insert Footnote',
            checkCallback: (checking) => {
                const view = this.app.workspace.getActiveViewOfType(ColophonView);
                if (view && view.adapter) {
                    if (!checking) {
                        view.insertFootnote();
                    }
                    return true;
                }
                return false;
            }
        });

        this.addCommand({
            id: 'insert-comment',
            name: 'Insert Comment',
            checkCallback: (checking) => {
                const view = this.app.workspace.getActiveViewOfType(ColophonView);
                if (view && view.adapter) {
                    // Only allow if text is selected
                    const editor = view.activeEditor || (view.adapter ? view.adapter.editor : null);
                    if (editor && !editor.state.selection.empty) {
                        if (!checking) {
                            view.insertComment();
                        }
                        return true;
                    }
                }
                return false;
            }
        });

        this.addCommand({
            id: 'toggle-underline',
            name: 'Toggle Underline',
            checkCallback: (checking) => {
                const view = this.app.workspace.getActiveViewOfType(ColophonView);
                if (view && view.adapter) {
                    if (!checking) view.toggleUnderline();
                    return true;
                }
                return false;
            }
        });

        this.addCommand({
            id: 'toggle-superscript',
            name: 'Toggle Superscript',
            checkCallback: (checking) => {
                const view = this.app.workspace.getActiveViewOfType(ColophonView);
                if (view && view.adapter) {
                    if (!checking) view.toggleSuperscript();
                    return true;
                }
                return false;
            }
        });

        this.addCommand({
            id: 'toggle-subscript',
            name: 'Toggle Subscript',
            checkCallback: (checking) => {
                const view = this.app.workspace.getActiveViewOfType(ColophonView);
                if (view && view.adapter) {
                    if (!checking) view.toggleSubscript();
                    return true;
                }
                return false;
            }
        });

        this.addCommand({
            id: 'toggle-small-caps',
            name: 'Toggle Small Caps',
            checkCallback: (checking) => {
                const view = this.app.workspace.getActiveViewOfType(ColophonView);
                if (view && view.adapter) {
                    if (!checking) view.toggleSmallCaps();
                    return true;
                }
                return false;
            }
        });

        this.addCommand({
            id: 'colophon:add-link',
            name: 'Agent: Add Link',
            callback: (args) => {
                const { target, alias } = args || {};
                const view = this.app.workspace.getActiveViewOfType(ColophonView);
                if (view && view.adapter) {
                    view.adapter.addLink({ target, alias });
                }
            }
        });

        this.addCommand({
            id: 'colophon:set-block-type',
            name: 'Agent: Set Block Type',
            callback: (args) => {
                const { typeId } = args || {};
                if (!typeId) return;
                const view = this.app.workspace.getActiveViewOfType(ColophonView);
                if (view && view.adapter) {
                    view.adapter.setBlockType(typeId);
                }
            }
        });

        this.addCommand({
            id: 'colophon:focus-footnote',
            name: 'Agent: Focus Footnote',
            callback: (args) => {
                const { id } = args || {};
                if (!id) return;
                const view = this.app.workspace.getActiveViewOfType(ColophonView);
                if (view && view.adapter) {
                    view.adapter.focusNote(id);
                }
            }
        });

        this.addCommand({
            id: 'convert-legacy-manuscripts',
            name: 'Convert Legacy Manuscript Files',
            callback: () => this.convertLegacyManuscriptFiles()
        });

        // 5. Context Menu (Editor)
        this.registerEvent(
            this.app.workspace.on('editor-menu', (menu, editor, view) => {
                if (view instanceof ColophonView) {
                    if (editor.getSelection()) {
                        menu.addItem((item) => {
                            item
                                .setTitle('Add comment')
                                .setIcon('message-square-plus')
                                .onClick(() => {
                                    view.insertComment();
                                });
                        });
                    }
                } else {
                    // Check if active file is legacy markdown
                    const file = view.file;
                    if (file && file.extension === 'md') {
                        const cache = this.app.metadataCache.getFileCache(file);
                        const isLegacy = cache?.frontmatter?.['colophon-plugin'] === 'manuscript';
                        if (isLegacy) {
                            menu.addItem((item) => {
                                item
                                    .setTitle('Convert legacy to standard Colophon')
                                    .setIcon('zap')
                                    .onClick(async () => {
                                        await this.convertSingleLegacyFile(file);
                                    });
                            });
                        }
                    }
                }
            })
        );

        // 6. Context Menu (File Explorer)
        this.registerEvent(
            this.app.workspace.on('file-menu', (menu, file) => {
                if (file instanceof TFolder) {
                    menu.addItem((item) => {
                        item
                            .setTitle('New manuscript')
                            .setIcon('feather')
                            .onClick(async () => {
                                await this.createNewColophonFile('manuscript', file.path);
                            });
                    });
                } else if (file instanceof TFile && file.extension === 'md') {
                    const cache = this.app.metadataCache.getFileCache(file);
                    const isLegacy = cache?.frontmatter?.['colophon-plugin'] === 'manuscript';

                    if (isLegacy) {
                        menu.addItem((item) => {
                            item
                                .setTitle('Convert legacy to standard Colophon')
                                .setIcon('zap')
                                .onClick(async () => {
                                    await this.convertSingleLegacyFile(file);
                                });
                        });
                    }

                    menu.addItem((item) => {
                        item
                            .setTitle('Convert to Colophon manuscript format')
                            .setIcon('feather')
                            .onClick(async () => {
                                await this.convertToColophon(file);
                            });
                    });
                }
            })
        );

        // 7. Patch Native Commands
        this.app.workspace.onLayoutReady(() => {
            this.patchCommand('editor:toggle-bold', (view) => view.toggleBold());
            this.patchCommand('editor:toggle-italics', (view) => view.toggleItalic());
            this.patchCommand('editor:toggle-strikethrough', (view) => view.toggleStrike());
            this.patchCommand('editor:insert-footnote', (view) => view.insertFootnote());
            this.patchCommand('editor:open-search', (view) => {
                if (view.findReplaceBar) view.findReplaceBar.open();
            });
            this.patchCommand('editor:find-next', (view) => {
                if (view.adapter && view.adapter.editor) {
                    view.adapter.editor.commands.nextSearchResult();
                }
            });
            this.patchCommand('editor:find-previous', (view) => {
                if (view.adapter && view.adapter.editor) {
                    view.adapter.editor.commands.previousSearchResult();
                }
            });

            // Initial cleanup: if local sidebar is selected, ensure no global leaf exists
            if (this.settings.sidebarLocation !== 'global') {
                this.app.workspace.getLeavesOfType(VIEW_TYPE_COLOPHON_SIDEBAR).forEach(leaf => {
                    leaf.detach();
                });
            }
        });
    }

    async exportToMarkdown(view) {
        if (!view || !view.adapter) return;
        
        const file = view.file;
        const data = JSON.parse(view.getViewData());
        
        const markdown = this.markdownBridge.dehydrate(
            data.doc, 
            data.footnotes || {}, 
            data.comments || {}
        );
        
        const mdPath = file.path.replace(/\.colophon$/, '.md');
        let finalPath = mdPath;
        let count = 1;
        
        while (await this.app.vault.adapter.exists(finalPath)) {
            finalPath = mdPath.replace(/\.md$/, ` ${count}.md`);
            count++;
        }
        
        try {
            await this.app.vault.create(finalPath, markdown);
            new Notice(`Exported to ${finalPath}`);
        } catch (err) {
            console.error('Colophon: Failed to export Markdown', err);
            new Notice('Failed to export Markdown');
        }
    }

    async convertToColophon(file) {
        if (!(file instanceof TFile)) return;
        
        try {
            const markdown = await this.app.vault.read(file);
            const data = this.markdownBridge.hydrate(markdown);
            
            const colophonPath = file.path.replace(/\.md$/, '.colophon');
            let finalPath = colophonPath;
            let count = 1;
            
            while (await this.app.vault.adapter.exists(finalPath)) {
                finalPath = colophonPath.replace(/\.colophon$/, ` ${count}.colophon`);
                count++;
            }
            
            await this.app.vault.create(finalPath, JSON.stringify(data, null, 2));
            new Notice(`Converted to ${finalPath}`);
            
            // Open the new file
            const newFile = this.app.vault.getAbstractFileByPath(finalPath);
            if (newFile instanceof TFile) {
                const leaf = this.app.workspace.getLeaf(true);
                await leaf.openFile(newFile);
            }
        } catch (err) {
            console.error('Colophon: Failed to convert to Colophon', err);
            new Notice('Failed to convert to Colophon');
        }
    }

    async convertSingleLegacyFile(file) {
        try {
            const content = await this.app.vault.read(file);
            const parsed = this.parseLegacyFormat(content);

            if (!parsed) {
                new Notice('Failed to parse legacy data block');
                return;
            }

            // 1. Legacy -> New JSON
            const transformed = this.transformLegacyData(parsed);

            // 2. New JSON -> Clean Markdown
            const markdown = this.markdownBridge.dehydrate(
                transformed.doc,
                transformed.footnotes || {},
                transformed.comments || {}
            );

            // 3. Markdown -> .colophon
            // (We'll use hydrate here directly to avoid double-writing files)
            const finalData = this.markdownBridge.hydrate(markdown);

            const colophonPath = file.path.replace(/\.md$/, '.colophon');
            let finalPath = colophonPath;
            let count = 1;

            while (await this.app.vault.adapter.exists(finalPath)) {
                finalPath = colophonPath.replace(/\.colophon$/, ` ${count}.colophon`);
                count++;
            }

            await this.app.vault.create(finalPath, JSON.stringify(finalData, null, 2));
            
            // Delete original legacy file
            await this.app.vault.delete(file);
            
            new Notice(`Converted legacy file to ${finalPath}`);

            // Open the new file
            const newFile = this.app.vault.getAbstractFileByPath(finalPath);
            if (newFile instanceof TFile) {
                const leaf = this.app.workspace.getLeaf(true);
                await leaf.openFile(newFile);
            }
        } catch (err) {
            console.error(`Colophon: Error converting ${file.path}:`, err);
            new Notice(`Error converting file: ${err.message}`);
        }
    }

    patchCommand(commandId, handler) {
        const command = this.app.commands.commands[commandId];
        if (!command) return;

        const originalCallback = command.callback;
        const originalCheckCallback = command.checkCallback;

        // We replace checkCallback to handle both checking and execution
        command.checkCallback = (checking) => {
            let view = this.app.workspace.getActiveViewOfType(ColophonView);
            
            // If the active leaf is the global sidebar, find the main ColophonView it supports via SidebarManager
            if (!view) {
                const sidebar = this.app.workspace.getLeavesOfType('colophon-sidebar').find(l => l.isActive() || l.view?.containerEl?.contains(document.activeElement));
                if (sidebar && this.sidebarManager && this.sidebarManager.activeView) {
                    view = this.sidebarManager.activeView;
                }
            }

            if (view && view.adapter) {
                if (!checking) {
                    handler(view);
                }
                return true;
            }

            // Fallback to original
            if (originalCheckCallback) {
                return originalCheckCallback(checking);
            }
            if (originalCallback && !checking) {
                originalCallback();
                return true; // assumed
            }
            return false;
        };

        // Clear simple callback to ensure checkCallback is used
        if (command.callback) command.callback = null;
    }

    async saveSettings() {
        await this.saveData(this.settings);
        // Reactively update styles
        if (this.styleManager) {
            this.styleManager.applyStyles(this.settings);
        }

        // Update all open views
        this.app.workspace.getLeavesOfType(VIEW_TYPE_COLOPHON).forEach(leaf => {
            if (leaf.view && typeof leaf.view.updateSettings === 'function') {
                leaf.view.updateSettings();
            }
        });
    }

    onunload() {
        if (this.sidebarManager) {
            this.sidebarManager.destroy();
        }
    }

    async createNewColophonFile(type, folderPath = '') {
        // Determine filename
        let baseName = 'Untitled';
        let path = folderPath ? `${folderPath}/${baseName}.colophon` : `${baseName}.colophon`;
        let count = 1;

        // Simple duplicate check
        while (await this.app.vault.adapter.exists(path)) {
            path = folderPath
                ? `${folderPath}/${baseName} ${count}.colophon`
                : `${baseName} ${count}.colophon`;
            count++;
        }

        // Initial Data Structure
        const initialData = {
            type: type,
            doc: {
                type: 'doc',
                content: [
                    {
                        type: 'body',
                        content: []
                    }
                ]
            }
        };

        // Create and Open
        try {
            const file = await this.app.vault.create(path, JSON.stringify(initialData, null, 2));
            const leaf = this.app.workspace.getLeaf(true);
            await leaf.openFile(file);

            // Allow the generic file open handling to finish, then reveal and prompt
            setTimeout(() => {
                const explorerLeaf = this.app.workspace.getLeavesOfType('file-explorer')[0];
                if (explorerLeaf) {
                    this.app.workspace.revealLeaf(explorerLeaf); // focus sidebar
                    // Access view directly to select file if public API insufficient,
                    // but openFile usually selects it. We explicitly reveal to ensure scroll.
                    if (explorerLeaf.view && explorerLeaf.view.revealInFolder) {
                        explorerLeaf.view.revealInFolder(file);
                    }
                }

                new FileNameModal(this.app, file, async (newName) => {
                    const newPath = folderPath ? `${folderPath}/${newName}.colophon` : `${newName}.colophon`;
                    await this.app.fileManager.renameFile(file, newPath);
                }).open();
            }, 100);

        } catch (err) {
            console.error('Failed to create Colophon file:', err);
        }
    }

    refreshLayout() {
        const isGlobal = this.settings.sidebarLocation === 'global';

        // 1. Notify all open ColophonViews to refresh their local sidebar visibility
        this.app.workspace.getLeavesOfType(VIEW_TYPE_COLOPHON).forEach(leaf => {
            if (leaf.view instanceof ColophonView) {
                leaf.view.refreshSidebarVisibility();
            }
        });

        // 2. If transitioning to local, remove the global sidebar leaf
        if (!isGlobal) {
            this.app.workspace.getLeavesOfType(VIEW_TYPE_COLOPHON_SIDEBAR).forEach(leaf => {
                leaf.detach();
            });
        }

        // 3. Notify the global sidebar to refresh its content
        if (this.sidebarManager) {
            this.sidebarManager.update();
        }
    }

    async openSidebar() {
        const { workspace } = this.app;

        let leaf = null;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_COLOPHON_SIDEBAR);

        if (leaves.length > 0) {
            leaf = leaves[0];
        } else {
            leaf = workspace.getRightLeaf(false);
            await leaf.setViewState({ type: VIEW_TYPE_COLOPHON_SIDEBAR, active: true });
        }

        workspace.revealLeaf(leaf);
    }

    async convertLegacyManuscriptFiles() {
        const files = this.app.vault.getFiles().filter(f => f.extension === 'md');

        const legacyFiles = [];
        for (const file of files) {
            const cache = this.app.metadataCache.getCache(file.path);
            if (cache?.frontmatter?.['colophon-plugin'] === 'manuscript') {
                legacyFiles.push(file);
            }
        }

        if (legacyFiles.length === 0) {
            new Notice('No legacy manuscript files found.');
            return;
        }

        const results = { converted: 0, skipped: 0, errors: [] };

        for (const file of legacyFiles) {
            try {
                const content = await this.app.vault.read(file);
                const parsed = this.parseLegacyFormat(content);

                if (!parsed) {
                    results.skipped++;
                    results.errors.push({ file: file.path, error: 'Failed to parse colophon data block' });
                    console.error(`Colophon: Failed to parse legacy file: ${file.path}`);
                    continue;
                }

                const transformed = this.transformLegacyData(parsed);

                const newPath = file.path.replace(/\.md$/, '.colophon');

                if (await this.app.vault.adapter.exists(newPath)) {
                    let counter = 1;
                    let basePath = newPath.replace('.colophon', '');
                    while (await this.app.vault.adapter.exists(`${basePath} ${counter}.colophon`)) {
                        counter++;
                    }
                    await this.app.vault.create(`${basePath} ${counter}.colophon`, JSON.stringify(transformed, null, 2));
                } else {
                    await this.app.vault.create(newPath, JSON.stringify(transformed, null, 2));
                }

                await this.app.vault.delete(file);

                results.converted++;
            } catch (err) {
                results.errors.push({ file: file.path, error: err.message });
                console.error(`Colophon: Error converting ${file.path}:`, err);
            }
        }

        let message = `Converted ${results.converted} files.`;
        if (results.skipped > 0) {
            message += ` ${results.skipped} skipped.`;
        }
        if (results.errors.length > 0) {
            message += ` ${results.errors.length} errors.`;
        }
        new Notice(message);

        if (results.errors.length > 0) {
            console.error('Colophon: Legacy conversion errors:', results.errors);
        }
    }

    parseLegacyFormat(content) {
        // Find the block starting with %% colophon:data { and ending with } %%
        // Use greedy match for the content between the first { and the last }
        const match = content.match(/%% colophon:data\s*(\{[\s\S]*\})\s*%%/);
        if (!match) return null;

        try {
            return JSON.parse(match[1]);
        } catch (err) {
            console.error('Colophon: Failed to parse legacy data block:', err);
            return null;
        }
    }

    transformLegacyData(data) {
        this.migrateContentNodes(data.doc);

        if (Array.isArray(data.footnotes)) {
            const footnotes = {};
            data.footnotes.forEach((fn) => {
                const id = fn.id || `fn-${crypto.randomUUID()}`;
                const content = fn.content || { type: 'doc', content: [{ type: 'body' }] };
                this.migrateContentNodes(content);
                // In 2.x, we only store the content object in the footnotes dictionary
                footnotes[id] = content;
            });
            data.footnotes = footnotes;
        } else {
            data.footnotes = data.footnotes || {};
        }

        if (Array.isArray(data.comments)) {
            const comments = {};
            data.comments.forEach((comment) => {
                const id = comment.id || `comment-${crypto.randomUUID()}`;
                if (comment.content) {
                    this.migrateContentNodes(comment.content);
                }
                // Ensure replies array exists for v2.0
                if (!comment.replies) {
                    comment.replies = [];
                }
                comments[id] = [comment];
            });
            data.comments = comments;
        } else {
            data.comments = data.comments || {};
        }

        return {
            type: 'manuscript',
            doc: data.doc,
            footnotes: data.footnotes,
            comments: data.comments
        };
    }

    migrateContentNodes(node) {
        if (!node) return;

        // Generate a simple 6-char random ID for v2.0 blocks
        const generateId = () => Math.random().toString(36).substring(2, 8);

        const blockClass = node.attrs?.class;
        const validTypes = ['body', 'supertitle', 'title', 'subtitle', 'epigraph', 'body-first', 'footnote', 'heading-1', 'heading-2', 'heading-3'];
        const legacyMsoClasses = ['MsoNormal', 'MsoNoSpacing', 'MsoFootnoteText', 'MsoListParagraph'];

        // 1. Handle Block Conversion (v1.x -> v2.0)
        if (node.type === 'paragraph' || node.type === 'blockquote' || node.type === 'codeBlock' || node.type === 'listItem' || (blockClass && legacyMsoClasses.includes(blockClass))) {
            if (blockClass && validTypes.includes(blockClass)) {
                node.type = blockClass;
            } else {
                node.type = 'body';
            }
            
            // Ensure every block has a unique ID for v2.0
            if (!node.attrs) node.attrs = {};
            node.attrs.id = generateId();
            delete node.attrs.class;
        } else if (node.type === 'heading') {
            const level = node.attrs?.level;
            if (blockClass === 'title') {
                node.type = 'title';
            } else if (level) {
                node.type = `heading-${level}`;
            } else {
                node.type = 'heading-1';
            }

            if (!node.attrs) node.attrs = {};
            node.attrs.id = generateId();
            delete node.attrs.level;
            delete node.attrs.class;
        } else if (node.type === 'footnote') {
            node.type = 'footnoteMarker';
        }

        // 2. Handle marks on the current node's content (if it's a text container)
        // We only call migrateMarks if this node is one that contains text nodes
        const inlineContainers = ['body', 'title', 'subtitle', 'supertitle', 'epigraph', 'body-first', 'footnote', 'footnoteMarker', 'heading-1', 'heading-2', 'heading-3', 'paragraph', 'listItem'];
        if (inlineContainers.includes(node.type) || node.type.startsWith('heading-')) {
            this.migrateMarks(node);
        }

        // 3. Flatten Lists and Recurse
        if (node.content && Array.isArray(node.content)) {
            // A. Flatten standard lists
            const processedContent = [];
            for (const child of node.content) {
                if (child.type === 'bulletList' || child.type === 'orderedList') {
                    if (child.content && Array.isArray(child.content)) {
                        for (const listItem of child.content) {
                            if (listItem.type === 'listItem' && listItem.content) {
                                // Important: We recurse into listItem content BEFORE flattening
                                listItem.content.forEach(c => this.migrateContentNodes(c));
                                processedContent.push(...listItem.content);
                            }
                        }
                    }
                } else {
                    processedContent.push(child);
                }
            }
            node.content = processedContent;

            // B. Recurse into all children (except those already processed by flattening)
            node.content.forEach(child => {
                // If the child is not a body block with an id (which would mean it was already processed above)
                if (!child.attrs?.id || !validTypes.includes(child.type)) {
                    this.migrateContentNodes(child);
                }
            });
        }
    }

    migrateMarks(node) {
        if (!node || !node.content || !Array.isArray(node.content)) return;

        const newContent = [];
        
        for (const child of node.content) {
            // 1. Handle legacy 'internallink' marks or 'link' marks with 'internal-link' class
            const linkMark = child.marks?.find(m => 
                m.type === 'internallink' || 
                (m.type === 'link' && m.attrs?.class === 'internal-link')
            );
            
            if (linkMark && child.type === 'text') {
                newContent.push({
                    type: 'internalLink',
                    attrs: {
                        target: linkMark.attrs?.href || '',
                        alias: linkMark.attrs?.text || child.text || ''
                    }
                });
                continue; // Link becomes a new node
            }

            // 2. Handle other marks (migrate legacy ones)
            if (child.marks) {
                child.marks = child.marks.map(mark => {
                    if (mark.type === 'comment') {
                        return {
                            type: 'commentHighlight',
                            attrs: {
                                threadId: mark.attrs?.id || mark.attrs?.threadId
                            }
                        };
                    }
                    return mark;
                });

                // Filter out link marks converted to nodes
                child.marks = child.marks.filter(m => 
                    m.type !== 'internallink' && 
                    !(m.type === 'link' && m.attrs?.class === 'internal-link')
                );
                
                if (child.marks.length === 0) {
                    delete child.marks;
                }
            }
            
            // NOTE: We REMOVED the recursive call to migrateMarks here, 
            // because migrateContentNodes now handles the full tree walking properly.
            
            newContent.push(child);
        }
        
        node.content = newContent;
    }
}

class FileNameModal extends Modal {
    constructor(app, file, onSubmit) {
        super(app);
        this.file = file;
        this.onSubmit = onSubmit;
        this.basename = file.basename;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        const inputHeader = contentEl.createDiv({ cls: 'modal-header' })
        inputHeader.createEl('div', { cls: 'modal-title', text: 'File name' });

        const inputContainer = contentEl.createDiv({ cls: 'modal-content' });

        const input = inputContainer.createEl('input', {
            type: 'text',
            value: this.basename
        });

        input.style.width = '100%';
        input.style.marginBottom = '1rem';

        // Select all text on open for easy overwrite, matching standard behavior
        input.select();

        const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'flex-end';
        buttonContainer.style.gap = '10px';

        const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
        const saveButton = buttonContainer.createEl('button', { cls: 'mod-cta', text: 'Save' });

        cancelButton.addEventListener('click', () => this.close());

        const submit = () => {
            const value = input.value.trim();
            if (value && value !== this.basename) {
                this.onSubmit(value);
            }
            this.close();
        };

        saveButton.addEventListener('click', submit);

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                submit();
            } else if (e.key === 'Escape') {
                this.close();
            }
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
