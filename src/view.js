const { FileView, WorkspaceLeaf, Notice, debounce } = require('obsidian');
const TiptapAdapter = require('./tiptap-adapter');
const { parseFile, serializeFile } = require('./io');

const VIEW_TYPE = 'colophon-view';

class ColophonView extends FileView {
    constructor(leaf) {
        super(leaf);
        this.adapter = null;
        this.data = null; // Sidecar data
        this.markdownBody = ''; // Markdown body
        this.frontmatter = ''; // YAML Frontmatter

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

        // Initialize Tiptap Adapter
        this.adapter = new TiptapAdapter(this.contentEl, (newData) => {
            this.data = newData;
            this.save();
        });
    }

    async onClose() {
        if (this.adapter) {
            this.adapter.destroy();
        }
    }

    async onLoadFile(file) {
        // FileView handles setting this.file
        const content = await this.app.vault.read(file);
        const { markdown, data, frontmatter } = parseFile(content);

        this.markdownBody = markdown;
        this.data = data;
        this.frontmatter = frontmatter;

        if (this.adapter) {
            this.adapter.load(markdown, data);
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
