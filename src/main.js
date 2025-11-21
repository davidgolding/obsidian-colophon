const { Plugin, TFolder, Notice, normalizePath, WorkspaceLeaf, PluginSettingTab, Setting } = require('obsidian');
const { ColophonView, VIEW_TYPE } = require('./view');
const { ColophonSidebarView, SIDEBAR_VIEW_TYPE } = require('./sidebar-view');

const DEFAULT_SETTINGS = {
    textColumnWidth: 1080
};

module.exports = class ColophonPlugin extends Plugin {
    async onload() {
        await this.loadSettings();

        // Register the custom view
        this.registerView(
            VIEW_TYPE,
            (leaf) => new ColophonView(leaf, this.settings)
        );

        // Register the sidebar view
        this.registerView(
            SIDEBAR_VIEW_TYPE,
            (leaf) => new ColophonSidebarView(leaf)
        );

        // Add Settings Tab
        this.addSettingTab(new ColophonSettingTab(this.app, this));

        // Patch WorkspaceLeaf.openFile to intercept manuscript files
        this.patchOpenFile();

        // Intercept "Insert Footnote" command
        this.app.workspace.onLayoutReady(() => {
            const originalCommand = this.app.commands.commands['editor:insert-footnote'];
            if (originalCommand) {
                this.originalInsertFootnoteCallback = originalCommand.callback;
                this.originalInsertFootnoteCheckCallback = originalCommand.checkCallback;

                // Override
                originalCommand.callback = () => {
                    const view = this.app.workspace.getActiveViewOfType(ColophonView);
                    if (view) {
                        view.addFootnote();
                    } else if (this.originalInsertFootnoteCallback) {
                        this.originalInsertFootnoteCallback();
                    }
                };

                originalCommand.checkCallback = (checking) => {
                    const view = this.app.workspace.getActiveViewOfType(ColophonView);
                    if (view) {
                        if (!checking) {
                            view.addFootnote();
                        }
                        return true;
                    }
                    if (this.originalInsertFootnoteCheckCallback) {
                        return this.originalInsertFootnoteCheckCallback(checking);
                    }
                    return false;
                };
            }
        });

        // EVENT LISTENER: Handle file opening (initial opens)
        this.registerEvent(
            this.app.workspace.on('file-open', this.handleFileOpen.bind(this))
        );

        // EVENT LISTENER: Handle switching between tabs
        this.registerEvent(
            this.app.workspace.on('active-leaf-change', this.handleActiveLeafChange.bind(this))
        );

        // RIBBON ICON: Create new Manuscript
        this.addRibbonIcon('feather', 'New manuscript', async () => {
            await this.createNewManuscript();
        });

        // FILE MENU: Add "New Manuscript" to context menu
        this.registerEvent(
            this.app.workspace.on('file-menu', (menu, file) => {
                const isFolder = file instanceof TFolder;
                const path = isFolder ? file.path : file.parent.path;

                menu.addItem((item) => {
                    item
                        .setTitle("New manuscript")
                        .setIcon("feather")
                        .onClick(async () => {
                            await this.createNewManuscript(path);
                        });
                });
            })
        );

        // COMMAND: Add "New manuscript" to command list
        this.addCommand({
            id: 'create-new-colophon-manuscript',
            name: 'New manuscript',
            callback: () => this.createNewManuscript()
        });

        // COMMAND: Toggle Footnotes Sidebar
        this.addCommand({
            id: 'toggle-colophon-sidebar',
            name: 'Toggle Footnotes Sidebar',
            callback: async () => {
                const { workspace } = this.app;
                let leaf = null;
                const leaves = workspace.getLeavesOfType(SIDEBAR_VIEW_TYPE);

                if (leaves.length > 0) {
                    // A leaf with our view already exists, use that
                    leaf = leaves[0];
                    workspace.revealLeaf(leaf);
                } else {
                    // Our view could not be found in the workspace, create a new leaf
                    // in the right sidebar for it
                    leaf = workspace.getRightLeaf(false);
                    await leaf.setViewState({ type: SIDEBAR_VIEW_TYPE, active: true });
                }
                workspace.revealLeaf(leaf);
            },
        });
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        // Trigger update in active views
        this.app.workspace.getLeavesOfType(VIEW_TYPE).forEach(leaf => {
            if (leaf.view instanceof ColophonView) {
                leaf.view.updateSettings(this.settings);
            }
        });
    }

    patchOpenFile() {
        const plugin = this;
        const originalOpenFile = WorkspaceLeaf.prototype.openFile;

        WorkspaceLeaf.prototype.openFile = async function (file, openState) {
            const app = this.app || plugin.app;
            const cache = app.metadataCache.getFileCache(file);

            if (cache?.frontmatter && cache.frontmatter['colophon-plugin'] === 'manuscript') {
                const currentViewType = this.view.getViewType();

                if (currentViewType !== VIEW_TYPE) {
                    await this.setViewState({
                        type: VIEW_TYPE,
                        state: openState,
                        active: true
                    });
                }

                if (this.view instanceof ColophonView) {
                    await this.view.loadFile(file);
                    if (openState && openState.eState) {
                        this.view.setEphemeralState(openState.eState);
                    }
                    return;
                }
            }
            return originalOpenFile.call(this, file, openState);
        };

        this.register(() => {
            WorkspaceLeaf.prototype.openFile = originalOpenFile;
        });
    }

    async handleActiveLeafChange(leaf) {
        if (!leaf) return;
        const file = leaf.view.file;
        if (!file) return;
        await this.ensureCorrectView(leaf, file);
    }

    async handleFileOpen(file) {
        if (!file) return;
        const leaf = this.app.workspace.activeLeaf;
        if (!leaf) return;
        await this.ensureCorrectView(leaf, file);
    }

    async ensureCorrectView(leaf, file) {
        const cache = this.app.metadataCache.getFileCache(file);
        const isColophon = cache?.frontmatter && cache.frontmatter['colophon-plugin'] === 'manuscript';
        const currentViewType = leaf.view.getViewType();

        if (isColophon && currentViewType === 'markdown') {
            const state = leaf.view.getState();
            await leaf.setViewState({
                type: VIEW_TYPE,
                state: state,
                active: true
            });
        } else if (!isColophon && currentViewType === VIEW_TYPE) {
            const state = leaf.view.getState();
            await leaf.setViewState({
                type: 'markdown',
                state: state,
                active: true
            });
        }
    }

    async createNewManuscript(folder) {
        let target;
        if (folder) {
            target = typeof folder === 'string' ? this.app.vault.getAbstractFileByPath(folder) : folder;
        } else {
            target = this.app.fileManager.getNewFileParent(
                this.app.workspace.getActiveFile()?.path || ''
            );
        }

        if (!target || !target.path) {
            new Notice('Invalid folder location');
            return;
        }

        const initialContent = `---
colophon-plugin: manuscript
---
`;
        const finalPath = await this.getUniqueFilePath(target);

        try {
            const newFile = await this.app.vault.create(finalPath, initialContent);
            await this.app.workspace.getLeaf(false).openFile(newFile);
        } catch (e) {
            new Notice(`Failed to create manuscript: ${e.toString()}`);
        }
    }

    async getUniqueFilePath(folder) {
        let counter = 0;
        while (true) {
            const suffix = counter === 0 ? '' : ` ${counter}`;
            const fileName = `Untitled${suffix}.md`;
            const filePath = normalizePath(`${folder.path}/${fileName}`);
            if (!await this.app.vault.exists(filePath)) {
                return filePath;
            }
            counter++;
        }
    }

    onunload() {
    }
};

class ColophonSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Colophon Settings' });

        new Setting(containerEl)
            .setName('Text Column Width')
            .setDesc('Adjust the width of the writing canvas (500px - 1240px).')
            .addSlider(slider => slider
                .setLimits(500, 1240, 10)
                .setValue(this.plugin.settings.textColumnWidth)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.textColumnWidth = value;
                    await this.plugin.saveSettings();
                }));
    }
}