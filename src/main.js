import { Plugin, MarkdownView, WorkspaceLeaf, TFolder, TFile, Notice, normalizePath } from 'obsidian';
import { EditorView } from "@codemirror/view";
import { StateEffect } from "@codemirror/state"; // Import StateEffect
import { footnotePlugin, footnoteTransactionFilter, editorViewField, setEditorView } from './footnotes';

const VIEW_TYPE = 'colophon-view';

// 1. Define the Custom View
// We extend MarkdownView so we inherit the standard editor, search, and hotkeys.
class ColophonView extends MarkdownView {
    constructor(leaf) {
        super(leaf);
        this.observer = null;
    }

    getViewType() {
        return VIEW_TYPE;
    }

    getDisplayText() {
        return this.file ? this.file.basename : 'No File';
    }

    getIcon() {
        return 'feather'; // Icon for the tab header
    }

    // Override the editorExtensions getter to provide our CodeMirror extensions
    get editorExtensions() {
        const extensions = [
            footnotePlugin,
            footnoteTransactionFilter,
            // editorViewField should be initialized to null initially.
            // The EditorView instance will be set via effect once it's available.
            editorViewField.init(() => null), 
            EditorView.domEventHandlers({
                // Add any global event handlers here if needed
            }),
            EditorView.updateListener.of((update) => {
                // if (update.docChanged) {
                //     console.log('Doc changed in ColophonView', update);
                // }
            })
        ];
        return extensions;
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

        // After super.onOpen(), this.editor.cm should be available
        if (this.editor && this.editor.cm) {
            const editorView = this.editor.cm;
            console.log("ColophonView.onOpen: Dispatching setEditorView effect.");
            editorView.dispatch({
                effects: setEditorView.of(editorView)
            });
        } else {
            console.error("ColophonView.onOpen: this.editor.cm is not available after super.onOpen().");
        }
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
export default class ColophonPlugin extends Plugin {
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
        const initialContent = "---\ncolophon-plugin: manuscript\n---\n\n";
        
        // Find an available filename
        const finalPath = await this.getUniqueFilePath(target);
        
        try {
            // Create the new file
            const newFile = await this.app.vault.create(finalPath, initialContent);
            
            // Open the custom view if not already open
            await this.ensureViewOpen();
            
            // Optional: Open the newly created file
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
    
    async ensureViewOpen() {
        if (this.app.workspace.getLeavesOfType(VIEW_TYPE).length === 0) {
            await this.app.workspace.getRightLeaf(false).setViewState({
                type: VIEW_TYPE
            });
        }
    }

    onunload() {
        // Clean up acts are handled automatically by registerView/registerEvent usually
    }
};