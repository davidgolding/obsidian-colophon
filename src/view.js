const { FileView, WorkspaceLeaf, Notice, debounce } = require('obsidian');
const TiptapAdapter = require('./tiptap-adapter');
const { parseFile, serializeFile } = require('./io');

const VIEW_TYPE = 'colophon-view';

class ColophonView extends FileView {
    constructor(leaf, settings) {
        super(leaf);
        this.settings = settings || { textColumnWidth: 1080 }; // Fallback
        this.adapter = null;
        this.data = null; // Sidecar data
        this.markdownBody = ''; // Markdown body
        this.frontmatter = ''; // YAML Frontmatter
        this.themeOverride = null; // null (auto), 'light', 'dark'
        this.loaderEl = null;

        // Debounce the save function to avoid excessive writes
        this.save = debounce(this.save.bind(this), 1000, true);
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
        this.updateThemeClass();
        this.applySettings();

        // Add Theme Toggle Action
        this.addAction('sun', 'Toggle Canvas Theme', () => {
            this.toggleTheme();
        });

        // Show Loader
        this.showLoader();

        // Get Spellcheck Setting
        const isSpellcheckEnabled = this.app.vault.getConfig('spellcheck');

        // Initialize Tiptap Adapter
        // We pass a callback for updates
        this.adapter = new TiptapAdapter(this.contentEl, isSpellcheckEnabled, (newData) => {
            this.data = newData;
            this.save();
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
        if (this.themeOverride === null) {
            // Currently Auto. Switch to the opposite of the system theme.
            const isSystemDark = document.body.classList.contains('theme-dark');
            this.themeOverride = isSystemDark ? 'light' : 'dark';
        } else {
            // Currently manual. Flip it.
            this.themeOverride = this.themeOverride === 'light' ? 'dark' : 'light';
        }
        this.updateThemeClass();
    }

    updateThemeClass() {
        this.contentEl.removeClass('colophon-theme-light', 'colophon-theme-dark');

        if (this.themeOverride) {
            this.contentEl.addClass(`colophon-theme-${this.themeOverride}`);
        }
    }

    updateSettings(newSettings) {
        this.settings = newSettings;
        this.applySettings();
    }

    applySettings() {
        if (this.contentEl) {
            this.contentEl.style.setProperty('--colophon-editor-width', `${this.settings.textColumnWidth}px`);
        }
    }

    async onClose() {
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
            this.adapter.load(markdown, data);

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
}

module.exports = {
    ColophonView,
    VIEW_TYPE
};
