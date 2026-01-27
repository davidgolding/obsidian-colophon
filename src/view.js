import { TextFileView } from 'obsidian';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

export const VIEW_TYPE_COLOPHON = 'colophon-view';

export class ColophonView extends TextFileView {
    constructor(leaf) {
        super(leaf);
        this.editor = null;
        this.docType = 'manuscript'; // 'manuscript' | 'script'
    }

    getViewType() {
        return VIEW_TYPE_COLOPHON;
    }

    getDisplayText() {
        return this.file ? this.file.basename : 'Colophon';
    }

    async onOpen() {
        this.contentEl.addClass('colophon-view');
        // We defer editor initialization to setViewData when we have the content/type
    }

    async onClose() {
        if (this.editor) {
            this.editor.destroy();
            this.editor = null;
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
            // Fallback or error handling could go here
        }

        this.docType = parsedData.type || 'manuscript';
        
        // Apply class for specific styling
        this.contentEl.removeClass('type-manuscript', 'type-script');
        this.contentEl.addClass(`type-${this.docType}`);

        if (!this.editor) {
            this.mountEditor(parsedData.doc);
        } else {
            // If clear is true, it means we are reloading the file entirely
            if (clear) {
                // If the editor exists, we should probably destroy and recreate 
                // if the type might have changed or extensions need to change.
                // For now, simple content update:
                this.editor.commands.setContent(parsedData.doc || {});
            }
        }
    }

    /**
     * Called to save the file.
     */
    getViewData() {
        if (!this.editor) return '';

        const data = {
            type: this.docType,
            doc: this.editor.getJSON()
        };
        return JSON.stringify(data, null, 2);
    }

    clear() {
        if (this.editor) {
            this.editor.commands.clearContent();
        }
    }

    mountEditor(content) {
        // Here we can conditionally load extensions based on this.docType
        const extensions = [
            StarterKit,
        ];

        this.editor = new Editor({
            element: this.contentEl,
            extensions: extensions,
            content: content || { type: 'doc', content: [{ type: 'paragraph' }] },
            onUpdate: () => {
                // Trigger auto-save
                this.requestSave();
            }
        });
    }
}
