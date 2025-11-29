const { Extension } = require('@tiptap/core');
const { MinimalDocxGenerator } = require('../minimal-docx');
const { Notice } = require('obsidian');
const electron = require('electron');
const fs = require('fs');

const DocxSerializer = Extension.create({
    name: 'docxSerializer',

    addCommands() {
        return {
            exportToDocx: (options) => async ({ editor, view }) => {
                const { settings, footnoteView } = options;

                try {
                    new Notice('Preparing DOCX export...');

                    // 1. Traverse and Process Main Document
                    const { paragraphs, styles, fonts } = processDocument(view, editor.state.doc);

                    // 2. Process Footnotes
                    const footnotes = processFootnotes(footnoteView, editor);

                    // 3. Generate DOCX
                    const generator = new MinimalDocxGenerator({
                        paragraphs,
                        styles,
                        fonts,
                        footnotes,
                        pageSize: settings.pageSize,
                        margins: settings.margins
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

function processDocument(view, doc) {
    const paragraphs = [];
    const styles = new Map(); // Map<id, styleDef>
    const fonts = new Set(['Times New Roman', 'Arial', 'Symbol']); // Standard fonts

    doc.forEach((node, offset) => {
        const dom = view.nodeDOM(offset);
        if (!dom || !(dom instanceof Element)) return;

        const computed = getComputedStyle(dom);
        const styleId = registerStyle(styles, computed, node.type.name, node.attrs);

        // Extract Font
        const font = cleanFont(computed.fontFamily);
        if (font) fonts.add(font);

        // Process Children (Runs)
        const runs = [];
        if (node.content && node.content.size > 0) {
            node.content.forEach((child, childOffset) => {
                // Find DOM for child. 
                // view.nodeDOM(pos) returns the DOM node.
                // The pos is absolute.
                const childPos = offset + 1 + childOffset;
                // Note: nodeDOM might return text node for text.
                // We need the parent element for computed styles usually, 
                // but for text nodes, we look at the parent or specific spans.
                // Tiptap renders text as text nodes, marks as spans.

                // Actually, getting computed style for every text node is tricky because 
                // text nodes don't have styles. We need the parent element or the span wrapping it.
                // If it's a mark, Tiptap wraps it.

                // Strategy: Use the resolved DOM from the view for the specific position.
                // However, view.domAtPos(pos) gives the DOM node at that position.

                const domAtPos = view.domAtPos(childPos);
                let element = domAtPos.node;
                if (element.nodeType === 3) element = element.parentElement; // Text node -> parent

                const childComputed = getComputedStyle(element);
                const runFont = cleanFont(childComputed.fontFamily);
                if (runFont) fonts.add(runFont);

                runs.push({
                    text: child.text,
                    style: childComputed, // Pass full computed style for extraction later
                    marks: child.marks,
                    type: child.type.name,
                    attrs: child.attrs
                });
            });
        }

        paragraphs.push({
            type: node.type.name,
            styleId: styleId,
            computed: computed, // Paragraph level computed style
            runs: runs,
            attrs: node.attrs
        });
    });

    return {
        paragraphs,
        styles: Array.from(styles.values()),
        fonts: Array.from(fonts)
    };
}

function processFootnotes(footnoteView, mainEditor) {
    const footnotes = {};
    if (!footnoteView) return footnotes;

    // Get all footnote references from main doc to know which IDs we need
    // Actually, we can just dump all footnotes available in the view.

    footnoteView.editors.forEach((editor, id) => {
        // We need to process this mini-doc similar to the main doc
        // But we need to get the DOM from the footnote view's editor instance
        const view = editor.view;
        const doc = editor.state.doc;

        const { paragraphs } = processDocument(view, doc);
        footnotes[id] = { paragraphs };
    });

    return footnotes;
}

function registerStyle(stylesMap, computed, type, attrs) {
    // Create a unique ID based on semantic type or visual properties?
    // For DOCX, we want semantic styles if possible (Heading 1, Body).
    // Let's map based on Tiptap type/attrs.

    let id = 'Normal';
    let name = 'Normal';
    let basedOn = null;

    if (type === 'heading') {
        id = `Heading${attrs.level}`;
        name = `Heading ${attrs.level}`;
        basedOn = 'Normal';
    } else if (attrs.class === 'Footnote') {
        id = 'FootnoteText';
        name = 'Footnote Text';
        basedOn = 'Normal';
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

function cleanFont(fontStack) {
    if (!fontStack) return 'Times New Roman';
    // "Minion 3", serif -> Minion 3
    return fontStack.split(',')[0].replace(/['"]/g, '').trim();
}

module.exports = DocxSerializer;
