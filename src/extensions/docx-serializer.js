const { Extension } = require('@tiptap/core');
const { MinimalDocxGenerator, cleanFont } = require('../minimal-docx');
const { Notice } = require('obsidian');
const electron = require('electron');
const fs = require('fs');

const DocxSerializer = Extension.create({
    name: 'docxSerializer',

    addCommands() {
        return {
            exportToDocx: (options) => async ({ editor, view }) => {
                const { settings, footnoteView, stylesConfig } = options;

                try {
                    new Notice('Preparing DOCX export...');

                    // 1. Traverse and Process Main Document
                    const { paragraphs, styles, fonts } = processDocument(view, editor.state.doc, stylesConfig);

                    // 2. Process Footnotes
                    const footnotes = processFootnotes(footnoteView, editor);

                    // 3. Generate DOCX
                    const generator = new MinimalDocxGenerator({
                        paragraphs,
                        styles,
                        fonts,
                        footnotes,
                        pageSize: settings.pageSize,
                        margins: settings.margins,
                        stylesConfig: stylesConfig // Pass source of truth styles
                    });

                    const buffer = await generator.generate();

                    // 4. Save File
                    const defaultPath = (view.props.file?.basename || 'Untitled') + '.docx';
                    const result = await electron.remote.dialog.showSaveDialog({
                        title: 'Export to Word (.docx)',
                        defaultPath: defaultPath,
                        filters: [{ name: 'Word Document', extensions: ['docx'] }]
                    });

                    if (result.canceled || !result.filePath) {
                        new Notice('Export cancelled.');
                        return true;
                    }

                    fs.writeFile(result.filePath, buffer, (err) => {
                        if (err) {
                            console.error('Colophon: Failed to save Word (.docx) file.', err);
                            new Notice('Failed to save file.');
                        } else {
                            new Notice('File saved successfully!');
                        }
                    });

                    return true;
                } catch (error) {
                    console.error('DOCX Export Error:', error);
                    new Notice(`Export failed: ${error.message}`);
                    return false;
                }
            }
        };
    }
});

function processDocument(view, doc, stylesConfig) {
    const paragraphs = [];
    const styles = new Map(); // Map<id, styleDef>
    const fonts = new Set(['Times New Roman', 'Arial', 'Symbol']); // Standard fonts

    function traverse(node, pos) {
        if (node.isText) return;

        const isBlock = node.type.name === 'paragraph' || node.type.name === 'heading';

        if (isBlock) {
            const dom = view.nodeDOM(pos);
            if (!dom || !(dom instanceof Element)) {
                // Try to find the element if nodeDOM returns text or null (rare for block)
                // But if it fails, we can't get computed styles easily.
                // Fallback?
            }

            const computed = dom && dom instanceof Element ? getComputedStyle(dom) : {};
            const styleId = registerStyle(styles, computed, node.type.name, node.attrs, stylesConfig);

            // Extract Font
            if (computed.fontFamily) {
                const font = cleanFont(computed.fontFamily);
                if (font) fonts.add(font);
            }

            // Process Children (Runs)
            const runs = [];
            if (node.content && node.content.size > 0) {
                node.content.forEach((child, childOffset) => {
                    const childPos = pos + 1 + childOffset;

                    // For runs, we need computed styles too.
                    // view.domAtPos(childPos)
                    let childComputed = {};
                    try {
                        const domAtPos = view.domAtPos(childPos);
                        let element = domAtPos.node;
                        if (element.nodeType === 3) element = element.parentElement;
                        if (element) childComputed = getComputedStyle(element);
                    } catch (e) {
                        // Ignore
                    }

                    if (childComputed.fontFamily) {
                        const runFont = cleanFont(childComputed.fontFamily);
                        if (runFont) fonts.add(runFont);
                    }

                    // Map marks
                    const marks = child.marks ? child.marks.map(m => ({ type: m.type.name, attrs: m.attrs })) : [];

                    // Force bold for internal links (check marks, not node type)
                    const hasLinkMark = child.marks && child.marks.some(m => ['internal-link', 'internalLink', 'wikilink', 'internallink'].includes(m.type.name));
                    if (hasLinkMark) {
                        marks.push({ type: 'bold' });
                    }

                    runs.push({
                        text: child.text || '', // Ensure text is not undefined
                        style: childComputed,
                        marks: marks,
                        type: child.type.name,
                        attrs: child.attrs
                    });
                });
            }

            paragraphs.push({
                type: node.type.name,
                styleId: styleId,
                computed: computed,
                runs: runs,
                attrs: node.attrs
            });

            return; // Don't traverse children of paragraph
        }

        // Recurse for containers (doc, bulletList, orderedList, listItem)
        let childPos = pos + 1; // +1 for start tag of container
        if (node.type.name === 'doc') childPos = 0; // Doc starts at 0

        node.content.forEach((child) => {
            traverse(child, childPos);
            childPos += child.nodeSize;
        });
    }

    traverse(doc, 0);

    return {
        paragraphs,
        styles: Array.from(styles.values()),
        fonts: Array.from(fonts)
    };
}

