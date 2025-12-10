const { FileView, WorkspaceLeaf, Notice, debounce } = require('obsidian');
const Toolbar = require('./toolbar');
const TiptapAdapter = require('./tiptap-adapter');
const CommentsPanel = require('./comments-panel');
const SearchPanel = require('./search-panel');
const { parseFile, serializeFile } = require('./io');

const VIEW_TYPE = 'colophon-view';

class ColophonView extends FileView {
    constructor(leaf, settings, plugin) {
        super(leaf);
        this.plugin = plugin;
        this.settings = settings || { textColumnWidth: 1080 }; // Fallback
        this.adapter = null;
        this.toolbar = null;
        this.data = null; // Sidecar data
        this.markdownBody = ''; // Markdown body
        this.frontmatter = ''; // YAML Frontmatter
        this.themeToggleBtn = null;
        this.loaderEl = null;
        this.scrollEl = null;
        this.isForcedLight = false;
        this.wordCountEl = null;

        // Debounce the save function to avoid excessive writes
        this.save = debounce(this.save.bind(this), 1000, true);
        // Debounce word count update
        this.updateWordCount = debounce(this.updateWordCount.bind(this), 500, false);
    }

    getViewType() {
        return VIEW_TYPE;
    }

    getDisplayText() {
        return this.file ? this.file.basename : 'No File';
    }

    getIcon() {
        return this.docType === 'script' ? 'clapperboard' : 'feather';
    }



    async onOpen() {
        // Create the container for Tiptap
        this.contentEl.empty();
        this.contentEl.addClass('colophon-workspace');
        this.applySettings();

        // Create Toolbar in View Header
        const headerEl = this.containerEl.querySelector('.view-header');
        if (headerEl) {
            headerEl.classList.add('colophon-view-header');
            let centerEl = headerEl.querySelector('.view-header-center');
            if (!centerEl) {
                centerEl = createDiv({ cls: 'view-header-center' });
                const actionsEl = headerEl.querySelector('.view-actions');
                if (actionsEl) {
                    headerEl.insertBefore(centerEl, actionsEl);
                } else {
                    headerEl.appendChild(centerEl);
                }
            }

            this.toolbar = new Toolbar(centerEl);
            this.toolbar.create();
        } else {
            this.toolbar = new Toolbar(this.contentEl);
            this.toolbar.create();
        }

        // Create Main Layout Container (Flex)
        this.mainLayout = this.contentEl.createDiv('colophon-main-layout');

        // Create scroll container (Editor)
        this.scrollEl = this.mainLayout.createDiv('colophon-scroll-container');

        // Get Spellcheck Setting
        const isSpellcheckEnabled = this.app.vault.getConfig('spellcheck');

        // Create Comments Panel
        this.commentsPanel = new CommentsPanel(this.mainLayout, this.settings, isSpellcheckEnabled);
        this.commentsPanel.create();

        // Add Theme Toggle Action
        this.themeToggleBtn = this.addAction('sun-moon', 'Enable white canvas mode for this note', () => {
            this.toggleTheme();
        });

        // Add Comments Toggle Action
        this.commentsToggleBtn = this.addAction('message-square', 'Toggle Comments', () => {
            this.toggleComments();
        });

        // Show Loader
        this.showLoader();

        // Initialize Tiptap Adapter
        this.adapter = new TiptapAdapter(this.app, this.scrollEl, this.toolbar, isSpellcheckEnabled, this.settings, (newData) => {
            this.data = newData;
            this.save();
            this.updateWordCount();
            // Update comments panel
            if (this.commentsPanel) {
                this.commentsPanel.render();
            }
        });

        // Connect Adapter to Comments Panel
        this.commentsPanel.setAdapter(this.adapter);

        // Create Search Panel
        this.searchPanel = new SearchPanel(this, this.adapter);
        this.searchPanel.create();

        if (this.plugin.settings.showWordCount) {
            this.toggleWordCount(true);
        }

        // Listen for theme changes to re-apply overrides if needed
        this.registerEvent(this.app.workspace.on('css-change', () => {
            if (this.isForcedLight) {
                this.updateCanvasTheme();
            }
        }));

        // Ensure footnote view is loaded (but do not reveal)
        await this.plugin.activateFootnoteView(false);

        // Register Search Shortcuts (Override Global Graph View)
        this.scope.register(['Mod'], 'g', (evt) => {
            evt.preventDefault();
            if (this.searchPanel) this.searchPanel.findNext();
            return false;
        });

        this.scope.register(['Mod', 'Shift'], 'g', (evt) => {
            evt.preventDefault();
            if (this.searchPanel) this.searchPanel.findPrevious();
            return false;
        });
    }

