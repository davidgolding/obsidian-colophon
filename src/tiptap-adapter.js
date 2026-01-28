import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

export class TiptapAdapter {
    constructor(parentElement, { content, type, onUpdate }) {
        this.parentElement = parentElement;
        this.type = type || 'manuscript';
        this.onUpdate = onUpdate;
        this.editor = null;

        this.mount(content);
    }

    mount(content) {
        this.editor = new Editor({
            element: this.parentElement,
            extensions: [
                StarterKit,
            ],
            content: content || { type: 'doc', content: [{ type: 'paragraph' }] },
            onUpdate: ({ editor }) => {
                if (this.onUpdate) {
                    this.onUpdate();
                }
            },
            editorProps: {
                attributes: {
                    class: `colophon-editor type-${this.type}`,
                },
            },
        });
    }

    setContent(content) {
        if (this.editor) {
            this.editor.commands.setContent(content);
        }
    }

    getJSON() {
        return this.editor ? this.editor.getJSON() : null;
    }

    focus() {
        if (this.editor) {
            this.editor.commands.focus();
        }
    }

    toggleBold() {
        if (this.editor) {
            this.editor.chain().focus().toggleBold().run();
        }
    }

    toggleItalic() {
        if (this.editor) {
            this.editor.chain().focus().toggleItalic().run();
        }
    }

    destroy() {
        if (this.editor) {
            this.editor.destroy();
            this.editor = null;
        }
    }
}
