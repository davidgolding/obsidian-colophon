const { ItemView, WorkspaceLeaf, debounce } = require('obsidian');
const { Editor } = require('@tiptap/core');
const { StarterKit } = require('@tiptap/starter-kit');

const SIDEBAR_VIEW_TYPE = 'colophon-sidebar';

class ColophonSidebarView extends ItemView {
    constructor(leaf) {
        super(leaf);
        this.activeColophonView = null;
        this.editors = new Map(); // Map<id, Editor>
        this.updateView = debounce(this.updateView.bind(this), 100, true);
    }

    getViewType() {
        return SIDEBAR_VIEW_TYPE;
    }

    getDisplayText() {
        return 'Colophon Footnotes';
    }

    getIcon() {
        return 'foot-prints';
    }

    async onOpen() {
        const container = this.contentEl;
        container.empty();
        container.addClass('colophon-sidebar');

        this.headerEl = container.createEl('div', { cls: 'colophon-sidebar-header' });
        this.headerEl.createEl('h4', { text: 'Footnotes' });

        this.listContainer = container.createDiv({ cls: 'colophon-sidebar-list' });

        // Listen for active leaf changes
        this.registerEvent(
            this.app.workspace.on('active-leaf-change', this.onActiveLeafChange.bind(this))
        );

        // Initial check
        this.onActiveLeafChange(this.app.workspace.activeLeaf);
    }

    onActiveLeafChange(leaf) {
        if (!leaf) return;

        const view = leaf.view;
        if (view.getViewType() === 'colophon-view') {
            this.activeColophonView = view;
            this.updateView();

            // Hook into the adapter's update if possible
            if (view.adapter) {
                const originalOnUpdate = view.adapter.onUpdate;
                view.adapter.onUpdate = (data) => {
                    if (originalOnUpdate) originalOnUpdate(data);
                    this.updateView();
                };
            }
        } else {
            this.activeColophonView = null;
            this.listContainer.empty();
            this.listContainer.createEl('p', { text: 'No active manuscript.', cls: 'colophon-empty-state' });
        }
    }

    updateView() {
        if (!this.activeColophonView || !this.activeColophonView.adapter || !this.activeColophonView.adapter.editor) return;

        const editor = this.activeColophonView.adapter.editor;
        const doc = editor.state.doc;
        const footnotes = [];

        // 1. Scan document for footnote references to get order
        doc.descendants((node) => {
            if (node.type.name === 'footnoteReference') {
                footnotes.push({
                    id: node.attrs.id,
                    number: node.attrs.number
                });
            }
        });

        // 2. Get data from view
        const data = this.activeColophonView.data || {};
        const footnoteData = data.footnotes || {};

        // 3. Render
        this.listContainer.empty();

        if (footnotes.length === 0) {
            this.listContainer.createEl('p', { text: 'No footnotes yet.', cls: 'colophon-empty-state' });
            return;
        }

        footnotes.forEach((fn, index) => {
            const wrapper = this.listContainer.createDiv({ cls: 'colophon-sidebar-item' });

            // Header (Number)
            const header = wrapper.createDiv({ cls: 'colophon-sidebar-item-header' });
            header.createSpan({ text: `${index + 1}.`, cls: 'colophon-sidebar-number' });

            // Editor Container
            const editorContainer = wrapper.createDiv({ cls: 'colophon-sidebar-editor' });

            // Initialize Tiptap for this footnote
            // TODO: Optimize this. For now, full re-render.

            const content = footnoteData[fn.id] || '<p></p>';

            const miniEditor = new Editor({
                element: editorContainer,
                extensions: [StarterKit],
                content: content,
                onUpdate: ({ editor }) => {
                    // Update data
                    if (!this.activeColophonView.data) this.activeColophonView.data = {};
                    if (!this.activeColophonView.data.footnotes) this.activeColophonView.data.footnotes = {};

                    this.activeColophonView.data.footnotes[fn.id] = editor.getHTML();
                    this.activeColophonView.save();
                }
            });

            // Store editor reference if needed (for cleanup)
            // We need to track these to destroy them later
            this.editors.set(fn.id, miniEditor);
        });
    }

    async onClose() {
        // Destroy all mini editors
        this.editors.forEach(editor => editor.destroy());
        this.editors.clear();
    }
}

module.exports = {
    ColophonSidebarView,
    SIDEBAR_VIEW_TYPE
};
