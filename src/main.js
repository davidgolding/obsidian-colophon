import { Plugin, TFolder } from 'obsidian';
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
        let baseName = type === 'script' ? 'Untitled Script' : 'Untitled Manuscript';
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
        } catch (err) {
            console.error('Failed to create Colophon file:', err);
        }
    }
}
