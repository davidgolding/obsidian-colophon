const { Plugin, MarkdownView, WorkspaceLeaf } = require('obsidian');

const VIEW_TYPE_COLOPHON = 'colophon-view';

// 1. Define the Custom View
// We extend MarkdownView so we inherit the standard editor, search, and hotkeys.
class ColophonView extends MarkdownView {
    constructor(leaf) {
        super(leaf);
    }

    getViewType() {
        return VIEW_TYPE_COLOPHON;
    }

    getDisplayText() {
        return 'Colophon Manuscript';
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
        
        // FUTURE: This is where we will register CodeMirror extensions 
        // specifically for this view instance.
        // this.registerEditorExtension([...]);
    }
}

// 2. Define the Plugin Logic
module.exports = class ColophonPlugin extends Plugin {
    async onload() {
        console.log('Loading Colophon Plugin');

        // Register the custom view
        this.registerView(
            VIEW_TYPE_COLOPHON,
            (leaf) => new ColophonView(leaf)
        );

        // EVENT LISTENER: The "Kanban" Interceptor
        // This listens for any file opening.
        this.registerEvent(
            this.app.workspace.on('file-open', this.handleFileOpen.bind(this))
        );

        // RIBBON ICON: Create new Manuscript
        this.addRibbonIcon('feather', 'New Colophon Manuscript', async () => {
            await this.createNewManuscript();
        });
    }

    async handleFileOpen(file) {
        // Safety check: make sure a file is actually loaded
        if (!file) return;

        // Get the active leaf (tab)
        const leaf = this.app.workspace.activeLeaf;
        if (!leaf) return;

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

    async createNewManuscript() {
        const root = this.app.vault.getRoot().path;
        const filename = `Manuscript ${Date.now()}.md`;
        
        // Define the initial content with the required frontmatter
        const initialContent = `---
colophon-plugin: manuscript
created: ${new Date().toISOString()}
---

# New Manuscript

Start writing here...
`;
        
        // Create the file
        try {
            const file = await this.app.vault.create(filename, initialContent);
            // Open the file (The interceptor above will catch this and set the view correctly)
            await this.app.workspace.getLeaf(true).openFile(file);
        } catch (error) {
            console.error("Error creating manuscript:", error);
            new Notice("Could not create manuscript.");
        }
    }

    onunload() {
        // Clean up acts are handled automatically by registerView/registerEvent usually
    }
};