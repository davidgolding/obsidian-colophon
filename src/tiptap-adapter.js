import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { generateExtensions } from './extensions/universal-block';
import { Substitutions } from './extensions/substitutions';
// FixedFeed extension removed in favor of inline logic

export class TiptapAdapter {
    constructor(parentElement, { content, type, settings, isSpellcheckEnabled, onUpdate }) {
        this.parentElement = parentElement;
        this.type = type || 'manuscript';
        this.settings = settings;
        this.isSpellcheckEnabled = isSpellcheckEnabled;
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
                ...dynamicExtensions,
                Substitutions.configure({
                    smartQuotes: this.settings.smartQuotes,
                    smartDashes: this.settings.smartDashes,
                    doubleQuoteStyle: this.settings.doubleQuoteStyle,
                    singleQuoteStyle: this.settings.singleQuoteStyle,
                }),
                // FixedFeed extension removed
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
                this.handleScroll();
            },
            onFocus: ({ editor }) => {
                // Ensure scroll update on focus
                // Ensure scroll update on focus
                this.handleScroll();
            },
            editorProps: {
                attributes: {
                    class: `colophon-editor type-${this.type}`,
                    spellcheck: this.isSpellcheckEnabled ? 'true' : 'false',
                },
            },
        });

        // Initial scroll check after mount
        // Initial scroll check after mount
        this.handleScroll();
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

    updateSettings(settings) {
        this.settings = settings;
        if (!this.editor) return;

        // Update Substitution Options
        this.editor.setOptions('substitutions', {
            smartQuotes: settings.smartQuotes,
            smartDashes: settings.smartDashes,
            doubleQuoteStyle: settings.doubleQuoteStyle,
            singleQuoteStyle: settings.singleQuoteStyle,
        });

        // Update Fixed Feed Options (Inline Logic)
        // No need to set options on extension anymore.

        // Trigger an immediate scroll update so the view reacts to slider changes
        this.handleScroll();
    }

    handleScroll() {
        if (!this.editor || !this.settings || !this.settings.fixedFeedPosition) return;

        // Use requestAnimationFrame to ensure layout is settled and minimize jank
        requestAnimationFrame(() => {
            const container = this.parentElement;
            if (!container) return;

            // Ensure editor view and DOM exist
            if (!this.editor.view || !this.editor.view.dom) return;

            const selection = this.editor.state.selection;
            if (!selection) return;

            const view = this.editor.view;
            const containerRect = container.getBoundingClientRect();

            // Calculate target position line
            // padding is % from bottom. 40% padding = 60% from top.
            // Using logic from main branch analysis directly.
            const paddingPercent = this.settings.feedPadding ?? 40;
            const ratioFromTop = 1 - (paddingPercent / 100);
            const targetOffset = containerRect.height * ratioFromTop;
            const targetViewportY = containerRect.top + targetOffset;

            // Get cursor position (bottom of the cursor to align with line)
            const coords = view.coordsAtPos(selection.from);
            const currentCursorY = coords.bottom;

            // Calculate delta
            const delta = currentCursorY - targetViewportY;

            // Threshold to avoid micro-adjustments/jitter (2px)
            if (Math.abs(delta) > 2) {
                container.scrollBy({
                    top: delta,
                    behavior: 'smooth'
                });
            }
        });
    }

    destroy() {
        if (this.editor) {
            this.editor.destroy();
            this.editor = null;
        }
    }
}
