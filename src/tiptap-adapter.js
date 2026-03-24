import { Editor, Extension } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Text from '@tiptap/extension-text';
import HardBreak from '@tiptap/extension-hard-break';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import Strike from '@tiptap/extension-strike';
import Underline from '@tiptap/extension-underline';
import History from '@tiptap/extension-history';
import Dropcursor from '@tiptap/extension-dropcursor';
import Gapcursor from '@tiptap/extension-gapcursor';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';

import { generateExtensions } from './extensions/universal-block';
import { Substitutions } from './extensions/substitutions';
import { InternalLink } from './extensions/internal-link';
import { FootnoteMarker } from './extensions/footnote-marker';
import { CommentHighlight } from './extensions/comment-highlight';
import { SmallCaps } from './extensions/small-caps';
import { TrailingNode } from './extensions/trailing-node';
import { DocxSerializer } from './extensions/docx-serializer';
import { TiptapLinkSuggest } from './ui/tiptap-link-suggest';

const ColophonAgentCommands = Extension.create({
    name: 'colophonAgentCommands',
    addCommands() {
        return {
            'colophon:add-link': (attributes) => ({ chain }) => {
                return chain().insertInternalLink(attributes).run();
            },
            'colophon:set-block-type': (typeId) => ({ chain }) => {
                return chain().setNode(typeId).run();
            },
            'colophon:focus-footnote': (id) => ({ editor }) => {
                if (editor.options.adapter) {
                    editor.options.adapter.focusNote(id);
                }
                return true;
            }
        };
    }
});

export class TiptapAdapter {
    constructor(parentElement, { content, footnotes, comments, type, settings, isSpellcheckEnabled, onUpdate, app, plugin, view }) {
        this.parentElement = parentElement;
        this.type = type || 'manuscript';
        this.settings = settings;
        this.isSpellcheckEnabled = isSpellcheckEnabled;
        this.onUpdate = onUpdate;
        this.app = app;
        this.plugin = plugin;
        this.view = view;
        this.editor = null;
        this.footnotes = footnotes || {}; // fn-id -> content
        this.comments = comments || {}; // threadId -> [ { author, date, content, replies } ]
        this.sharedExtensions = null;

        this.mount(content);
    }

    /**
     * Ensures the document has a valid structure for editing.
     * Prevents issues where a document contains only non-textblock nodes (like horizontalRule),
     * which would leave the user with no place to put the cursor.
     */
    repairDocument(content) {
        if (!content || !content.content) return content;

        // 1. Remove leading horizontal rules which can block the cursor
        while (content.content.length > 0 && content.content[0].type === 'horizontalRule') {
            content.content.shift();
        }

        // 2. Ensure at least one textblock exists if the document is empty
        const hasTextblock = content.content.some(node => {
            return node.type !== 'horizontalRule';
        });

        if (!hasTextblock) {
            content.content.push({ type: 'body', content: [] });
        }

        return content;
    }

