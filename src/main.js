import { Plugin, TFolder, Modal } from 'obsidian';
import { ColophonView, VIEW_TYPE_COLOPHON } from './view';
import { DEFAULT_SETTINGS } from './settings-data';
import { StyleManager } from './style-manager';
import { ColophonSettingTab } from './settings-tab';
import { MetadataManager } from './metadata-manager';

export default class ColophonPlugin extends Plugin {
    async onload() {
        // Load Settings
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

        // Initialize Metadata Manager
        this.metadataManager = new MetadataManager(this);
        this.metadataManager.setup();

        // Initialize Style Manager
        this.styleManager = new StyleManager();
        this.styleManager.applyStyles(this.settings);

        this.addSettingTab(new ColophonSettingTab(this.app, this));

        // 1. Register the View
        this.registerView(
            VIEW_TYPE_COLOPHON,
            (leaf) => new ColophonView(leaf, this)
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
            id: 'new-script',
            name: 'New Script',
            callback: () => this.createNewColophonFile('script')
        });

        this.addCommand({
            id: 'insert-internal-link',
            name: 'Insert Internal Link',
            checkCallback: (checking) => {
                const view = this.app.workspace.getActiveViewOfType(ColophonView);
                if (view && view.adapter) {
                    if (!checking) {
                        // This will trigger the suggester by inserting '[[', 
                        // or we could eventually add a prompt.
                        // For agent-native parity, inserting the trigger is usually best.
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
                    // Disable in Script Mode as per plan
                    if (view.docType === 'script') return false;

                    if (!checking) {
                        const id = `fn-${crypto.randomUUID()}`;
                        view.adapter.editor.chain().focus().insertContent({
                            type: 'footnoteMarker',
                            attrs: { id }
                        }).run();
                        
                        // Open panel and focus
                        view.toggleFootnotes();
                        view.adapter.focusNote(id);
                    }
                    return true;
                }
                return false;
            }
        });

        // 5. Context Menu (File Explorer)
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
                    menu.addItem((item) => {
                        item
                            .setTitle('New script')
                            .setIcon('clapperboard')
                            .onClick(async () => {
                                await this.createNewColophonFile('script', file.path);
                            });
                    });
                }
            })
        );

        // 6. Patch Native Commands
        this.app.workspace.onLayoutReady(() => {
            this.patchCommand('editor:toggle-bold', (adapter) => adapter.toggleBold());
            this.patchCommand('editor:toggle-italics', (adapter) => adapter.toggleItalic());
            this.patchCommand('editor:toggle-strikethrough', (adapter) => adapter.toggleStrike());
        });
    }

    patchCommand(commandId, handler) {
        const command = this.app.commands.commands[commandId];
        if (!command) return;

        const originalCallback = command.callback;
        const originalCheckCallback = command.checkCallback;

        // We replace checkCallback to handle both checking and execution
        command.checkCallback = (checking) => {
            const view = this.app.workspace.getActiveViewOfType(ColophonView);
            if (view && view.adapter) {
                if (!checking) {
                    handler(view.adapter);
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
        // Obsidian doesn't support unpatching cleanly without storing originals globally,
        // but since we modify the app instance, reloading the plugin might leak if not careful.
        // For a simple reload it's usually fine as the app object persists. 
        // Ideally we would restore commands here.
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
