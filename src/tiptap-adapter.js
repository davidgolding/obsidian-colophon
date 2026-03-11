import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { generateExtensions } from './extensions/universal-block';
import { Substitutions } from './extensions/substitutions';
import { InternalLink } from './extensions/internal-link';
import { FootnoteMarker } from './extensions/footnote-marker';
import { TiptapLinkSuggest } from './ui/tiptap-link-suggest';
// FixedFeed extension removed in favor of inline logic

export class TiptapAdapter {
    constructor(parentElement, { content, footnotes, type, settings, isSpellcheckEnabled, onUpdate, app, plugin }) {
        this.parentElement = parentElement;
        this.type = type || 'manuscript';
        this.settings = settings;
        this.isSpellcheckEnabled = isSpellcheckEnabled;
        this.onUpdate = onUpdate;
        this.app = app;
        this.plugin = plugin;
        this.editor = null;
        this.footnotes = footnotes || {}; // fn-id -> content

        this.mount(content);
        
        if (this.app && this.plugin) {
            this.linkSuggest = new TiptapLinkSuggest(this.app, this.plugin, this);
        }
    }

    mount(content) {
        const dynamicExtensions = this.settings ? generateExtensions(this.settings) : [];

        this.editor = new Editor({
            element: this.parentElement,
            // Pass app and plugin to options so extensions can access them
            app: this.app,
            plugin: this.plugin,
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
                FootnoteMarker.configure({
                    trigger: this.settings?.footnoteTrigger ?? "(( "
                }),
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
                this.updateFootnoteSequence();
            },
            onSelectionUpdate: ({ editor }) => {
                if (this.onUpdate) {
                    this.onUpdate();
                }
                this.handleScroll();
            },
            onFocus: ({ editor }) => {
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
        this.handleScroll();
        this.updateFootnoteSequence();
    }

    setContent(content, footnotes) {
        if (this.editor) {
            this.footnotes = footnotes || {};
            this.editor.commands.setContent(content);
            this.updateFootnoteSequence();
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

        const needsRemount = oldBlockKeys !== newBlockKeys || 
                            oldStruct !== newStruct ||
                            this.settings.footnoteTrigger !== settings.footnoteTrigger;

        this.settings = settings;

        if (needsRemount) {
            const content = this.getJSON();
            const footnotes = this.footnotes;
            this.destroy();
            this.mount(content);
            this.footnotes = footnotes; // Restore footnotes map
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
            const paddingPercent = this.settings.feedPadding ?? 40;
            const ratioFromTop = 1 - (paddingPercent / 100);
            const targetOffset = containerRect.height * ratioFromTop;
            const targetViewportY = containerRect.top + targetOffset;

            // Get cursor position
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

    // --- Footnote Management ---

    getFootnotes() {
        const markers = [];
        if (!this.editor) return [];
        
        this.editor.state.doc.descendants((node, pos) => {
            if (node.type.name === 'footnoteMarker') {
                markers.push({
                    id: node.attrs.id,
                    number: node.attrs.number,
                    pos
                });
            }
        });

        return markers.map(m => ({
            id: m.id,
            number: m.number,
            content: this.footnotes[m.id] || { type: 'doc', content: [{ type: 'body' }] }
        }));
    }

    updateFootnote(id, content) {
        this.footnotes[id] = content;
        if (this.onUpdate) this.onUpdate();
    }

    updateFootnoteSequence() {
        if (!this.editor) return;

        const { tr } = this.editor.state;
        let sequence = 1;
        let changed = false;

        this.editor.state.doc.descendants((node, pos) => {
            if (node.type.name === 'footnoteMarker') {
                if (node.attrs.number !== sequence) {
                    tr.setNodeMarkup(pos, null, {
                        ...node.attrs,
                        number: sequence
                    });
                    changed = true;
                }
                sequence++;
            }
        });

        if (changed) {
            this.editor.view.dispatch(tr.setMeta('colophon-sync', true));
        }
    }

    focusMarker(id) {
        if (!this.editor) return;

        let targetPos = null;
        this.editor.state.doc.descendants((node, pos) => {
            if (node.type.name === 'footnoteMarker' && node.attrs.id === id) {
                targetPos = pos;
                return false;
            }
        });

        if (targetPos !== null) {
            const nodeSize = this.editor.state.doc.nodeAt(targetPos).nodeSize;
            this.editor.chain().focus().setTextSelection(targetPos + nodeSize).scrollIntoView().run();
        }
    }

    focusNote(id) {
        if (this.plugin && this.plugin.zAxisPanel) {
            this.plugin.zAxisPanel.show('footnotes');
            // Small delay to ensure render complete
            setTimeout(() => {
                const editor = this.plugin.zAxisPanel.editors.get(id);
                if (editor) {
                    editor.commands.focus();
                    // Scroll sidebar item into view
                    const el = this.plugin.zAxisPanel.containerEl.querySelector(`[data-footnote-id="${id}"]`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 50);
        }
    }
}