    onPaneMenu(menu, source) {
        super.onPaneMenu(menu, source);

        menu.addItem((item) => {
            item
                .setTitle('Export to Word (.docx)')
                .setIcon('document')
                .onClick(async () => {
                    this.plugin.exportToDocx(this);
                });
        });

        menu.addItem((item) => {
            item
                .setTitle('Show word count')
                .setIcon('calculator')
                .setChecked(this.plugin.settings.showWordCount)
                .onClick(async () => {
                    this.plugin.settings.showWordCount = !this.plugin.settings.showWordCount;
                    await this.plugin.saveSettings();
                    this.toggleWordCount(this.plugin.settings.showWordCount);
                });
        });
    }

    showLoader() {
        if (this.loaderEl) return;

        this.loaderEl = this.contentEl.createDiv('colophon-loader');
        this.loaderEl.createDiv('colophon-loader-spinner');
        this.loaderEl.createSpan({ text: 'Loading Manuscript...' });
    }

    hideLoader() {
        if (this.loaderEl) {
            this.loaderEl.remove();
            this.loaderEl = null;
        }
    }

    toggleTheme() {
        this.isForcedLight = !this.isForcedLight;

        if (this.themeToggleBtn) {
            this.themeToggleBtn.classList.toggle('is-active', this.isForcedLight);
            if (this.isForcedLight) {
                this.themeToggleBtn.setAttribute('aria-label', 'Disable white canvas mode for this note');
            } else {
                this.themeToggleBtn.setAttribute('aria-label', 'Enable white canvas mode for this note');
            }
        }

        this.updateCanvasTheme();
    }

    updateCanvasTheme() {
        // List of variables to extract/reset
        const varsToHandle = [
            '--background-primary',
            '--text-normal',
            '--text-muted',
            '--text-accent',
            '--text-selection',
            '--background-modifier-border'
        ];

        if (this.isForcedLight) {
            // We want to force "Light Mode" appearance.
            // We attempt to fetch variables from the 'theme-light' class.
            const themeVars = this.extractThemeVars('theme-light');

            // Apply them to the container
            if (this.scrollEl) {
                for (const [key, value] of Object.entries(themeVars)) {
                    if (value) {
                        this.scrollEl.style.setProperty(key, value);
                    }
                }
                this.scrollEl.classList.add('colophon-forced-theme');
            }
        } else {
            // Revert to default (inherited)
            if (this.scrollEl) {
                for (const key of varsToHandle) {
                    this.scrollEl.style.removeProperty(key);
                }
                this.scrollEl.classList.remove('colophon-forced-theme');
            }
        }
    }

    toggleWordCount(show) {
        if (show) {
            if (!this.wordCountEl) {
                this.wordCountEl = this.contentEl.createDiv('colophon-word-count-indicator');
                this.updateWordCount();
            }
        } else {
            if (this.wordCountEl) {
                this.wordCountEl.remove();
                this.wordCountEl = null;
            }
        }
    }

    updateWordCount() {
        if (!this.wordCountEl || !this.adapter) return;

        const counts = this.adapter.getWordCounts();
        const total = counts.main + counts.footnotes;

        this.wordCountEl.setText(`${counts.main} / ${total} (with footnotes)`);
    }