function processFootnotes(footnoteView, mainEditor) {
    const footnotes = {};
    if (!footnoteView) return footnotes;

    footnoteView.editors.forEach((editor, id) => {
        const view = editor.view;
        const doc = editor.state.doc;
        const { paragraphs } = processDocument(view, doc, {});
        footnotes[id] = { paragraphs };
    });

    return footnotes;
}

function registerStyle(stylesMap, computed, type, attrs, stylesConfig) {
    // Create a unique ID based on semantic type or visual properties?
    // For DOCX, we want semantic styles if possible (Heading 1, Body).
    // Let's map based on Tiptap type/attrs.

    let id = 'Normal';
    let name = 'Normal';
    let basedOn = null;

    // 1. Check for explicit class mapping first
    if (attrs && attrs.class) {
        const cls = attrs.class; // Keep case sensitivity matching config keys usually? Tiptap classes are usually lowercase.

        if (cls === 'body') {
            // Map 'body' class to 'Normal' style for DOCX defaults
            id = 'Normal';
            name = 'Normal';
        } else if (cls === 'title') {
            id = 'Title';
            name = 'Title';
            basedOn = 'Normal';
        } else if (cls === 'subtitle') {
            id = 'Subtitle';
            name = 'Subtitle';
            basedOn = 'Title';
        } else if (cls.startsWith('heading-')) {
            const level = cls.replace('heading-', '');
            id = `Heading${level}`;
            name = `Heading ${level}`;
            basedOn = 'Normal';
        } else if (cls === 'footnote') {
            id = 'FootnoteText';
            name = 'Footnote Text';
            basedOn = 'Normal';
        } else if (stylesConfig && stylesConfig[cls]) {
            // Generic mapping for any other style found in config
            id = cls;
            name = stylesConfig[cls].name || cls;
            basedOn = 'Normal';
        }
    }

    // 2. Fallback based on node type if ID is still default (and not explicitly set to Normal by body class)
    // Actually, if it was 'body', it is 'Normal'.
    // If it wasn't matched above, it's still 'Normal'.
    // Check specific types if not matched by class.

    if (id === 'Normal' && (!attrs || !attrs.class || attrs.class === 'body')) {
        if (type === 'heading') {
            id = `Heading${attrs.level}`;
            name = `Heading ${attrs.level}`;
            basedOn = 'Normal';
        }
    }

    if (!stylesMap.has(id)) {
        stylesMap.set(id, {
            id,
            name,
            type: 'paragraph',
            basedOn,
            // We will extract the visual properties from the first occurrence
            // to define the style in styles.xml
            computed: computed
        });
    }
    return id;
}

module.exports = DocxSerializer;
