const { Editor, Mark, Extension, mergeAttributes } = require('@tiptap/core');
const { StarterKit } = require('@tiptap/starter-kit');
const { Paragraph } = require('@tiptap/extension-paragraph');
const { Heading } = require('@tiptap/extension-heading');
const { BulletList } = require('@tiptap/extension-bullet-list');
const { OrderedList } = require('@tiptap/extension-ordered-list');
const { ListItem } = require('@tiptap/extension-list-item');
const Underline = require('@tiptap/extension-underline');
const { Subscript } = require('@tiptap/extension-subscript');
const { Superscript } = require('@tiptap/extension-superscript');
const TextStyle = require('@tiptap/extension-text-style');
const { InputRule } = require('@tiptap/core');
const Footnote = require('./extensions/footnote');
const CommentMark = require('./extensions/comment-mark');
const CommentsManager = require('./comments');
const Substitutions = require('./extensions/substitutions');
const InternalLink = require('./extensions/internallink');
const StandardLink = require('./extensions/standard-link');
const DocxSerializer = require('./extensions/docx-serializer');
const StyleManager = require('./style-manager');
const DEFAULT_STYLES = require('./default-styles');
const { parseYaml, Menu } = require('obsidian');
const ScriptFormatting = require('./extensions/script-formatting');

// Custom extension to handle the Enter key
const EnterKeyHandler = Extension.create({
    name: 'enterKeyHandler',

    addKeyboardShortcuts() {
        return {
            'Enter': () => {
                const { state } = this.editor;
                const { $from } = state.selection;
                const currentNode = $from.parent;

                if (currentNode.attrs.class !== 'body') {
                    // If so, split the block and set the new one to be a default paragraph
                    return this.editor.chain().focus().splitBlock().setNode('paragraph', { class: 'body' }).run();
                }

                // For all other cases, use the default behavior
                return this.editor.commands.splitBlock();
            },
        };
    },
});

// Custom Paragraph with Class Support
const CustomParagraph = Paragraph.extend({
    addAttributes() {
        return {
            class: {
                default: "body",
                parseHTML: element => element.getAttribute('class'),
                renderHTML: attributes => {
                    if (!attributes.class) {
                        return {}
                    }
                    return { class: attributes.class }
                },
            },
        }
    },
});

// Custom Heading with Class Support
const CustomHeading = Heading.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            level: {
                default: 1,
                keepOnSplit: false,
            },
            class: {
                default: "heading-1",
                parseHTML: element => element.getAttribute('class'),
                renderHTML: attributes => {
                    if (!attributes.class) {
                        return {}
                    }
                    return { class: attributes.class }
                },
            },
        }
    },
});

// Custom List Extensions with Class Support
const CustomBulletList = BulletList.extend({
    addAttributes() {
        return {
            class: {
                default: "bullet",
                parseHTML: element => element.getAttribute('class'),
                renderHTML: attributes => {
                    return { class: attributes.class }
                },
            }
        }
    }
});

const CustomOrderedList = OrderedList.extend({
    addAttributes() {
        return {
            class: {
                default: "ordered",
                parseHTML: element => element.getAttribute('class'),
                renderHTML: attributes => {
                    return { class: attributes.class }
                },
            }
        }
    }
});

