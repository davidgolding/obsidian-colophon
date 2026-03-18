import { Extension } from '@tiptap/core';
import { MinimalDocxGenerator, cleanFont } from '../minimal-docx';
import { Notice } from 'obsidian';

// Note: In 2.0, we use electron directly from obsidian's global if needed, 
// but for 'showSaveDialog', we usually use the desktop API.
// Obsidian provides 'app.vault.adapter' for some things, 
// but for a native save dialog on desktop, electron is required.
const electron = require('electron');
const fs = require('fs');

export const DocxSerializer = Extension.create({
    name: 'docxSerializer',

    addCommands() {
        return {
            exportToDocx: (options) => async ({ editor, view }) => {
                const { settings, footnotes, stylesConfig } = options;

                try {
                    new Notice('Preparing DOCX export...');

                    // 1. Process Main Document
                    const { paragraphs, styles, fonts } = processDocument(editor.view, editor.state.doc, stylesConfig);

                    // 2. Process Footnotes
                    const processedFootnotes = processFootnotes(editor.view, footnotes, stylesConfig);

                    // 3. Generate DOCX
                    const generator = new MinimalDocxGenerator({
                        paragraphs,
                        styles,
                        fonts,
                        footnotes: processedFootnotes,
                        pageSize: settings.pageSize,
                        margins: settings.margins,
                        stylesConfig: stylesConfig
                    });

                    const buffer = await generator.generate();

                    // 4. Save File
                    const activeView = editor.options.adapter?.view;
                    const fileName = (activeView?.file?.basename || 'Untitled') + '.docx';
                    
                    const result = await electron.remote.dialog.showSaveDialog({
                        title: 'Export to Word (.docx)',
                        defaultPath: fileName,
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
    const styles = new Map();
    const fonts = new Set(['Times New Roman', 'Arial', 'Symbol']);

    function traverse(node, pos) {
        if (node.isText) return;

        // In 2.0, most blocks are custom node types (body, title, etc.)
        // We identify them as blocks that are not the root 'doc' node.
        const isBlock = node.isBlock && node.type.name !== 'doc';

        if (isBlock) {
            const dom = view.nodeDOM(pos);
            const computed = dom && dom instanceof Element ? getComputedStyle(dom) : {};
            const styleId = registerStyle(styles, computed, node.type.name, node.attrs, stylesConfig);

            if (computed.fontFamily) {
                const font = cleanFont(computed.fontFamily);
                if (font) fonts.add(font);
            }

            const runs = [];
            if (node.content && node.content.size > 0) {
                node.content.forEach((child, childOffset) => {
                    const childPos = pos + 1 + childOffset;

                    let childComputed = {};
                    try {
                        const domAtPos = view.domAtPos(childPos);
                        let element = domAtPos.node;
                        if (element.nodeType === 3) element = element.parentElement;
                        if (element) childComputed = getComputedStyle(element);
                    } catch (e) {
                        // Fallback to parent computed if child fails
                        childComputed = computed;
                    }

                    if (childComputed.fontFamily) {
                        const runFont = cleanFont(childComputed.fontFamily);
                        if (runFont) fonts.add(runFont);
                    }

                    const marks = child.marks ? child.marks.map(m => ({ type: m.type.name, attrs: m.attrs })) : [];

                    // 2.0 Internal Links handling (mapped to bold text for visual parity)
                    if (child.type.name === 'internalLink') {
                        const alias = child.attrs.alias || child.attrs.target || 'Link';
                        runs.push({
                            text: alias,
                            style: childComputed,
                            marks: [...marks, { type: 'bold' }],
                            type: 'text',
                            attrs: {}
                        });
                        return;
                    }

                    runs.push({
                        text: child.text || '',
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

            return;
        }

        let childPos = pos + 1;
        if (node.type.name === 'doc') childPos = 0;

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

function processFootnotes(mainView, footnotes, stylesConfig) {
    const processed = {};
    if (!footnotes) return processed;

    // In 2.0, footnotes is a dictionary: id -> doc
    // We need to render them temporarily or simulate a view to get computed styles
    // Since MinimalDocxGenerator uses stylesConfig as source of truth, 
    // we can rely more on that for footnotes if DOM isn't available.

    for (const [id, doc] of Object.entries(footnotes)) {
        // We simulate a document traversal. 
        // Note: Footnotes in 2.0 are often just one paragraph of type 'body'.
        const paragraphs = [];
        
        doc.content.forEach(node => {
            // Simplified processing for footnotes since they don't have a live view usually
            const styleId = 'FootnoteText'; // Standard DOCX style for footnotes
            
            const runs = [];
            if (node.content && Array.isArray(node.content)) {
                node.content.forEach(child => {
                    if (child.type === 'text') {
                        runs.push({
                            text: child.text || '',
                            style: {},
                            marks: child.marks ? child.marks.map(m => ({ type: m.type.name, attrs: m.attrs })) : [],
                            type: 'text',
                            attrs: {}
                        });
                    } else if (child.type === 'internalLink') {
                        runs.push({
                            text: child.attrs.alias || child.attrs.target || 'Link',
                            style: {},
                            marks: [{ type: 'bold' }],
                            type: 'text',
                            attrs: {}
                        });
                    }
                });
            }

            paragraphs.push({
                type: node.type,
                styleId: styleId,
                computed: {}, // Will use stylesConfig fallback
                runs: runs,
                attrs: node.attrs || {}
            });
        });

        processed[id] = { paragraphs };
    }

    return processed;
}

function registerStyle(stylesMap, computed, type, attrs, stylesConfig) {
    let id = 'Normal';
    let name = 'Normal';
    let basedOn = null;

    // Map 2.0 node types to DOCX standard styles
    if (type === 'body' || type === 'body-first') {
        id = 'Normal';
        name = 'Normal';
    } else if (type === 'title') {
        id = 'Title';
        name = 'Title';
        basedOn = 'Normal';
    } else if (type === 'subtitle') {
        id = 'Subtitle';
        name = 'Subtitle';
        basedOn = 'Title';
    } else if (type.startsWith('heading-')) {
        const level = type.replace('heading-', '');
        id = `Heading${level}`;
        name = `Heading ${level}`;
        basedOn = 'Normal';
    } else if (type === 'footnote') {
        id = 'FootnoteText';
        name = 'Footnote Text';
        basedOn = 'Normal';
    } else if (stylesConfig && stylesConfig[type]) {
        id = type;
        name = stylesConfig[type].name || type;
        basedOn = 'Normal';
    }

    if (!stylesMap.has(id)) {
        stylesMap.set(id, {
            id,
            name,
            type: 'paragraph',
            basedOn,
            computed: computed
        });
    }
    return id;
}
