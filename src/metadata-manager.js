import { TFile, TFolder, normalizePath } from 'obsidian';

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

            // Extract from footnotes
            if (data.footnotes) {
                for (const footnoteContent of Object.values(data.footnotes)) {
                    this.extractMetadata(footnoteContent, links, blockIds);
                }
            }

            // Extract from comments
            if (data.comments) {
                for (const thread of Object.values(data.comments)) {
                    if (Array.isArray(thread)) {
                        thread.forEach(comment => {
                            if (comment.content) {
                                this.extractMetadata(comment.content, links, blockIds);
                            }
                        });
                    }
                }
            }

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
        const shadowPath = this.getShadowPath(file.path);
        
        // Minimal footprint: Just the links and IDs needed for Obsidian's indexer.
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

    getShadowPath(colophonPath) {
        // Use a reversible but filesystem-safe encoding for the path.
        // Base64 is good but can contain '/', so we replace it.
        const safeName = btoa(colophonPath).replace(/\//g, '_').replace(/=/g, '');
        return normalizePath(`${this.cacheFolderName}/${safeName}.md`);
    }

    getColophonPathFromShadow(shadowPath) {
        const fileName = shadowPath.split('/').pop().replace('.md', '');
        // Restore base64 padding and decode
        try {
            // Basic base64 restoration (adding back == if needed)
            let b64 = fileName.replace(/_/g, '/');
            while (b64.length % 4) b64 += '=';
            return atob(b64);
        } catch (e) {
            return null;
        }
    }

    async removeShadowFile(file) {
        const shadowPath = this.getShadowPath(file.path);
        if (await this.app.vault.adapter.exists(shadowPath)) {
            await this.app.vault.adapter.remove(shadowPath);
        }
    }

    async handleColophonRename(file, oldPath) {
        // Delete old shadow file
        const oldShadowPath = this.getShadowPath(oldPath);
        if (await this.app.vault.adapter.exists(oldShadowPath)) {
            await this.app.vault.adapter.remove(oldShadowPath);
        }
        // Create new one
        await this.indexFile(file);
    }

    async handleGenericRename(file, oldPath) {
        // Optimize: Use metadataCache to find only files that link to the old path
        const resolvedLinks = this.app.metadataCache.resolvedLinks;
        const affectedColophonPaths = new Set();

        for (const [sourcePath, links] of Object.entries(resolvedLinks)) {
            // Check if this source file links to the renamed file
            if (links[oldPath] !== undefined) {
                // Check if the source file is one of our shadow files
                if (sourcePath.startsWith(this.cacheFolderName)) {
                    const colophonPath = this.getColophonPathFromShadow(sourcePath);
                    if (colophonPath) {
                        affectedColophonPaths.add(colophonPath);
                    }
                }
            }
        }

        for (const colophonPath of affectedColophonPaths) {
            const colophonFile = this.app.vault.getAbstractFileByPath(colophonPath);
            if (!(colophonFile instanceof TFile)) continue;

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
            
            // Also update links in footnotes
            if (data.footnotes) {
                for (const footnoteContent of Object.values(data.footnotes)) {
                    updateLinks(footnoteContent);
                }
            }

            // Also update links in comments
            if (data.comments) {
                for (const thread of Object.values(data.comments)) {
                    if (Array.isArray(thread)) {
                        thread.forEach(comment => {
                            if (comment.content) {
                                updateLinks(comment.content);
                            }
                        });
                    }
                }
            }

            if (modified) {
                await this.app.vault.modify(colophonFile, JSON.stringify(data, null, 2));
                await this.indexFile(colophonFile); // Update shadow file
            }
        }
    }
}
