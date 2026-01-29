import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { generateExtensions } from './extensions/universal-block';

export class TiptapAdapter {
    constructor(parentElement, { content, type, settings, onUpdate }) {
        this.parentElement = parentElement;
        this.type = type || 'manuscript';
        this.settings = settings;
        this.onUpdate = onUpdate;
        this.editor = null;

        this.mount(content);
    }

    mount(content) {
        const dynamicExtensions = this.settings ? generateExtensions(this.settings) : [];

        this.editor = new Editor({
            element: this.parentElement,
            extensions: [
                StarterKit.configure({
                    paragraph: false,
                    heading: false,
                    codeBlock: false,
                    blockquote: false,
                    bulletList: false,
                    orderedList: false,
                    listItem: false,
                    horizontalRule: false,
                }),
                ...dynamicExtensions
            ],
            content: content || { type: 'doc', content: [{ type: 'body' }] },
            onUpdate: ({ editor }) => {
                if (this.onUpdate) {
                    this.onUpdate();
                }
            },
            onSelectionUpdate: ({ editor }) => {
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

    toggleStrike() {
        if (this.editor) {
            this.editor.chain().focus().toggleStrike().run();
        }
    }

    destroy() {
        if (this.editor) {
            this.editor.destroy();
            this.editor = null;
        }
    }
}
