const { Plugin, TFolder, Notice, normalizePath } = require('obsidian');
const { ColophonView, VIEW_TYPE } = require('./view');

module.exports = class ColophonPlugin extends Plugin {
    async onload() {
        // Register the custom view
        this.registerView(
            VIEW_TYPE,
            (leaf) => new ColophonView(leaf)
        );

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

    async handleActiveLeafChange(leaf) {
        // Safety check
        if (!leaf) return;

        // Get the file in the active leaf
        const file = leaf.view.file;
        if (!file) return;

        // Check the view type and frontmatter
        await this.ensureCorrectView(leaf, file);
    }

    async handleFileOpen(file) {
        // Safety check: make sure a file is actually loaded
        if (!file) return;

        // Get the active leaf (tab)
        const leaf = this.app.workspace.activeLeaf;
        if (!leaf) return;

        await this.ensureCorrectView(leaf, file);
    }

    async ensureCorrectView(leaf, file) {
        // Check the file's frontmatter cache
        const cache = this.app.metadataCache.getFileCache(file);

        // Check if frontmatter exists and has our key
        const isColophon = cache?.frontmatter && cache.frontmatter['colophon-plugin'] === 'manuscript';
        const currentViewType = leaf.view.getViewType();

        // SCENARIO 1: It's a manuscript, but currently in default markdown mode.
        // ACTION: Swap to Colophon View.
        if (isColophon && currentViewType === 'markdown') {
            // We preserve the state (scroll position, cursor) when swapping
            // Note: Tiptap might not respect MarkdownView state 1:1, but we pass it anyway.
            const state = leaf.view.getState();
            await leaf.setViewState({
                type: VIEW_TYPE,
                state: state,
                active: true // Make it the active tab
            });
        }

        // SCENARIO 2: It's a regular file, but stuck in Colophon View.
        // ACTION: Swap back to default Markdown View.
        else if (!isColophon && currentViewType === VIEW_TYPE) {
            const state = leaf.view.getState();
            await leaf.setViewState({
                type: 'markdown',
                state: state,
                active: true
            });
        }
    }

    async createNewManuscript(folder) {
        // Determine target folder: use provided folder or default location
        let target;

        if (folder) {
            // If folder is a string path, get the TFolder object
            if (typeof folder === 'string') {
                target = this.app.vault.getAbstractFileByPath(folder);
            } else {
                target = folder;
            }
        } else {
            target = this.app.fileManager.getNewFileParent(
                this.app.workspace.getActiveFile()?.path || ''
            );
        }

        // Ensure we have a valid folder
        if (!target || !target.path) {
            new Notice('Invalid folder location');
            return;
        }

        // Define the initial content with required frontmatter
        const initialContent = "---\ncolophon-plugin: manuscript\n---\n\nStart writing here...";

        // Find an available filename
        const finalPath = await this.getUniqueFilePath(target);

        try {
            // Create the new file
            const newFile = await this.app.vault.create(finalPath, initialContent);

            // Open the newly created file
            // Obsidian will trigger 'file-open', which will trigger our handleFileOpen,
            // which will swap the view to ColophonView.
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
        // Clean up acts are handled automatically by registerView/registerEvent usually
    }
};