const { Plugin, TFolder, Notice, normalizePath, WorkspaceLeaf, PluginSettingTab, Setting } = require('obsidian');
const { ColophonView, VIEW_TYPE } = require('./view');
const { FootnoteView, FOOTNOTE_VIEW_TYPE } = require('./footnote-view');

const DEFAULT_SETTINGS = {
    textColumnWidth: 1080,
    textColumnBottomPadding: 25, // Default to 25%
    smartQuotes: true,
    smartDashes: true,
    doubleQuoteStyle: '“|”',
    singleQuoteStyle: '‘|’'
};

const { DocxSerializer } = require('prosemirror-docx/dist/esm/index.js');
const { Packer, HeadingLevel, Paragraph, TextRun, FootnoteReferenceRun, StyleLevel } = require('docx');
const fs = require('fs');
const electron = require('electron');

module.exports = class ColophonPlugin extends Plugin {
    async onload() {
        await this.loadSettings();

        // Register the custom view
        this.registerView(
            VIEW_TYPE,
            (leaf) => new ColophonView(leaf, this.settings, this)
        );

        // Register Footnote View
        this.registerView(
            FOOTNOTE_VIEW_TYPE,
            (leaf) => new FootnoteView(leaf, this.settings)
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

        // COMMAND: Export to DOCX
        this.addCommand({
            id: 'export-to-docx',
            name: 'Export to DOCX',
            callback: () => this.exportToDocx()
        });

        // COMMAND: Open Footnotes View
        this.addCommand({
            id: 'open-colophon-footnotes',
            name: 'Open Footnotes Sidebar',
            callback: async () => {
                this.activateFootnoteView();
            }
        });

        // COMMAND: Insert Footnote
        this.addCommand({
            id: 'insert-colophon-footnote',
            name: 'Insert Footnote',
            checkCallback: (checking) => {
                const view = this.app.workspace.getActiveViewOfType(ColophonView);
                if (view) {
                    if (!checking) {
                        view.insertFootnote();
                    }
                    return true;
                }
                return false;
            }
        });

        // INTERCEPT: Native "Insert Footnote" command and formatting commands
        // We cannot remove the command as it breaks the native menu item.
        // Instead, we will try to monkey-patch the existing command's checkCallback
        // to allow it to run when ColophonView is active.

        this.app.workspace.onLayoutReady(() => {
            // Helper to patch commands
            const patchCommand = (commandId, action) => {
                const originalCommand = this.app.commands.commands[commandId];
                if (originalCommand) {
                    const originalCheckCallback = originalCommand.checkCallback;

                    originalCommand.checkCallback = (checking) => {
                        // A Colophon view must exist, but doesn't have to be active
                        const colophonLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
                        const colophonView = colophonLeaves.length > 0 ? colophonLeaves[0].view : null;

                        // Check if we are in a Colophon context
                        if (colophonView) {
                            const footnoteView = this.app.workspace.getLeavesOfType(FOOTNOTE_VIEW_TYPE)[0]?.view;

                            // Determine target editor
                            let targetEditor = null;

                            // 1. Check Footnote Sidebar Focus
                            // We need to check if the sidebar *itself* is the active leaf's view
                            const activeLeaf = this.app.workspace.activeLeaf;
                            if (footnoteView && footnoteView instanceof FootnoteView && activeLeaf.view === footnoteView) {
                                const focusedFootnoteEditor = footnoteView.getFocusedEditor();
                                if (focusedFootnoteEditor) {
                                    targetEditor = focusedFootnoteEditor;
                                }
                            }

                            // 2. Check Main View Focus (fallback or if active)
                            if (!targetEditor && colophonView.adapter && colophonView.adapter.editor && colophonView.adapter.editor.isFocused) {
                                targetEditor = colophonView.adapter.editor;
                            }

                            // If we found a target editor in our plugin, handle the command
                            if (targetEditor) {
                                if (!checking) {
                                    action(targetEditor);
                                }
                                return true;
                            }
                        }

                        // Fallback to original
                        if (originalCheckCallback) {
                            return originalCheckCallback(checking);
                        }
                        return false;
                    };
                }
            };

            // Patch Insert Footnote
            patchCommand('editor:insert-footnote', (editor) => {
                const colophonView = this.app.workspace.getActiveViewOfType(ColophonView);
                if (colophonView) colophonView.insertFootnote();
            });

            // Patch Formatting Commands
            patchCommand('editor:toggle-bold', (editor) => editor.chain().focus().toggleBold().run());
            patchCommand('editor:toggle-italics', (editor) => editor.chain().focus().toggleItalic().run());
            patchCommand('editor:toggle-strikethrough', (editor) => editor.chain().focus().toggleStrike().run());
            // patchCommand('editor:toggle-code', (editor) => editor.chain().focus().toggleCode().run()); // If needed
        });
    }

    async exportToDocx(view) {
        if (!view) {
            view = this.app.workspace.getActiveViewOfType(ColophonView);
        }

        if (!view || !(view instanceof ColophonView) || !view.adapter.editor) {
            new Notice('No active Colophon editor found.');
            return;
        }

        const editor = view.adapter.editor;
        const prosemirrorDoc = editor.state.doc;
        const defaultPath = (view.file?.basename || 'Untitled') + '.docx';

        try {
            // Define serializers for your document structure
            const nodeSerializers = {

                paragraph(state, node) {
                    state.renderInline(node);
                    state.closeBlock(node);
                },
                heading(state, node) {
                    state.renderInline(node);
                    const heading = [
                        HeadingLevel.HEADING_1,
                        HeadingLevel.HEADING_2,
                        HeadingLevel.HEADING_3,
                        HeadingLevel.HEADING_4,
                        HeadingLevel.HEADING_5,
                        HeadingLevel.HEADING_6,
                    ][node.attrs.level - 1];
                    state.closeBlock(node, { heading });
                },
                text(state, node) {
                    state.text(node.text);
                },
                hard_break(state) {
                    state.addRunOptions({ break: 1 });
                },
                footnote(state, node) {
                    const id = node.attrs.id;
                    const footnotes = view.adapter ? view.adapter.footnotes : [];
                    const fnData = footnotes.find(f => f.id === id);
                    const content = fnData ? fnData.content : '';

                    // Manually handle footnote registration
                    state.$footnoteCounter = (state.$footnoteCounter || 0) + 1;
                    const refId = state.$footnoteCounter;

                    state.footnotes[refId] = {
                        children: [new Paragraph({
                            children: [new TextRun(content)]
                        })]
                    };

                    state.current.push(new FootnoteReferenceRun(refId));
                }
            };

            const markSerializers = {
                bold() { return { bold: true }; },
                italic() { return { italics: true }; },
                underline() { return { underline: {} }; },
                strike() { return { strike: true }; },
                superscript() { return { superScript: true }; },
                subscript() { return { subScript: true }; },
                internallink() { return {}; }, // Ignore links for now
                smallCaps() { return { smallCaps: true }; }, // Ignore custom marks for now
            };

            const serializer = new DocxSerializer(nodeSerializers, markSerializers);
            const doc = serializer.serialize(prosemirrorDoc, {
                sections: [{
                    properties: {},
                    children: []
                }],
                styles: {
                    default: {
                        document: {
                            run: {
                                font: "Minion 3",
                                size: 24, // 12pt
                            },
                            paragraph: {
                                spacing: {
                                    line: 360, // 1.5 lines
                                },
                            },
                        },
                    },
                    paragraphStyles: [
                        {
                            id: "Normal",
                            name: "Normal",
                            basedOn: "Normal",
                            next: "Normal",
                            quickFormat: true,
                            run: {
                                font: "Minion 3",
                                size: 24,
                            },
                            paragraph: {
                                spacing: { line: 360 },
                                indent: { firstLine: 720 }, // 0.5 inch
                            },
                        },
                        {
                            id: "Heading1",
                            name: "Heading 1",
                            basedOn: "Normal",
                            next: "Normal",
                            quickFormat: true,
                            run: {
                                font: "Minion 3",
                                size: 36, // 18pt
                                italics: true,
                            },
                            paragraph: {
                                spacing: { before: 480, after: 240 },
                            },
                        },
                        {
                            id: "Heading2",
                            name: "Heading 2",
                            basedOn: "Normal",
                            next: "Normal",
                            quickFormat: true,
                            run: {
                                font: "Minion 3",
                                size: 28, // 14pt
                                smallCaps: true,
                                tracking: 100, // Letter spacing
                            },
                            paragraph: {
                                spacing: { before: 360, after: 240 },
                            },
                        },
                        {
                            id: "Heading3",
                            name: "Heading 3",
                            basedOn: "Normal",
                            next: "Normal",
                            quickFormat: true,
                            run: {
                                font: "Minion 3",
                                size: 24, // 12pt
                                italics: true,
                            },
                            paragraph: {
                                alignment: "center",
                                spacing: { before: 360, after: 240 },
                            },
                        }
                    ]
                }
            });

            const buffer = await Packer.toBuffer(doc);

            const result = await electron.remote.dialog.showSaveDialog({
                title: 'Export to DOCX',
                defaultPath: defaultPath,
                filters: [{ name: 'Word Document', extensions: ['docx'] }]
            });

            if (result.canceled || !result.filePath) {
                new Notice('Export cancelled.');
                return;
            }

            fs.writeFile(result.filePath, buffer, (err) => {
                if (err) {
                    console.error('Colophon: Failed to save DOCX file.', err);
                    new Notice('Failed to save file. See console for details.');
                } else {
                    new Notice('File saved successfully!');
                }
            });

        } catch (error) {
            console.error('Colophon: Error exporting to DOCX.', error);
            new Notice('An error occurred during DOCX export. See console for details.');
        }
    }

    async activateFootnoteView() {
        const { workspace } = this.app;

        let leaf = null;
        const leaves = workspace.getLeavesOfType(FOOTNOTE_VIEW_TYPE);

        if (leaves.length > 0) {
            // A leaf with our view already exists, use that
            leaf = leaves[0];
        } else {
            // Our view could not be found in the workspace, create a new leaf
            // in the right sidebar for it
            leaf = workspace.getRightLeaf(false);
            await leaf.setViewState({ type: FOOTNOTE_VIEW_TYPE, active: true });
        }

        // "Reveal" the leaf in case it is in a collapsed sidebar
        workspace.revealLeaf(leaf);
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
        // Trigger update in footnote views
        this.app.workspace.getLeavesOfType(FOOTNOTE_VIEW_TYPE).forEach(leaf => {
            if (leaf.view instanceof FootnoteView) {
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

        // Update Footnote View if it exists
        this.updateFootnoteView(leaf.view);

        const file = leaf.view.file;
        if (!file) return;
        await this.ensureCorrectView(leaf, file);
    }

    async handleFileOpen(file) {
        if (!file) return;
        const leaf = this.app.workspace.activeLeaf;
        if (!leaf) return;

        // Update Footnote View
        this.updateFootnoteView(leaf.view);

        await this.ensureCorrectView(leaf, file);
    }

    updateFootnoteView(activeView) {
        const footnoteLeaves = this.app.workspace.getLeavesOfType(FOOTNOTE_VIEW_TYPE);
        if (footnoteLeaves.length === 0) return;

        const footnoteView = footnoteLeaves[0].view;

        // If the active view is the FootnoteView itself, DO NOT clear the adapter.
        // This allows interaction with the sidebar without losing context.
        if (activeView instanceof FootnoteView) {
            return;
        }

        if (activeView instanceof ColophonView && activeView.adapter) {
            footnoteView.setAdapter(activeView.adapter);
        } else {
            // Only clear if we switched to a completely different view (like a normal markdown file)
            // or if we closed the file.
            // But wait, if we switch to another tab, we should clear.
            // If we click the sidebar, the active leaf becomes the sidebar.
            // So the check `activeView instanceof FootnoteView` above handles the sidebar click.
            footnoteView.setAdapter(null);
        }
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

        containerEl.createEl('h2', { text: 'Layout' });

        new Setting(containerEl)
            .setName('Text column width')
            .setDesc('Adjust the width of the writing canvas (500px - 1240px).')
            .addSlider(slider => slider
                .setLimits(500, 1240, 10)
                .setValue(this.plugin.settings.textColumnWidth)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.textColumnWidth = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Text column bottom padding')
            .setDesc('Sets the distance the cursor stays from the bottom of the screen. 50% keeps the active line in the middle.')
            .addSlider(slider => slider
                .setLimits(0, 75, 1)
                .setValue(this.plugin.settings.textColumnBottomPadding)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.textColumnBottomPadding = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h2', { text: 'Substitutions' });

        new Setting(containerEl)
            .setName('Smart quotes')
            .setDesc('Automatically replace straight quotes with smart quotes.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.smartQuotes)
                .onChange(async (value) => {
                    this.plugin.settings.smartQuotes = value;
                    await this.plugin.saveSettings();
                    this.display(); // Refresh to show/hide sub-options
                }));

        if (this.plugin.settings.smartQuotes) {
            new Setting(containerEl)
                .setName('Double quote style')
                .setDesc('Choose the style for double quotes.')
                .addDropdown(dropdown => dropdown
                    .addOption('“|”', '“abc”')
                    .addOption('„|“', '„abc“')
                    .addOption('„|”', '„abc”')
                    .addOption('”|”', '”abc”')
                    .addOption('«|»', '«abc»')
                    .addOption('»|«', '»abc«')
                    .addOption('"|"', '"abc"')
                    .setValue(this.plugin.settings.doubleQuoteStyle)
                    .onChange(async (value) => {
                        this.plugin.settings.doubleQuoteStyle = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Single quote style')
                .setDesc('Choose the style for single quotes.')
                .addDropdown(dropdown => dropdown
                    .addOption('‘|’', '‘abc’')
                    .addOption('‚|‘', '‚abc‘')
                    .addOption('‚|’', '‚abc’')
                    .addOption('’|’', '’abc’')
                    .addOption('‹|›', '‹abc›')
                    .addOption('›|‹', '›abc‹')
                    .addOption('\'|\'', '\'abc\'')
                    .setValue(this.plugin.settings.singleQuoteStyle)
                    .onChange(async (value) => {
                        this.plugin.settings.singleQuoteStyle = value;
                        await this.plugin.saveSettings();
                    }));
        }

        new Setting(containerEl)
            .setName('Smart dashes')
            .setDesc('Replace -- with em-dash (—) and --- with en-dash (–).')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.smartDashes)
                .onChange(async (value) => {
                    this.plugin.settings.smartDashes = value;
                    await this.plugin.saveSettings();
                }));
    }
}