    mount(content) {
        // Repair content before mounting
        const repairedContent = this.repairDocument(content);

        // Cache extensions at the adapter level to prevent re-parsing and duplicate warnings
        if (!this.sharedExtensions) {
            const dynamicExtensions = this.settings ? generateExtensions(this.settings) : [];
            this.sharedExtensions = [
                Document,
                Text,
                ...dynamicExtensions,
                History,
                HardBreak,
                Bold,
                Italic,
                Strike,
                Underline,
                Dropcursor,
                Gapcursor,
                HorizontalRule,
                Superscript,
                Subscript,
                SmallCaps,
                InternalLink,
                CommentHighlight,
                TrailingNode,
                DocxSerializer,
                FootnoteMarker.configure({
                    trigger: this.settings?.footnoteTrigger ?? "(("
                }),
                ColophonAgentCommands,
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
            adapter: this,
            extensions: this.sharedExtensions,
            content: repairedContent || { type: 'doc', content: [{ type: 'body' }] },
            onUpdate: ({ editor, transaction }) => {
                if (this.onUpdate) {
                    this.onUpdate();
                }
                
                // Only re-sequence if markers were affected by the change
                if (transaction && transaction.docChanged && !transaction.getMeta('colophon-sync')) {
                    if (this.checkIfResequenceNeeded(transaction)) {
                        this.updateFootnoteSequence();
                    }
                }
            },
            onSelectionUpdate: ({ editor }) => {
                if (this.view) {
                    this.view.updateActiveEditor(editor);
                }
                this.handleScroll();
            },
            onFocus: ({ editor }) => {
                if (this.view) {
                    this.view.updateActiveEditor(editor);
                }
                this.handleScroll();
            },
            editorProps: {
                handleClick: (view, pos, event) => {
                    const { schema, doc } = view.state;
                    const mark = schema.marks.commentHighlight;
                    if (!mark) return false;

                    const $pos = doc.resolve(pos);
                    const commentMark = $pos.marks().find(m => m.type === mark);
                    
                    if (commentMark && commentMark.attrs.threadId) {
                        this.focusComment(commentMark.attrs.threadId);
                        return true;
                    }
                    return false;
                },
                attributes: {
                    class: `colophon-editor colophon-main-editor type-${this.type} is-${this.type}-mode`,
                    spellcheck: this.isSpellcheckEnabled ? 'true' : 'false',
                },
            },
        });

        // Ensure link suggestions are attached
        if (this.app && this.plugin) {
            this.linkSuggest = new TiptapLinkSuggest(this.app, this.plugin, this.editor);
        }

        // Initial scroll check after mount
        this.handleScroll();
        this.updateFootnoteSequence();
    }

    setContent(content, footnotes, comments) {
        if (this.editor) {
            this.footnotes = footnotes || {};
            this.comments = comments || {};
            const repairedContent = this.repairDocument(content);
            this.editor.commands.setContent(repairedContent);
            this.updateFootnoteSequence();
        }
    }

    getJSON() {
        return this.editor ? this.editor.getJSON() : null;
    }

    getWordCount() {
        if (!this.editor) return { doc: 0, total: 0 };
        const docText = this.editor.state.doc.textContent;
        const docCount = docText.split(/\s+/).filter(word => word.length > 0).length;

        let footnoteCount = 0;
        if (this.footnotes) {
            for (const content of Object.values(this.footnotes)) {
                footnoteCount += this.countWordsInNode(content);
            }
        }

        return {
            doc: docCount,
            total: docCount + footnoteCount
        };
    }

