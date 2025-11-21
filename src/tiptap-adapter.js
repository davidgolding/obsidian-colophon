const { Editor, Mark, mergeAttributes } = require('@tiptap/core');
const { StarterKit } = require('@tiptap/starter-kit');
const Underline = require('@tiptap/extension-underline');
const Subscript = require('@tiptap/extension-subscript');
const Superscript = require('@tiptap/extension-superscript');
const TextStyle = require('@tiptap/extension-text-style');
const PopoverMenu = require('./popover-menu');

// Custom Small Caps Extension
const SmallCaps = Mark.create({
    name: 'smallCaps',
    parseHTML() {
        return [
            {
                style: 'font-variant',
                getAttrs: value => (value === 'small-caps' ? {} : false),
            },
        ]
    },
    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(HTMLAttributes, { style: 'font-variant: small-caps' }), 0]
    },
    addCommands() {
        return {
            toggleSmallCaps: () => ({ commands }) => {
                return commands.toggleMark(this.name)
            },
        }
    },
});

class TiptapAdapter {
    constructor(containerEl, onUpdate) {
        this.containerEl = containerEl;
        this.onUpdate = onUpdate; // Callback when editor content changes
        this.editor = null;
        this.isLoaded = false;
        this.popover = null;
    }

    load(markdown, data) {
        if (this.editor) {
            this.editor.destroy();
        }

        let content = data;
        if (!content) {
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
                Underline,
                Subscript,
                Superscript,
                TextStyle,
                SmallCaps
            ],
            content: content,
            onUpdate: ({ editor }) => {
                if (this.onUpdate) {
                    this.onUpdate(editor.getJSON());
                }
            },
        });

        // Initialize Popover
        this.popover = new PopoverMenu(this.editor, this.containerEl);

        // Add Context Menu Listener
        this.editor.view.dom.addEventListener('contextmenu', (e) => {
            // Check if there is a selection
            const { from, to } = this.editor.state.selection;
            if (from !== to) {
                e.preventDefault();
                // Calculate relative position to container if needed, or use page coordinates
                // Since popover is appended to containerEl, we might need relative coordinates if container is relative.
                // But usually fixed/absolute positioning relative to viewport or offset parent is easier.
                // Let's try using page coordinates and setting popover to fixed or absolute.
                // If containerEl is relative, we need offset.

                const rect = this.containerEl.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                this.popover.show(x, y);
            }
        });

        this.isLoaded = true;
    }

    destroy() {
        if (this.popover) {
            this.popover.destroy();
        }
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
