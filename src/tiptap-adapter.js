import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { generateExtensions } from './extensions/universal-block';
import { Substitutions } from './extensions/substitutions';
import { FixedFeed, scrollActiveLineIntoView } from './extensions/fixed-feed';

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
                FixedFeed.configure({
                    enabled: this.settings.fixedFeedPosition,
                    padding: this.settings.feedPadding,
                }),
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
            onFocus: ({ editor }) => {
                // Ensure scroll update on focus
                requestAnimationFrame(() => {
                    scrollActiveLineIntoView(this.editor, {
                        enabled: this.settings.fixedFeedPosition,
                        padding: this.settings.feedPadding
                    }, 'smooth');
                });
            },
            editorProps: {
                attributes: {
                    class: `colophon-editor type-${this.type}`,
                    spellcheck: this.isSpellcheckEnabled ? 'true' : 'false',
                },
            },
        });

        // Initial scroll check after mount
        requestAnimationFrame(() => {
            scrollActiveLineIntoView(this.editor, {
                enabled: this.settings.fixedFeedPosition,
                padding: this.settings.feedPadding
            }, 'auto');
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

        // Update Fixed Feed Options
        this.editor.setOptions('fixedFeed', {
            enabled: settings.fixedFeedPosition,
            padding: settings.feedPadding,
        });

        // Trigger an immediate scroll update so the view reacts to slider changes
        requestAnimationFrame(() => {
            scrollActiveLineIntoView(this.editor, {
                enabled: settings.fixedFeedPosition,
                padding: settings.feedPadding
            }, 'smooth');
        });
    }

    destroy() {
        if (this.editor) {
            this.editor.destroy();
            this.editor = null;
        }
    }
}
