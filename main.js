const { Plugin, MarkdownView, WorkspaceLeaf, TFolder, TFile, Notice } = require('obsidian');

const VIEW_TYPE_COLOPHON = 'colophon-view';

// 1. Define the Custom View
// We extend MarkdownView so we inherit the standard editor, search, and hotkeys.
class ColophonView extends MarkdownView {
    constructor(leaf) {
        super(leaf);
        this.observer = null;
    }

    getViewType() {
        return VIEW_TYPE_COLOPHON;
    }

    getDisplayText() {
        return this.file ? this.file.basename : 'No File';
    }

    getIcon() {
        return 'feather'; // Icon for the tab header
    }

    async onOpen() {
        // Run the standard MarkdownView load logic first
        await super.onOpen();
        
        // Add a specific class to the container. 
        // We will use this class in styles.css to create the "Paper" look.
        this.containerEl.classList.add('colophon-workspace');
        
        // Find the source-view and suppress properties display
        const sourceView = this.containerEl.querySelector('.markdown-source-view.mod-cm6');
        if (sourceView) {
            this.suppressProperties(sourceView);
        }

        // FUTURE: This is where we will register CodeMirror extensions 
        // specifically for this view instance.
        // this.registerEditorExtension([...]);
    }

    suppressProperties(sourceView) {
        // Remove the class initially
        sourceView.classList.remove('show-properties');
        
        // Create a MutationObserver to watch for when Obsidian tries to add it back
        this.observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    if (sourceView.classList.contains('show-properties')) {
                        sourceView.classList.remove('show-properties');
                    }
                }
            });
        });
        
        // Start observing the sourceView element for class changes
        this.observer.observe(sourceView, {
            attributes: true,
            attributeFilter: ['class']
        });
    }

    async onClose() {
        // Clean up the observer when the view closes
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        await super.onClose();
    }
}

// 2. Define the Plugin Logic
module.exports = class ColophonPlugin extends Plugin {
    async onload() {
        // Register the custom view
        this.registerView(
            VIEW_TYPE_COLOPHON,
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
        
        // COMMAND: Add "New mauscript" to command list
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
            const state = leaf.view.getState();
            await leaf.setViewState({
                type: VIEW_TYPE_COLOPHON,
                state: state,
                active: true // Make it the active tab
            });
        }

        // SCENARIO 2: It's a regular file, but stuck in Colophon View.
        // ACTION: Swap back to default Markdown View.
        else if (!isColophon && currentViewType === VIEW_TYPE_COLOPHON) {
            const state = leaf.view.getState();
            await leaf.setViewState({
                type: 'markdown',
                state: state,
                active: true
            });
        }
    }

    async getUniqueFileName(folderPath, baseName) {
        let fileName = `${baseName}.md`;
        let i = 1;
        while (await this.app.vault.adapter.exists(`${folderPath}/${fileName}`)) {
            fileName = `${baseName} ${i}.md`;
            i++;
        }
        return fileName;
    }

    async createNewManuscript(folderPath) {
        const destFolder = folderPath || this.app.vault.getRoot().path;
        const fileName = await this.getUniqueFileName(destFolder, 'Untitled');
        const filePath = `${destFolder}/${fileName}`;
        
        // Define the initial content with the required frontmatter
        const initialContent = `---
colophon-plugin: manuscript
created: ${new Date().toISOString()}
---

`;
        
        // Create the file
        try {
            const file = await this.app.vault.create(filePath, initialContent);
            // Open the file (The interceptor above will catch this and set the view correctly)
            await this.app.workspace.getLeaf(true).openFile(file);
            if (this.app.workspace.getLeavesOfType(VIEW_TYPE).length === 0) {
                await this.app.workspace.getRightLeaf(false).setViewState({
                    type: VIEW_TYPE
                });
            }
        } catch (error) {
            console.error("Error creating manuscript:", error);
            new Notice("Could not create manuscript.");
        }
    }

    onunload() {
        // Clean up acts are handled automatically by registerView/registerEvent usually
    }
};