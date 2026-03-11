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
        this.sharedExtensions = null;

        this.mount(content);
        
        if (this.app && this.plugin) {
            this.linkSuggest = new TiptapLinkSuggest(this.app, this.plugin, this);
        }

        this.setupGlobalEvents();
    }

    setupGlobalEvents() {
        this.focusHandler = (e) => {
            if (e instanceof CustomEvent) {
                this.focusNote(e.detail.id);
            }
        };
        
        this.createHandler = (e) => {
            if (e instanceof CustomEvent) {
                // When creating via trigger, we want to open sidebar AND focus
                this.focusNote(e.detail.id);
            }
        };

        document.body.addEventListener('colophon-focus-footnote', this.focusHandler);
        document.body.addEventListener('colophon-create-footnote', this.createHandler);
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
                    class: `colophon-editor colophon-main-editor type-${this.type}`,
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
            this.sharedExtensions = null; // Force extensions recreate
            this.destroy();
            this.mount(content);
            this.footnotes = footnotes;
            this.focus();
            return;
        }

        // Update Substitution Options for existing extensions
        this.editor.setOptions('substitutions', {
            smartQuotes: settings.smartQuotes,
            smartDashes: settings.smartDashes,
            doubleQuoteStyle: settings.doubleQuoteStyle,
            singleQuoteStyle: settings.singleQuoteStyle,
        });

        this.handleScroll();
    }

    handleScroll() {
        if (!this.editor || !this.settings || !this.settings.fixedFeedPosition) return;

        requestAnimationFrame(() => {
            const container = this.parentElement;
            if (!container || !this.editor.view || !this.editor.view.dom) return;

            const selection = this.editor.state.selection;
            if (!selection) return;

            const view = this.editor.view;
            const containerRect = container.getBoundingClientRect();

            const paddingPercent = this.settings.feedPadding ?? 40;
            const ratioFromTop = 1 - (paddingPercent / 100);
            const targetOffset = containerRect.height * ratioFromTop;
            const targetViewportY = containerRect.top + targetOffset;

            const coords = view.coordsAtPos(selection.from);
            const currentCursorY = coords.bottom;
            const delta = currentCursorY - targetViewportY;

            if (Math.abs(delta) > 2) {
                container.scrollBy({
                    top: delta,
                    behavior: 'smooth'
                });
            }
        });
    }

    destroy() {
        if (this.focusHandler) {
            document.body.removeEventListener('colophon-focus-footnote', this.focusHandler);
        }
        if (this.createHandler) {
            document.body.removeEventListener('colophon-create-footnote', this.createHandler);
        }
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
            setTimeout(() => {
                const editor = this.plugin.zAxisPanel.editors.get(id);
                if (editor) {
                    editor.commands.focus();
                    const el = this.plugin.zAxisPanel.containerEl.querySelector(`[data-footnote-id="${id}"]`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100); // Increased delay for stability
        }
    }
}
