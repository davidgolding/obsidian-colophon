import { TFile, TFolder } from 'obsidian';

export class MetadataManager {
    constructor(plugin) {
        this.plugin = plugin;
        this.app = plugin.app;
        // Move cache into the plugin's own directory so it's deleted on uninstall
        this.cacheFolderName = `${this.app.vault.configDir}/plugins/obsidian-colophon/.colophon-cache`;
        this.oldCacheFolderName = '.colophon-cache'; // For cleanup
    }

    setup() {
        // 1. Initial Indexing of all .colophon files
        this.app.workspace.onLayoutReady(async () => {
            await this.cleanupOldCache();
            await this.ensureCacheFolder();
            await this.indexAllFiles();
        });

        // 2. React to file changes
        this.plugin.registerEvent(
            this.app.vault.on('modify', async (file) => {
                if (file instanceof TFile && file.extension === 'colophon') {
                    await this.indexFile(file);
                }
            })
        );

        // 3. React to renames (to keep internal links valid and sync shadow files)
        this.plugin.registerEvent(
            this.app.vault.on('rename', async (file, oldPath) => {
                if (file instanceof TFile) {
                    if (file.extension === 'colophon') {
                        await this.handleColophonRename(file, oldPath);
                    } else {
                        await this.handleGenericRename(file, oldPath);
                    }
                }
            })
        );

        // 4. React to deletions
        this.plugin.registerEvent(
            this.app.vault.on('delete', async (file) => {
                if (file instanceof TFile && file.extension === 'colophon') {
                    await this.removeShadowFile(file);
                }
            })
        );
    }

    async cleanupOldCache() {
        // Remove the old folder from the vault root if it exists
        if (await this.app.vault.adapter.exists(this.oldCacheFolderName)) {
            try {
                await this.app.vault.adapter.rmdir(this.oldCacheFolderName, true);
            } catch (err) {
                // Silently fail if we can't delete it
            }
        }
    }

    async ensureCacheFolder() {
        if (!(await this.app.vault.adapter.exists(this.cacheFolderName))) {
            // Recursive creation for the path within .obsidian
            const parts = this.cacheFolderName.split('/');
            let currentPath = '';
            for (const part of parts) {
                currentPath = currentPath ? `${currentPath}/${part}` : part;
                if (!(await this.app.vault.adapter.exists(currentPath))) {
                    await this.app.vault.adapter.mkdir(currentPath);
                }
            }
        }
    }

    async indexAllFiles() {
        const files = this.app.vault.getFiles().filter(f => f.extension === 'colophon');
        for (const file of files) {
            await this.indexFile(file);
        }
    }

    async indexFile(file) {
        try {
            const content = await this.app.vault.read(file);
            const data = JSON.parse(content);
            
            const links = [];
            const blockIds = [];

            // Recursive extraction
            this.extractMetadata(data.doc, links, blockIds);

            // Create/Update shadow markdown file for indexing
            await this.updateShadowFile(file, links, blockIds);
        } catch (err) {
            // console.error(`Colophon: Failed to index ${file.path}`, err);
        }
    }

    extractMetadata(node, links, blockIds) {
        if (!node) return;

        // Extract Block IDs
        if (node.attrs && node.attrs.id) {
            blockIds.push(node.attrs.id);
        }

        // Extract Links
        if (node.type === 'internalLink' && node.attrs && node.attrs.target) {
            links.push(node.attrs.target);
        }

        // Recurse content
        if (node.content && Array.isArray(node.content)) {
            node.content.forEach(child => this.extractMetadata(child, links, blockIds));
        }
    }

    async updateShadowFile(file, links, blockIds) {
        const shadowPath = `${this.cacheFolderName}/${file.path.replace(/\//g, '_')}.md`;
        
        // Minimal footprint: Just the links and IDs needed for Obsidian's indexer.
        // We use a flat list to keep the file size as small as possible.
        let mdContent = '';
        
        if (links.length > 0) {
            mdContent += links.map(l => `[[${l}]]`).join(' ');
            mdContent += '\n';
        }
        
        if (blockIds.length > 0) {
            mdContent += blockIds.map(id => `^${id}`).join(' ');
            mdContent += '\n';
        }

        if (await this.app.vault.adapter.exists(shadowPath)) {
            const currentShadow = await this.app.vault.adapter.read(shadowPath);
            if (currentShadow !== mdContent) {
                await this.app.vault.adapter.write(shadowPath, mdContent);
            }
        } else {
            await this.app.vault.adapter.write(shadowPath, mdContent);
        }
    }

    async removeShadowFile(file) {
        const shadowPath = `${this.cacheFolderName}/${file.path.replace(/\//g, '_')}.md`;
        if (await this.app.vault.adapter.exists(shadowPath)) {
            await this.app.vault.adapter.remove(shadowPath);
        }
    }

    async handleColophonRename(file, oldPath) {
        // Delete old shadow file
        const oldShadowPath = `${this.cacheFolderName}/${oldPath.replace(/\//g, '_')}.md`;
        if (await this.app.vault.adapter.exists(oldShadowPath)) {
            await this.app.vault.adapter.remove(oldShadowPath);
        }
        // Create new one
        await this.indexFile(file);
    }

    async handleGenericRename(file, oldPath) {
        // If a non-colophon file is renamed, we need to update any .colophon files that link to it.
        const allFiles = this.app.vault.getFiles().filter(f => f.extension === 'colophon');
        
        for (const colophonFile of allFiles) {
            let content = await this.app.vault.read(colophonFile);
            let data = JSON.parse(content);
            let modified = false;

            const updateLinks = (node) => {
                if (node.type === 'internalLink' && node.attrs && node.attrs.target === oldPath) {
                    node.attrs.target = file.path;
                    modified = true;
                }
                if (node.content && Array.isArray(node.content)) {
                    node.content.forEach(updateLinks);
                }
            };

            updateLinks(data.doc);

            if (modified) {
                await this.app.vault.modify(colophonFile, JSON.stringify(data, null, 2));
                await this.indexFile(colophonFile); // Update shadow file
            }
        }
    }
}
