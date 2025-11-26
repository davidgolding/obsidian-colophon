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
const PopoverMenu = require('./popover-menu');
const Footnote = require('./extensions/footnote');
const Substitutions = require('./extensions/substitutions');
const InternalLink = require('./extensions/internallink');
const StandardLink = require('./extensions/standard-link');
const StyleManager = require('./style-manager');
const DEFAULT_STYLES = require('./default-styles');
const { parseYaml } = require('obsidian');

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
    constructor(app, containerEl, isSpellcheckEnabled, settings, onUpdate) {
        this.app = app;
        this.containerEl = containerEl; // This is the scrollable container
        this.isSpellcheckEnabled = isSpellcheckEnabled;
        this.settings = settings;
        this.onUpdate = onUpdate; // Callback when editor content changes
        this.editor = null;
        this.isLoaded = false;
        this.popover = null;
        this.footnotes = []; // Store footnote definitions: { id, content }
        this.listeners = []; // Listeners for footnote updates
        this.styleManager = new StyleManager();
        this.paragraphOptions = [];
        this.listOptions = [];
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

    load(markdown, data, filePath) {
        this.filePath = filePath;

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
            }
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
    }

    initEditor(content) {
        // The editor is mounted in a child div to separate it from the scrollable container
        const editorHost = this.containerEl.createDiv('colophon-editor-host');

        // Load styles asynchronously
        this.loadStyles().then(() => {
            // Styles loaded
        });

        this.editor = new Editor({
            element: editorHost,
            extensions: [
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
                })
            ],
            editorProps: {
                attributes: {
                    spellcheck: this.isSpellcheckEnabled ? 'true' : 'false',
                },
            },
            content: content,
            onUpdate: ({ editor }) => {
                this.triggerUpdate();
            },
            onSelectionUpdate: ({ editor }) => {
                this.handleScroll();
            }
        });

        // Initialize Popover with empty options initially, updated by loadStyles
        this.popover = new PopoverMenu(this.editor, this.containerEl, this.paragraphOptions || [], this.listOptions || []);
        this.popover.setMode('default');

        // Add Context Menu Listener
        this.editor.view.dom.addEventListener('contextmenu', (e) => {
            const { from, to } = this.editor.state.selection;
            if (from !== to) {
                e.preventDefault();

                // Get selection coordinates
                const selection = window.getSelection();
                if (selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    const selectionRect = range.getBoundingClientRect();
                    const containerRect = this.containerEl.getBoundingClientRect();

                    // Calculate target rect relative to container content
                    const targetRect = {
                        left: selectionRect.left - containerRect.left + this.containerEl.scrollLeft,
                        top: selectionRect.top - containerRect.top + this.containerEl.scrollTop,
                        width: selectionRect.width,
                        height: selectionRect.height
                    };

                    this.popover.show(targetRect);
                }
            }
        });
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

            // Generate CSS
            const css = this.styleManager.generateCSS(styles);
            this.injectStyles(css);

            // Get Options
            const { paragraphOptions, listOptions } = this.styleManager.getStyleOptions(styles);
            this.paragraphOptions = paragraphOptions;
            this.listOptions = listOptions;

            // Update Popover
            if (this.popover) {
                this.popover.updateStyleOptions(this.paragraphOptions, this.listOptions);
            }
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
                const number = String(index++);
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
                footnotes: this.footnotes
            });
        }

        // Notify listeners (e.g. FootnoteView)
        this.listeners.forEach(listener => listener());
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