    countWordsInNode(node) {
        if (!node) return 0;
        let count = 0;
        if (node.text) {
            count += node.text.split(/\s+/).filter(word => word.length > 0).length;
        }
        if (node.content && Array.isArray(node.content)) {
            node.content.forEach(child => {
                count += this.countWordsInNode(child);
            });
        }
        return count;
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

    toggleUnderline() {
        if (this.editor) {
            this.editor.chain().focus().toggleUnderline().run();
        }
    }

    toggleSuperscript() {
        if (this.editor) {
            this.editor.chain().focus().toggleSuperscript().unsetSubscript().run();
        }
    }

    toggleSubscript() {
        if (this.editor) {
            this.editor.chain().focus().toggleSubscript().unsetSuperscript().run();
        }
    }

    toggleSmallCaps() {
        if (this.editor) {
            this.editor.chain().focus().toggleSmallCaps().run();
        }
    }

    addLink({ target, alias }) {
        if (this.editor) {
            this.editor.commands['colophon:add-link']({ target, alias });
        }
    }

    setBlockType(typeId) {
        if (this.editor) {
            this.editor.commands['colophon:set-block-type'](typeId);
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
                    behavior: 'auto'
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

    getActiveCommentThreadIds() {
        const ids = new Set();
        if (!this.editor) return ids;

        // 1. Scan main document
        this.editor.state.doc.descendants((node) => {
            if (node.marks) {
                node.marks.forEach(mark => {
                    if (mark.type.name === 'commentHighlight' && mark.attrs.threadId) {
                        ids.add(mark.attrs.threadId);
                    }
                });
            }
        });

        // 2. Scan footnotes
        if (this.footnotes) {
            for (const footnoteContent of Object.values(this.footnotes)) {
                this.scanForThreadIds(footnoteContent, ids);
            }
        }

        return ids;
    }

    scanForThreadIds(node, ids) {
        if (!node) return;
        if (node.marks) {
            node.marks.forEach(mark => {
                if (mark.type.name === 'commentHighlight' && mark.attrs.threadId) {
                    ids.add(mark.attrs.threadId);
                }
            });
        }
        if (node.content && Array.isArray(node.content)) {
            node.content.forEach(child => this.scanForThreadIds(child, ids));
        }
    }

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

    /**
     * Efficiently checks if a transaction contains changes that require re-sequencing footnotes.
     * Re-sequencing is only needed if footnote markers are added, removed, or moved.
     */
    checkIfResequenceNeeded(transaction) {
        if (!transaction || !transaction.docChanged) return false;

        let markerChanged = false;

        // Iterate through transaction steps to see if any footnoteMarker was affected
        for (let i = 0; i < transaction.steps.length; i++) {
            const step = transaction.steps[i];
            
            // Check for added markers in the new content
            if (step.slice && step.slice.content) {
                step.slice.content.descendants(node => {
                    if (node.type.name === 'footnoteMarker') {
                        markerChanged = true;
                        return false; // Stop descendants iteration
                    }
                });
            }

            if (markerChanged) break;

            // Check for removed/moved markers in the content before this step
            // ProseMirror transactions keep track of the document state before each step
            const beforeDoc = transaction.docs ? transaction.docs[i] : (transaction.before || null);
            if (beforeDoc && step.from !== undefined && step.to !== undefined) {
                beforeDoc.nodesBetween(step.from, step.to, node => {
                    if (node.type.name === 'footnoteMarker') {
                        markerChanged = true;
                        return false; // Stop nodesBetween iteration
                    }
                });
            }

            if (markerChanged) break;
        }

        return markerChanged;
    }

    updateFootnoteSequence() {
        if (!this.editor) return;

        const { tr } = this.editor.state;
        let sequence = 1;
        let changed = false;
        const seenIds = new Set();

        this.editor.state.doc.descendants((node, pos) => {
            if (node.type.name === 'footnoteMarker') {
                let id = node.attrs.id;
                let isDuplicate = seenIds.has(id);
                
                let markupChanged = false;
                let newAttrs = { ...node.attrs };

                if (isDuplicate || !id) {
                    const newId = `fn-${crypto.randomUUID()}`;
                    if (id && this.footnotes[id]) {
                        // copy content from old note
                        this.footnotes[newId] = JSON.parse(JSON.stringify(this.footnotes[id]));
                    } else {
                        // empty note
                        this.footnotes[newId] = { type: 'doc', content: [{ type: 'body' }] };
                    }
                    newAttrs.id = newId;
                    id = newId;
                    markupChanged = true;
                }
                seenIds.add(id);

                if (newAttrs.number !== sequence) {
                    newAttrs.number = sequence;
                    markupChanged = true;
                }

                if (markupChanged) {
                    tr.setNodeMarkup(pos, null, newAttrs);
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
        if (this.plugin.settings.sidebarLocation === 'global') {
            this.plugin.openSidebar().then(() => {
                const sidebarLeaf = this.app.workspace.getLeavesOfType('colophon-sidebar')[0];
                if (sidebarLeaf && sidebarLeaf.view.zAxisPanel) {
                    sidebarLeaf.view.zAxisPanel.show('footnotes', () => {
                        sidebarLeaf.view.zAxisPanel.focusEditor(id);
                    });
                }
            });
            return;
        }

        if (this.view && this.view.zAxisPanel) {
            this.view.zAxisPanel.show('footnotes', () => {
                this.view.zAxisPanel.focusEditor(id);
            });
        }
    }

    focusComment(threadId) {
        if (this.plugin.settings.sidebarLocation === 'global') {
            this.plugin.openSidebar().then(() => {
                const sidebarLeaf = this.app.workspace.getLeavesOfType('colophon-sidebar')[0];
                if (sidebarLeaf && sidebarLeaf.view.zAxisPanel) {
                    sidebarLeaf.view.zAxisPanel.focusComment(threadId);
                }
            });
            return;
        }

        if (this.view && this.view.zAxisPanel) {
            this.view.zAxisPanel.focusComment(threadId);
        }
    }
}
