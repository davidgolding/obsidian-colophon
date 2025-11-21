const { Plugin, TFolder, Notice, normalizePath, WorkspaceLeaf, PluginSettingTab, Setting } = require('obsidian');
const { ColophonView, VIEW_TYPE } = require('./view');

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

        // Add Settings Tab
        this.addSettingTab(new ColophonSettingTab(this.app, this));

        // PATCH: Intercept WorkspaceLeaf.openFile to prevent FOUC (Flash of Unstyled Content)
        this.patchOpenFile();

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