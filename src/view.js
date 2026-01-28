import { TextFileView } from 'obsidian';
import { TiptapAdapter } from './tiptap-adapter';
import { ColophonToolbar } from './ui/toolbar';

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
        this.editorContainer = this.contentEl.createDiv({ cls: 'colophon-editor-wrapper' });

        // Create Toolbar Container
        // We want to inject it into the view header title container area if possible, 
        // OR standard top of view.
        // For now, let's put it at the top of contentEl
        const toolbarContainer = this.contentEl.createDiv({ cls: 'colophon-toolbar-wrapper' }, (el) => {
            el.style.borderBottom = '1px solid var(--background-modifier-border)';
            el.style.padding = '4px 0';
        });

        // Move toolbar to top
        this.contentEl.prepend(toolbarContainer);

        this.toolbar = new ColophonToolbar(this, toolbarContainer);


    }

    async onClose() {
        if (this.adapter) {
            this.adapter.destroy();
            this.adapter = null;
        }
        if (this.editorContainer) {
            this.editorContainer.empty();
        }
    }

    /**
     * Called when the file content is modified externally or when loading.
     */
    setViewData(data, clear) {
        let parsedData = { type: 'manuscript', doc: null };

        try {
            if (data && data.trim() !== '') {
                parsedData = JSON.parse(data);
            }
        } catch (e) {
            console.error('Colophon: Error parsing file data', e);
        }

        this.docType = parsedData.type || 'manuscript';

        // Apply class for specific styling
        this.contentEl.removeClass('type-manuscript', 'type-script');
        this.contentEl.addClass(`type-${this.docType}`);

        if (!this.adapter) {
            this.adapter = new TiptapAdapter(this.editorContainer, {
                content: parsedData.doc,
                type: this.docType,
                settings: this.plugin ? this.plugin.settings : null,
                onUpdate: () => {
                    this.requestSave();
                    if (this.toolbar) this.toolbar.update();
                }
            });
        } else {
            // If clear is true, it means we are reloading the file entirely
            if (clear) {
                this.adapter.type = this.docType; // Update type if it changed
                this.adapter.setContent(parsedData.doc || {});

                // Force update attributes if type changed (optional optimization: check if changed)
                if (this.adapter.editor) {
                    this.adapter.editor.setOptions({
                        editorProps: {
                            attributes: {
                                class: `colophon-editor type-${this.docType}`,
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
            doc: this.adapter.getJSON()
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
}
