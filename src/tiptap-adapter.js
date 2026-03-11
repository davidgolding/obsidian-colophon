import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { generateExtensions } from './extensions/universal-block';
import { Substitutions } from './extensions/substitutions';
import { InternalLink } from './extensions/internal-link';
import { TiptapLinkSuggest } from './ui/tiptap-link-suggest';
// FixedFeed extension removed in favor of inline logic

export class TiptapAdapter {
    constructor(parentElement, { content, type, settings, isSpellcheckEnabled, onUpdate, app, plugin }) {
        this.parentElement = parentElement;
        this.type = type || 'manuscript';
        this.settings = settings;
        this.isSpellcheckEnabled = isSpellcheckEnabled;
        this.onUpdate = onUpdate;
        this.app = app;
        this.plugin = plugin;
        this.editor = null;

        this.mount(content);
        
        if (this.app && this.plugin) {
            this.linkSuggest = new TiptapLinkSuggest(this.app, this.plugin, this);
        }
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
                InternalLink,
                ...dynamicExtensions,
                Substitutions.configure({
                    smartQuotes: this.settings?.smartQuotes ?? true,
                    smartDashes: this.settings?.smartDashes ?? true,
                    doubleQuoteStyle: this.settings?.doubleQuoteStyle ?? "“|”",
                    singleQuoteStyle: this.settings?.singleQuoteStyle ?? "‘|’",
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
        if (!this.editor) {
            this.settings = settings;
            return;
        }

        // Check if we need to re-mount because of structural changes (schema)
        const oldBlockKeys = Object.keys(this.settings.blocks).sort().join(',');
        const newBlockKeys = Object.keys(settings.blocks).sort().join(',');

        // Also check structural fields that are baked into the extensions
        const oldStruct = JSON.stringify(Object.values(this.settings.blocks).map(b => ({
            t: b['syntax-trigger'],
            f: b['following-entity'] || b['following-block']
        })));
        const newStruct = JSON.stringify(Object.values(settings.blocks).map(b => ({
            t: b['syntax-trigger'],
            f: b['following-entity'] || b['following-block']
        })));

        const needsRemount = oldBlockKeys !== newBlockKeys || oldStruct !== newStruct;

        this.settings = settings;

        if (needsRemount) {
            const content = this.getJSON();
            this.destroy();
            this.mount(content);
            this.focus(); // Try to restore focus
            return;
        }

        // Update Substitution Options for existing extensions
        this.editor.setOptions('substitutions', {
            smartQuotes: settings.smartQuotes,
            smartDashes: settings.smartDashes,
            doubleQuoteStyle: settings.doubleQuoteStyle,
            singleQuoteStyle: settings.singleQuoteStyle,
        });

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
        if (this.linkSuggest) {
            this.linkSuggest.close();
            this.linkSuggest = null;
        }
        if (this.editor) {
            this.editor.destroy();
            this.editor = null;
        }
    }
}
