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
        // Cache extensions at the adapter level to prevent re-parsing and duplicate warnings
        if (!this.sharedExtensions) {
            const dynamicExtensions = this.settings ? generateExtensions(this.settings) : [];
            this.sharedExtensions = [
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
            ];
        }

        this.editor = new Editor({
            element: this.parentElement,
            app: this.app,
            plugin: this.plugin,
            extensions: this.sharedExtensions,
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
            content: this.footnotes[m.id] || { type: 'doc', content: [{ type: 'footnote' }] }
        }));
    }

    updateFootnote(id, content) {
        // Prevent update loop: check if content actually changed
        const current = JSON.stringify(this.footnotes[id]);
        const next = JSON.stringify(content);
        if (current === next) return;

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