const CustomListItem = ListItem.extend({
    // We can add attributes here if needed, but usually class on UL/OL is enough
});

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
    constructor(app, containerEl, toolbar, isSpellcheckEnabled, settings, onUpdate) {
        this.app = app;
        this.containerEl = containerEl; // This is the scrollable container
        this.toolbar = toolbar;
        this.isSpellcheckEnabled = isSpellcheckEnabled;
        this.settings = settings;
        this.onUpdate = onUpdate; // Callback when editor content changes
        this.editor = null;
        this.isLoaded = false;
        this.footnotes = []; // Store footnote definitions: { id, content }
        this.listeners = []; // Listeners for footnote updates
        this.styleManager = new StyleManager();
        this.styles = { ...DEFAULT_STYLES }; // Store loaded styles configuration (init with defaults)
        this.paragraphOptions = [];
        this.listOptions = [];
        this.commentsManager = new CommentsManager(this);
    }

    normalizeDoc(doc) {
        if (!doc || !doc.content) {
            return doc;
        }
        doc.content.forEach(node => {
            if (node.type === 'paragraph') {
                if (!node.attrs || node.attrs.class === null || node.attrs.class === undefined) {
                    node.attrs = { ...node.attrs, class: 'body' };
                }
            } else if (node.type === 'heading') {
                if (!node.attrs || node.attrs.class === null || node.attrs.class === undefined) {
                    const level = node.attrs?.level || 1;
                    node.attrs = { ...node.attrs, class: `heading-${level}` };
                }
            }
        });
        return doc;
    }

    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    updateSettings(newSettings) {
        this.settings = newSettings;

        // Reload styles to reflect any changes in enabledStyles or stylesFolder
        this.loadStyles();

        // Re-check scroll behavior
        if (this.editor) {
            this.handleScroll();
        }
    }

    load(markdown, data, filePath, docType = 'manuscript') {
        this.filePath = filePath;
        this.docType = docType;

        if (this.editor) {
            this.editor.destroy();
        }

        let content = null;

        // Handle Data Structure (Legacy vs New)
        if (data) {
            if (data.doc) {
                // New structure: { doc: ..., footnotes: ... }
                content = data.doc;
                this.footnotes = data.footnotes || [];
            } else {
                // Legacy structure: data IS the doc
                content = data;
                this.footnotes = [];
                this.commentsManager.load([]);
            }
        }

        // Load comments if available in new structure, otherwise clear
        if (data && data.comments) {
            this.commentsManager.load(data.comments);
        } else {
            this.commentsManager.load([]);
        }

        // Fallback to parsing Markdown if no data
        if (!content) {
            content = {
                type: 'doc',
                content: markdown.split('\n\n').map(text => ({
                    type: 'paragraph',
                    content: text.trim() ? [{ type: 'text', text: text.trim() }] : []
                }))
            };
            this.footnotes = [];
        }

        // Normalize content to ensure all nodes have a class
        content = this.normalizeDoc(content);

        this.initEditor(content);
        this.isLoaded = true;

        // Trigger initial update to sync listeners (e.g. CommentsPanel)
        this.triggerUpdate();
    }

    initEditor(content) {
        // The editor is mounted in a child div to separate it from the scrollable container
        const editorHost = this.containerEl.createDiv('colophon-editor-host');

        if (this.docType === 'script') {
            editorHost.classList.add('is-script-mode');
        }

        // Load styles asynchronously
        this.loadStyles().then(() => {
            // Styles loaded
        });

        const extensions = [
            StarterKit.configure({
                paragraph: false,
                heading: false,
                bulletList: false,
                orderedList: false,
                listItem: false,
            }),
            EnterKeyHandler,
            CustomParagraph,
            CustomHeading,
            CustomBulletList,
            CustomOrderedList,
            CustomListItem,
            Underline,
            Subscript,
            Superscript,
            TextStyle,
            SmallCaps,

            Footnote,
            CommentMark,
            Substitutions.configure({
                smartQuotes: this.settings.smartQuotes,
                smartDashes: this.settings.smartDashes,
                doubleQuoteStyle: this.settings.doubleQuoteStyle,
                singleQuoteStyle: this.settings.singleQuoteStyle,
            }),
            InternalLink.configure({
                app: this.app,
                getFilePath: () => this.filePath
            }),
            StandardLink.configure({
                app: this.app,
                getFilePath: () => this.filePath
            }),
            DocxSerializer
        ];

        if (this.docType === 'script') {
            extensions.push(ScriptFormatting);
        }

        this.editor = new Editor({
            element: editorHost,
            extensions: extensions,
            editorProps: {
                attributes: {
                    spellcheck: this.isSpellcheckEnabled ? 'true' : 'false',
                },
                handleDOMEvents: {
                    contextmenu: (view, event) => {
                        if (!view.state.selection.empty) {
                            event.preventDefault();
                            const menu = new Menu();
                            menu.addItem((item) => {
                                item
                                    .setTitle('Add comment')
                                    .setIcon('message-square')
                                    .onClick(() => {
                                        this.addComment(this.settings.authorName);
                                    });
                            });
                            menu.showAtMouseEvent(event);
                            return true;
                        }
                        return false;
                    },
                    dblclick: (view, event) => {
                        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
                        if (pos) {
                            const node = view.state.doc.nodeAt(pos.pos);
                            const marks = node ? node.marks : [];
                            // Or better: resolve position
                            const $pos = view.state.doc.resolve(pos.pos);
                            const commentMark = $pos.marks().find(m => m.type.name === 'comment');

                            if (commentMark) {
                                const id = commentMark.attrs.id;
                                this.listeners.forEach(listener => listener({ type: 'open-comments-panel' }));
                                setTimeout(() => {
                                    this.listeners.forEach(listener => listener({ type: 'focus-comment', id }));
                                }, 50);
                                return true; // Prevent default double-click behavior (selection)? Maybe not.
                            }
                        }
                        return false;
                    }
                }
            },
            content: content,
            onUpdate: ({ editor }) => {
                this.triggerUpdate();
            },
            onSelectionUpdate: ({ editor }) => {
                this.handleScroll();
                if (this.toolbar) this.toolbar.update();
                this.checkActiveComment();
            },
            onFocus: ({ editor }) => {
                if (this.toolbar) this.toolbar.setActiveEditor(editor);
            }
        });

        // Set initial active editor
        if (this.toolbar) {
            this.toolbar.setActiveEditor(this.editor);
            this.toolbar.updateStyleOptions(this.paragraphOptions || [], this.listOptions || []);
        }
    }

    async loadStyles() {
        try {
            // Start with Default Styles
            let styles = { ...DEFAULT_STYLES };

            // Resolve Styles Folder
            const stylesFolder = this.settings.stylesFolder || 'snippets';
            const folderPath = `${this.app.vault.configDir}/${stylesFolder}`;

            // Check if folder exists
            if (await this.app.vault.adapter.exists(folderPath)) {
                // Iterate over enabled styles
                for (const fileName of (this.settings.enabledStyles || [])) {
                    const filePath = `${folderPath}/${fileName}`;
                    if (await this.app.vault.adapter.exists(filePath)) {
                        try {
                            const content = await this.app.vault.adapter.read(filePath);
                            const userStyles = parseYaml(content);

                            // Merge: User styles override defaults (deep merge)
                            for (const [key, styleDef] of Object.entries(userStyles)) {
                                if (styles[key] &&
                                    typeof styles[key] === 'object' &&
                                    !Array.isArray(styles[key]) &&
                                    styleDef &&
                                    typeof styleDef === 'object' &&
                                    !Array.isArray(styleDef)) {
                                    // If style exists and both are objects, merge properties
                                    styles[key] = { ...styles[key], ...styleDef };
                                } else {
                                    // If new style or primitive (like scale), overwrite it
                                    styles[key] = styleDef;
                                }
                            }
                        } catch (err) {
                            console.error(`Colophon: Failed to load style file ${fileName}`, err);
                        }
                    }
                }
            }

            // Store merged styles
            this.styles = styles;

            // Generate CSS
            const css = this.styleManager.generateCSS(styles);
            this.injectStyles(css);

            // Get Options
            const { paragraphOptions, listOptions } = this.styleManager.getStyleOptions(styles);
            this.paragraphOptions = paragraphOptions;
            this.listOptions = listOptions;

            // Update Toolbar
            if (this.toolbar) {
                this.toolbar.updateStyleOptions(this.paragraphOptions, this.listOptions);
            }

            // Force update of footnote numbers based on new styles
            this.triggerUpdate();

        } catch (e) {
            console.error('Colophon: Failed to load styles', e);
        }
    }

    injectStyles(css) {
        const styleId = 'colophon-dynamic-styles';
        let styleEl = document.getElementById(styleId);

        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = styleId;
            document.head.appendChild(styleEl);
        }

        styleEl.textContent = css;
    }

    handleScroll() {
        if (!this.editor || !this.editor.view.hasFocus()) {
            return;
        }

        const { state } = this.editor;
        // Only scroll for cursor, not range selections (unless we want to force it)
        if (!state.selection.empty) {
            return;
        }

        const view = this.editor.view;
        const pos = state.selection.from;

        // Get coordinates of the cursor (Viewport Relative)
        const cursorCoords = view.coordsAtPos(pos);

        // Get Container Rect (Viewport Relative)
        const containerRect = this.containerEl.getBoundingClientRect();

        if (this.settings.fixedFeedPosition) {
            // Typewriter Mode: Fixed position relative to bottom
            // feedPadding = % from bottom.
            // 0% = bottom, 50% = middle, 75% = top quarter.

            const paddingPercent = this.settings.feedPadding || 0;
            // Calculate target Y from top of container
            // If 0% (bottom), target is containerHeight.
            // If 50%, target is containerHeight * 0.5.
            // If 75%, target is containerHeight * 0.25.

            const ratioFromTop = 1 - (paddingPercent / 100);
            const targetOffset = containerRect.height * ratioFromTop;

            // The target Y coordinate in the viewport
            const targetViewportY = containerRect.top + targetOffset;

            // Calculate difference between current cursor Y (bottom) and target
            const currentCursorY = cursorCoords.bottom;

            const delta = currentCursorY - targetViewportY;

            // Apply scroll if delta is significant (e.g., > 2px to avoid jitter)
            if (Math.abs(delta) > 2) {
                this.containerEl.scrollBy({
                    top: delta,
                    behavior: 'smooth' // or 'auto' for instant
                });
            }

        } else {
            // Standard Behavior: Ensure cursor is in view
            // We need to check if cursor is above or below the visible area of container

            const margin = 20; // Padding for visibility

            // Check Top
            if (cursorCoords.top < containerRect.top + margin) {
                const delta = cursorCoords.top - (containerRect.top + margin);
                this.containerEl.scrollBy({ top: delta, behavior: 'auto' });
            }
            // Check Bottom
            else if (cursorCoords.bottom > containerRect.bottom - margin) {
                const delta = cursorCoords.bottom - (containerRect.bottom - margin);
                this.containerEl.scrollBy({ top: delta, behavior: 'auto' });
            }
        }
    }

    triggerUpdate() {
        if (!this.editor) return;

        // 1. Calculate Footnote Numbers
        const footnotesInDoc = [];
        let index = 1;
        let hasChanges = false;

        this.editor.state.doc.descendants((node, pos) => {
            if (node.type.name === 'footnote') {
                const number = this.getFootnoteSymbol(index++);
                footnotesInDoc.push({
                    id: node.attrs.id,
                    number: number,
                    pos: pos
                });
                if (node.attrs.number !== number) {
                    hasChanges = true;
                }
            }
        });

        // 2. Sync with sidecar data
        const newFootnotesList = footnotesInDoc.map(fn => {
            const existing = this.footnotes.find(f => f.id === fn.id);
            return {
                id: fn.id,
                number: fn.number,
                content: existing ? existing.content : ''
            };
        });

        this.footnotes = newFootnotesList;

        // 3. Apply Numbering Updates to Document if needed
        if (hasChanges) {
            Promise.resolve().then(() => {
                if (!this.editor || this.editor.isDestroyed) return;
                const tr = this.editor.state.tr;
                let modified = false;
                this.editor.state.doc.descendants((node, pos) => {
                    if (node.type.name === 'footnote') {
                        const targetNumber = footnotesInDoc.find(f => f.id === node.attrs.id)?.number;
                        if (targetNumber && node.attrs.number !== targetNumber) {
                            tr.setNodeMarkup(pos, null, { ...node.attrs, number: targetNumber });
                            modified = true;
                        }
                    }
                });
                if (modified) {
                    this.editor.view.dispatch(tr);
                }
            });
        }

        if (this.onUpdate) {
            this.onUpdate({
                doc: this.editor.getJSON(),
                footnotes: this.footnotes,
                comments: this.commentsManager.getComments()
            });
        }

        // Notify listeners (e.g. FootnoteView)
        this.listeners.forEach(listener => listener());
    }

    checkActiveComment() {
        if (!this.editor) return;
        const { state } = this.editor;
        const { selection } = state;
        const { $from } = selection;

        // Check if cursor is inside a comment mark
        const marks = $from.marks();
        const commentMark = marks.find(m => m.type.name === 'comment');

        if (commentMark) {
            const id = commentMark.attrs.id;
            // Notify listeners to focus this comment
            // We can add a specific event or just rely on the view polling?
            // Better to emit an event.
            // For now, let's just call a method on the view if we had access, but we don't.
            // So we'll use the subscription mechanism with a specific type?
            // Or just pass the active ID in the update?
            // But onSelectionUpdate doesn't trigger full update usually.

            // Let's add a specialized callback for selection/focus?
            // Or just reuse subscribe.
            this.listeners.forEach(listener => listener({ type: 'focus-comment', id }));
        }
    }

    addComment(authorName = "Me") {
        if (!this.editor) return;
        const { state } = this.editor;
        if (state.selection.empty) return; // Must select text

        const id = `comment-${Date.now()}`;
        this.editor.chain().focus().setComment(id).run();

        // Add data
        this.commentsManager.addComment(id, authorName);
        this.triggerUpdate();

        // Request panel open
        this.listeners.forEach(listener => listener({ type: 'open-comments-panel' }));

        // Focus the new comment card
        setTimeout(() => {
            this.listeners.forEach(listener => listener({ type: 'focus-comment', id }));
        }, 100);
    }

    resolveComment(id) {
        // Remove mark from editor
        if (!this.editor) return;

        // We need to find where this mark is.
        // Tiptap doesn't have a direct "remove mark by ID" easily without searching.
        // We can use `unsetMark` but that works on selection.
        // We need to find the range of this mark.

        let found = false;
        this.editor.state.doc.descendants((node, pos) => {
            if (found) return false;
            if (node.marks) {
                const mark = node.marks.find(m => m.type.name === 'comment' && m.attrs.id === id);
                if (mark) {
                    // Found it. Remove it.
                    // We need the exact range.
                    // descendants gives us nodes.
                    const from = pos;
                    const to = pos + node.nodeSize;
                    this.editor.chain().setTextSelection({ from, to }).unsetComment().run();
                    // Note: This might only remove it from this node if the comment spans multiple nodes.
                    // But usually `unsetComment` (unsetMark) removes it from the selection.
                    // If the comment spans multiple nodes, we might need to do this for all occurrences.
                    // But let's assume for now we just need to trigger the command on the range.
                    // Actually, `unsetMark` removes the mark type from the range.
                    // So if we find *all* ranges with this ID, we can remove them.
                }
            }
        });

        // Better approach: Find all ranges with this mark ID
        const ranges = [];
        this.editor.state.doc.descendants((node, pos) => {
            if (node.marks) {
                const mark = node.marks.find(m => m.type.name === 'comment' && m.attrs.id === id);
                if (mark) {
                    ranges.push({ from: pos, to: pos + node.nodeSize });
                }
            }
        });

        if (ranges.length > 0) {
            // Create a transaction to remove marks
            const tr = this.editor.state.tr;
            ranges.forEach(range => {
                tr.removeMark(range.from, range.to, this.editor.schema.marks.comment);
            });
            this.editor.view.dispatch(tr);
        }

        this.commentsManager.resolveComment(id);
        this.triggerUpdate();

        // Notify listeners to remove mark from other editors (e.g. footnotes)
        this.listeners.forEach(listener => listener({ type: 'remove-comment-mark', id }));
    }

    deleteComment(id) {
        // Remove mark from editor
        if (!this.editor) return;

        // Find all ranges with this mark ID
        const ranges = [];
        this.editor.state.doc.descendants((node, pos) => {
            if (node.marks) {
                const mark = node.marks.find(m => m.type.name === 'comment' && m.attrs.id === id);
                if (mark) {
                    ranges.push({ from: pos, to: pos + node.nodeSize });
                }
            }
        });

        if (ranges.length > 0) {
            // Create a transaction to remove marks
            const tr = this.editor.state.tr;
            ranges.forEach(range => {
                tr.removeMark(range.from, range.to, this.editor.schema.marks.comment);
            });
            this.editor.view.dispatch(tr);
        }

        this.commentsManager.deleteComment(id);
        this.triggerUpdate();

        // Notify listeners to remove mark from other editors (e.g. footnotes)
        this.listeners.forEach(listener => listener({ type: 'remove-comment-mark', id }));
    }

    scrollToComment(id) {
        if (!this.editor) return;

        // Find the mark range
        let from = null;
        let to = null;
        this.editor.state.doc.descendants((node, pos) => {
            if (node.marks) {
                const mark = node.marks.find(m => m.type.name === 'comment' && m.attrs.id === id);
                if (mark) {
                    if (from === null) from = pos;
                    to = pos + node.nodeSize;
                }
            }
        });

        if (from !== null && to !== null) {
            this.editor.chain()
                .setTextSelection({ from, to })
                .scrollIntoView()
                .run();
            return;
        }

        // Not found in main editor, try listeners (FootnoteView)
        this.listeners.forEach(listener => listener({ type: 'scroll-to-comment', id }));
    }

    getComments() {
        return this.commentsManager.getComments();
    }

    updateComment(id, data) {
        this.commentsManager.updateComment(id, data);
    }

    addReply(id, author, content) {
        this.commentsManager.addReply(id, author, content);
    }

    addFootnote() {
        if (this.editor) {
            const id = `fn-${Date.now()}`;
            this.editor.chain().focus().insertContent({
                type: 'footnote',
                attrs: { id, number: '#' }
            }).run();
            return id;
        }
    }

    updateFootnote(id, content) {
        const fn = this.footnotes.find(f => f.id === id);
        if (fn) {
            fn.content = content;
            if (this.onUpdate) {
                this.onUpdate({
                    doc: this.editor.getJSON(),
                    footnotes: this.footnotes
                });
            }
        }
    }

    getFootnotes() {
        return this.footnotes;
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
    getFootnoteSymbol(index) {
        const style = this.styleManager.styles['footnote-symbol'];
        const format = style ? style.format : 'integer';

        if (Array.isArray(format)) {
            // Custom characters
            if (format.length === 0) return String(index);
            // Cycle through: 1->0, 2->1, etc.
            // If index > length, repeat chars? Or just cycle.
            // Standard convention: *, †, ‡, **, ††, ... or just cycle.
            // Let's implement simple cycling for now as per "array of individual characters".
            // Actually, usually it's *, †, ‡, §, ||, ¶...
            // If we run out, we can double them up or just loop.
            // Let's loop for simplicity unless user specified otherwise.
            return format[(index - 1) % format.length];
        }

        switch (format) {
            case 'lower-roman':
                return this.toRoman(index).toLowerCase();
            case 'upper-roman':
                return this.toRoman(index);
            case 'lower-alpha':
                return this.toAlpha(index).toLowerCase();
            case 'upper-alpha':
                return this.toAlpha(index);
            case 'integer':
            default:
                return String(index);
        }
    }

    toRoman(num) {
        const lookup = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
        let roman = '';
        for (let i in lookup) {
            while (num >= lookup[i]) {
                roman += i;
                num -= lookup[i];
            }
        }
        return roman;
    }

    toAlpha(num) {
        // 1 -> A, 26 -> Z, 27 -> AA
        let s = '';
        while (num > 0) {
            let t = (num - 1) % 26;
            s = String.fromCharCode(65 + t) + s;
            num = (num - t) / 26 | 0;
        }
        return s;
    }

    getWordCounts() {
        if (!this.editor) return { main: 0, footnotes: 0 };

        const mainCount = this.countWordsInDoc(this.editor.state.doc);

        let footnotesCount = 0;
        this.footnotes.forEach(fn => {
            if (typeof fn.content === 'string') {
                footnotesCount += this.countWordsInText(fn.content);
            } else if (typeof fn.content === 'object') {
                footnotesCount += this.countWordsInDocNode(fn.content);
            }
        });

        return {
            main: mainCount,
            footnotes: footnotesCount
        };
    }

    countWordsInDoc(doc) {
        let count = 0;
        doc.descendants((node) => {
            if (node.isText) {
                count += this.countWordsInText(node.text);
            }
        });
        return count;
    }

    countWordsInDocNode(node) {
        // Recursive traversal for JSON object
        let count = 0;
        if (node.type === 'text' && node.text) {
            count += this.countWordsInText(node.text);
        }
        if (node.content && Array.isArray(node.content)) {
            node.content.forEach(child => {
                count += this.countWordsInDocNode(child);
            });
        }
        return count;
    }

    countWordsInText(text) {
        if (!text) return 0;
        // Simple word count regex
        const matches = text.match(/\S+/g);
        return matches ? matches.length : 0;
    }
}

module.exports = TiptapAdapter;
