const { FileView, WorkspaceLeaf, Notice, debounce } = require('obsidian');
const Toolbar = require('./toolbar');
const TiptapAdapter = require('./tiptap-adapter');
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
        return 'feather';
    }

    async onOpen() {
        // Create the container for Tiptap
        this.contentEl.empty();
        this.contentEl.addClass('colophon-workspace');
        this.applySettings();

        // Create Toolbar in View Header
        // We need to find the header element.
        // FileView -> ItemView -> View -> containerEl
        // The containerEl contains .view-header and .view-content
        const headerEl = this.containerEl.querySelector('.view-header');
        if (headerEl) {
            // Create a center container if it doesn't exist
            let centerEl = headerEl.querySelector('.view-header-center');
            if (!centerEl) {
                centerEl = createDiv({ cls: 'view-header-center' });
                // Insert before view-actions
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
            // Fallback if header not found (shouldn't happen in standard Obsidian view)
            this.toolbar = new Toolbar(this.contentEl);
            this.toolbar.create();
        }

        // Create scroll container
        this.scrollEl = this.contentEl.createDiv('colophon-scroll-container');

        // Add Theme Toggle Action
        this.themeToggleBtn = this.addAction('sun-moon', 'Enable white canvas mode for this note', () => {
            this.toggleTheme();
        });

        // Show Loader
        this.showLoader();

        // Get Spellcheck Setting
        const isSpellcheckEnabled = this.app.vault.getConfig('spellcheck');

        // Initialize Tiptap Adapter
        // We pass a callback for updates
        // PASS scrollEl instead of contentEl
        this.adapter = new TiptapAdapter(this.app, this.scrollEl, this.toolbar, isSpellcheckEnabled, this.settings, (newData) => {
            this.data = newData;
            this.save();
            this.updateWordCount();
            this.plugin.activateFootnoteView();
        });

        if (this.plugin.settings.showWordCount) {
            this.toggleWordCount(true);
        }

        // Listen for theme changes to re-apply overrides if needed
        this.registerEvent(this.app.workspace.on('css-change', () => {
            if (this.isForcedLight) {
                this.updateCanvasTheme();
            }
        }));
    }

    onPaneMenu(menu, source) {
        super.onPaneMenu(menu, source);

        menu.addItem((item) => {
            item
                .setTitle('Export to DOCX')
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
            for (const [key, value] of Object.entries(themeVars)) {
                if (value) {
                    this.contentEl.style.setProperty(key, value);
                }
            }
            this.contentEl.classList.add('colophon-forced-theme');
        } else {
            // Revert to default (inherited)
            for (const key of varsToHandle) {
                this.contentEl.style.removeProperty(key);
            }
            this.contentEl.classList.remove('colophon-forced-theme');
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

        if (this.adapter) {
            this.adapter.load(markdown, data, this.file.path);

            // Hide loader once loaded
            this.hideLoader();
        }
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

                // Auto-focus the sidebar
                // We need to find the FootnoteView and call focusFootnote(id)
                // But we might need to wait for the view to update?
                // The adapter updates synchronously usually, but the view might re-render async?
                // Actually, the adapter triggers onUpdate which calls save().
                // The FootnoteView listens to adapter updates?
                // Wait, FootnoteView calls getFootnotes() on render.
                // We need to tell FootnoteView to re-render or update.
                // Currently, FootnoteView is reactive to nothing unless we tell it.
                // Ah, we missed connecting the updates!
                // The FootnoteView needs to know when adapter changes.
                // Let's fix that in main.js or here.

                // Better: The adapter should emit an event or we manually update.
                // For now, let's manually update the FootnoteView if found.
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
}

module.exports = {
    ColophonView,
    VIEW_TYPE
};