    extractThemeVars(themeClass) {
        // Create a dummy element to simulate the theme class scope
        const dummy = document.createElement('div');
        dummy.classList.add(themeClass);
        dummy.style.display = 'none';
        document.body.appendChild(dummy);

        const style = window.getComputedStyle(dummy);

        const vars = {
            '--background-primary': style.getPropertyValue('--background-primary').trim(),
            '--text-normal': style.getPropertyValue('--text-normal').trim(),
            '--text-muted': style.getPropertyValue('--text-muted').trim(),
            '--text-accent': style.getPropertyValue('--text-accent').trim(),
            '--text-selection': style.getPropertyValue('--text-selection').trim(),
            '--background-modifier-border': style.getPropertyValue('--background-modifier-border').trim()
        };

        document.body.removeChild(dummy);
        return vars;
    }

    updateSettings(newSettings) {
        this.settings = newSettings;
        this.applySettings();
        if (this.adapter) {
            this.adapter.updateSettings(this.settings);
        }
    }

    applySettings() {
        if (this.contentEl) {
            this.contentEl.style.setProperty('--colophon-editor-width', `${this.settings.textColumnWidth}px`);
        }
    }

    async onClose() {
        if (this.toolbar) {
            this.toolbar.destroy();
            // Also remove the container we added to the header
            const headerEl = this.containerEl.querySelector('.view-header');
            if (headerEl) {
                const centerEl = headerEl.querySelector('.view-header-center');
                if (centerEl) {
                    centerEl.remove();
                }
            }
        }
        if (this.adapter) {
            this.adapter.destroy();
        }
    }

    async onLoadFile(file) {
        // FileView handles setting this.file
        // Ensure loader is visible if it takes time
        if (!this.loaderEl && !this.adapter?.isLoaded) {
            this.showLoader();
        }

        const content = await this.app.vault.read(file);
        const { markdown, data, frontmatter } = parseFile(content);

        this.markdownBody = markdown;
        this.data = data;
        this.frontmatter = frontmatter;

        // Determine Doc Type
        const cache = this.app.metadataCache.getFileCache(file);
        const docType = cache?.frontmatter?.['colophon-plugin'] || 'manuscript';

        this.docType = docType; // Store for getIcon

        if (this.adapter) {
            this.adapter.load(markdown, data, this.file.path, docType);

            // Hide loader once loaded
            this.hideLoader();
        }

        if (this.toolbar) {
            this.toolbar.setDocType(docType);
        }

        // Force icon update
        this.app.workspace.trigger('layout-change');
    }

    async onUnloadFile(file) {
        // Cleanup if needed when switching files within the same view
        if (this.adapter) {
            // Maybe clear editor?
        }
    }

    async save() {
        if (!this.file || !this.data) return;

        // For now, we are NOT updating the markdown body based on Tiptap content.
        // We only save the sidecar data.
        const newContent = serializeFile(this.markdownBody, this.data, this.frontmatter);
        await this.app.vault.modify(this.file, newContent);
    }

    async insertFootnote() {
        if (this.adapter) {
            const id = this.adapter.addFootnote();
            if (id) {
                // Ensure footnote view is open
                await this.plugin.activateFootnoteView();
                const leaves = this.app.workspace.getLeavesOfType('colophon-footnote-view');
                if (leaves.length > 0) {
                    const view = leaves[0].view;
                    if (view) {
                        view.render(); // Refresh list
                        setTimeout(() => {
                            view.focusFootnote(id);
                        }, 50); // Small delay for DOM update
                    }
                }
            }
        }
    }

    toggleComments() {
        if (this.commentsPanel) {
            const isVisible = !this.commentsPanel.isVisible;
            this.commentsPanel.toggle(isVisible);

            if (this.commentsToggleBtn) {
                this.commentsToggleBtn.classList.toggle('is-active', isVisible);
            }
        }
    }

    openSearch() {
        if (this.searchPanel) {
            this.searchPanel.open();
        }
    }
}

module.exports = {
    ColophonView,
    VIEW_TYPE
};
