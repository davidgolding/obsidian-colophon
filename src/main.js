import { Plugin, TFolder, Modal } from 'obsidian';
import { ColophonView, VIEW_TYPE_COLOPHON } from './view';

export default class ColophonPlugin extends Plugin {
    async onload() {
        // 1. Register the View
        this.registerView(
            VIEW_TYPE_COLOPHON,
            (leaf) => new ColophonView(leaf)
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
    }

    onunload() {
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
                        type: 'paragraph',
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
