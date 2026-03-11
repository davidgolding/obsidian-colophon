import { TextFileView } from 'obsidian';
import { TiptapAdapter } from './tiptap-adapter';
import { ColophonToolbar } from './ui/toolbar';
import { ZAxisPanel } from './ui/z-axis-panel';

export const VIEW_TYPE_COLOPHON = 'colophon-view';

export class ColophonView extends TextFileView {
    constructor(leaf, plugin) {
        super(leaf);
        this.plugin = plugin;
        this.adapter = null;
        this.docType = 'manuscript'; // 'manuscript' | 'script'
    }

    getViewType() {
        return VIEW_TYPE_COLOPHON;
    }

    getDisplayText() {
        return this.file ? this.file.basename : 'No File';
    }

    getIcon() {
        return this.docType === 'script' ? 'clapperboard' : 'feather';
    }

    async onOpen() {
        this.contentEl.addClass('colophon-view');
        this.contentEl.addClass('colophon-workspace');

        // Main Layout Container (Editor + Sidebar)
        this.mainLayout = this.contentEl.createDiv({ cls: 'colophon-main-layout' });

        // Add scroll container which is the target for our FixedFeed logic and CSS
        this.scrollContainer = this.mainLayout.createDiv({ cls: 'colophon-scroll-container' });

        // Add Z-Axis Panel (Sidebar)
        this.zAxisPanel = new ZAxisPanel(this, this.mainLayout);

        // Target the standard Obsidian header elements
        const viewHeader = this.containerEl.querySelector('.view-header');
        if (viewHeader) {
            viewHeader.addClass('colophon-view-header');
            const titleContainer = viewHeader.querySelector('.view-header-title-container');
            if (titleContainer) {
                // Ensure it's not hidden (it might be by our CSS)
                titleContainer.style.display = 'flex';
                this.toolbar = new ColophonToolbar(this, titleContainer);
            }
        }
    }

    async onClose() {
        if (this.adapter) {
            this.adapter.destroy();
            this.adapter = null;
        }
        if (this.zAxisPanel) {
            this.zAxisPanel.destroy();
            this.zAxisPanel = null;
        }
        if (this.scrollContainer) {
            this.scrollContainer.empty();
        }
    }

    // --- Panel Toggles ---

    toggleFootnotes() {
        if (this.zAxisPanel) {
            this.zAxisPanel.toggle('footnotes');
        }
    }

    toggleComments() {
        if (this.zAxisPanel) {
            this.zAxisPanel.toggle('comments');
        }
    }

    showFootnotes() {
        if (this.zAxisPanel) {
            this.zAxisPanel.show('footnotes');
        }
    }

    showComments() {
        if (this.zAxisPanel) {
            this.zAxisPanel.show('comments');
        }
    }

    /**
     * Called when the file content is modified externally or when loading.
     */
    setViewData(data, clear) {
        let parsedData = { type: 'manuscript', doc: null, footnotes: {} };

        try {
            if (data && data.trim() !== '') {
                parsedData = JSON.parse(data);
            }
        } catch (e) {
            console.error('Colophon: Error parsing file data', e);
        }

        // Migration: Convert 'paragraph' to 'body' if present (legacy support)
        if (parsedData && parsedData.doc) {
            this.migrateContent(parsedData.doc);
        }

        this.docType = parsedData.type || 'manuscript';

        // Apply class for specific styling
        this.contentEl.removeClass('type-manuscript', 'type-script');
        this.contentEl.addClass(`type-${this.docType}`);

        this.updateSettings(); // Apply initial settings like fixedFeed class

        const isSpellcheckEnabled = this.app.vault.getConfig('spellcheck');

        if (!this.adapter) {
            this.adapter = new TiptapAdapter(this.scrollContainer, {
                content: parsedData.doc,
                footnotes: parsedData.footnotes || {},
                type: this.docType,
                settings: this.plugin ? this.plugin.settings : null,
                isSpellcheckEnabled: isSpellcheckEnabled,
                app: this.app,
                plugin: this.plugin,
                onUpdate: () => {
                    this.requestSave();
                    if (this.toolbar) this.toolbar.update();
                    if (this.zAxisPanel) this.zAxisPanel.update();
                }
            });
        } else {
            // If clear is true, it means we are reloading the file entirely
            if (clear) {
                this.adapter.type = this.docType; // Update type if it changed
                this.adapter.setContent(parsedData.doc || {}, parsedData.footnotes || {});

                // Force update attributes if type or spellcheck changed
                if (this.adapter.editor) {
                    this.adapter.editor.setOptions({
                        editorProps: {
                            attributes: {
                                class: `colophon-editor type-${this.docType}`,
                                spellcheck: isSpellcheckEnabled ? 'true' : 'false',
                            },
                        }
                    });
                }
            }
        }
    }

    /**
     * Called to save the file.
     */
    getViewData() {
        if (!this.adapter) return '';

        const data = {
            type: this.docType,
            doc: this.adapter.getJSON(),
            footnotes: this.adapter.footnotes
        };
        return JSON.stringify(data, null, 2);
    }

    clear() {
        if (this.adapter && this.adapter.editor) {
            this.adapter.editor.commands.clearContent();
        }
    }

    toggleBold() {
        if (this.adapter) {
            this.adapter.toggleBold();
        }
    }

    toggleItalic() {
        if (this.adapter) {
            this.adapter.toggleItalic();
        }
    }

    toggleStrike() {
        if (this.adapter) {
            this.adapter.toggleStrike();
        }
    }

    updateSettings() {
        const settings = this.plugin.settings;

        // Toggle typewriter mode class for CSS padding
        if (settings.fixedFeedPosition) {
            this.contentEl.addClass('is-fixed-feed');
        } else {
            this.contentEl.removeClass('is-fixed-feed');
        }

        if (this.adapter) {
            this.adapter.updateSettings(settings);
        }
    }

    migrateContent(node) {
        if (!node) return;

        if (node.type === 'paragraph') {
            node.type = 'body';
        }

        if (node.content && Array.isArray(node.content)) {
            node.content.forEach(child => this.migrateContent(child));
        }
    }
}
