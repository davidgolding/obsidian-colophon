const { Editor } = require('@tiptap/core');
const { StarterKit } = require('@tiptap/starter-kit');

class TiptapAdapter {
    constructor(containerEl, onUpdate) {
        this.containerEl = containerEl;
        this.onUpdate = onUpdate; // Callback when editor content changes
        this.editor = null;
        this.isLoaded = false;
    }

    load(markdown, data) {
        if (this.editor) {
            this.editor.destroy();
        }

        // If we have JSON data (sidecar), use it. Otherwise, fall back to markdown content.
        // Note: StarterKit handles markdown-like behavior but Tiptap is fundamentally JSON/HTML based.
        // For initial load without sidecar, we might want to use a markdown parser or just let Tiptap handle it if we add a markdown extension.
        // BUT, for now, let's assume if there's no data, we treat it as plain text or initial content.
        // Ideally we should use a markdown serializer/parser for Tiptap, but let's start simple:
        // If data exists, load it. If not, create a paragraph with the markdown text (not ideal but works for "New Manuscript").

        let content = data;
        if (!content) {
            // Fallback: simple object with the markdown text
            // In a real scenario we'd parse the markdown to Tiptap JSON
            content = {
                type: 'doc',
                content: markdown.split('\n\n').map(text => ({
                    type: 'paragraph',
                    content: text.trim() ? [{ type: 'text', text: text.trim() }] : []
                }))
            };
        }

        this.editor = new Editor({
            element: this.containerEl,
            extensions: [
                StarterKit,
            ],
            content: content,
            onUpdate: ({ editor }) => {
                if (this.onUpdate) {
                    this.onUpdate(editor.getJSON());
                }
            },
        });

        this.isLoaded = true;
    }

    destroy() {
        if (this.editor) {
            this.editor.destroy();
            this.editor = null;
        }
    }

    focus() {
        if (this.editor) {
            this.editor.commands.focus();
        }
    }
}

module.exports = TiptapAdapter;
