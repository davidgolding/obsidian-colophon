const { MinimalDocxGenerator, createRun, createParagraph } = require('./minimal-docx');

class DocxGenerator {
    constructor(view, stylesConfig, styleIdMap) {
        this.view = view;
        this.stylesConfig = stylesConfig;
        this.styleIdMap = styleIdMap;
        this.footnotes = view.adapter ? view.adapter.footnotes : [];
        this.footnoteCounter = 0;
        this.docxFootnotes = {};
        this.footnoteIdMap = {};
    }

    generate(doc, exportSettings) {
        const paragraphs = [];

        doc.content.forEach(node => {
            const element = this.processNode(node);
            if (element) {
                if (Array.isArray(element)) {
                    paragraphs.push(...element);
                } else {
                    paragraphs.push(element);
                }
            }
        });

        const pageSizeMap = {
            'Letter': { width: 12240, height: 15840 },
            'A4': { width: 11906, height: 16838 },
            'Legal': { width: 12240, height: 20160 }
        };
        const pageSize = pageSizeMap[exportSettings.pageSize] || pageSizeMap['Letter'];

        // Convert margins to twips
        const toTwips = (val) => Math.round(parseFloat(val) * 1440);

        const margins = {
            top: toTwips(exportSettings.margins.top),
            bottom: toTwips(exportSettings.margins.bottom),
            left: toTwips(exportSettings.margins.left),
            right: toTwips(exportSettings.margins.right),
        };

        const styles = this.stylesConfig.paragraphStyles || [];

        const generator = new MinimalDocxGenerator({
            paragraphs: paragraphs,
            styles: styles,
            pageSize: pageSize,
            margins: margins,
            footnotes: this.docxFootnotes,
            footnoteFormat: this.stylesConfig.default?.['footnote-symbol']?.format || 'integer',
            defaultFont: this.stylesConfig.default?.document?.run?.font || 'Times New Roman',
            defaultFontSize: this.stylesConfig.default?.document?.run?.size || 24
        });

        return generator.generate();
    }

    getTypeName(nodeOrMark) {
        if (typeof nodeOrMark.type === 'string') return nodeOrMark.type;
        if (nodeOrMark.type && nodeOrMark.type.name) return nodeOrMark.type.name;
        return null;
    }

    processNode(node) {
        const type = this.getTypeName(node);
        if (type === 'paragraph') {
            return this.createParagraph(node);
        } else if (type === 'heading') {
            return this.createHeading(node);
        }
        return null;
    }

    createParagraph(node) {
        const runs = this.processInlineContent(node);

        const styleKey = (node.attrs && node.attrs.class) || 'body';
        const styleId = this.styleIdMap[styleKey] || styleKey;

        return createParagraph(runs, {
            style: styleId
        });
    }

    createHeading(node) {
        const runs = this.processInlineContent(node);

        const styleKey = (node.attrs && node.attrs.class) || `heading-${(node.attrs && node.attrs.level) || 1}`;
        const styleId = this.styleIdMap[styleKey] || styleKey;

        const options = {
            style: styleId
        };

        // Only apply structural heading level if it's a standard heading
        if (!node.attrs || !node.attrs.class || node.attrs.class.startsWith('heading-')) {
            options.heading = (node.attrs && node.attrs.level) || 1; // Pass number 1-6
        }

        return createParagraph(runs, options);
    }

    processInlineContent(node) {
        const runs = [];
        if (node.content) {
            node.content.forEach(child => {
                const type = this.getTypeName(child);
                if (type === 'text') {
                    runs.push(this.createTextRun(child));
                } else if (type === 'footnote') {
                    // Handle footnote reference
                    const footnoteId = (child.attrs && child.attrs.id) || null;
                    if (!footnoteId) return; // Skip if no ID

                    const docxId = this.getDocxFootnoteId(footnoteId);

                    // Get mapped style for the reference marker in main text
                    const footnoteRefStyle = this.styleIdMap['footnote-symbol'] || 'FootnoteReference';

                    // Add reference run with style
                    runs.push(createRun('', {
                        footnoteReference: docxId,
                        style: footnoteRefStyle
                    }));

                    // Process footnote content if not already processed
                    if (!this.docxFootnotes[docxId]) {
                        this.processFootnoteContent(footnoteId, docxId);
                    }

                } else if (type === 'hard_break') {
                    runs.push(createRun('', { break: true }));
                }
            });
        }
        return runs;
    }

    createTextRun(node) {
        const options = {};

        if (node.marks) {
            node.marks.forEach(mark => {
                const type = this.getTypeName(mark);
                if (type === 'bold') options.bold = true;
                if (type === 'italic') options.italic = true;
                if (type === 'strike') options.strike = true;
                if (type === 'underline') options.underline = true;
                if (type === 'superscript') options.superScript = true;
                if (type === 'subscript') options.subScript = true;
                if (type === 'smallCaps') options.smallCaps = true;
            });
        }

        return createRun(node.text, options);
    }

    getDocxFootnoteId(internalId) {
        if (!this.footnoteIdMap) this.footnoteIdMap = {};
        if (!this.footnoteIdMap[internalId]) {
            this.footnoteCounter++;
            this.footnoteIdMap[internalId] = this.footnoteCounter;
        }
        return this.footnoteIdMap[internalId];
    }

    processFootnoteContent(internalId, docxId) {
        // Get mapped style IDs
        // Use keys from default-styles.js / stylesConfig
        const footnoteTextStyle = this.styleIdMap['footnote'] || 'FootnoteText';
        const footnoteRefStyle = this.styleIdMap['footnote-symbol'] || 'FootnoteReference';

        const footnoteData = this.footnotes.find(f => f.id === internalId);
        if (!footnoteData) {
            // Empty footnote if not found, but MUST include marker
            this.docxFootnotes[docxId] = {
                paragraphs: [
                    createParagraph([
                        createRun('', { footnoteRef: true, style: footnoteRefStyle }),
                        createRun(' ')
                    ], { style: footnoteTextStyle })
                ]
            };
            return;
        }

        const content = footnoteData.content;
        let paragraphs = [];

        if (typeof content === 'string') {
            // Simple text content
            paragraphs.push(createParagraph([
                createRun('', { footnoteRef: true, style: footnoteRefStyle }), // Marker
                createRun(' ' + content)
            ], { style: footnoteTextStyle }));
        } else if (typeof content === 'object' && content.type === 'doc') {
            // ProseMirror JSON
            const nodes = [];
            if (content.content) {
                content.content.forEach(node => {
                    const processed = this.processNode(node);
                    if (processed) {
                        if (Array.isArray(processed)) nodes.push(...processed);
                        else nodes.push(processed);
                    }
                });
            }

            // Inject marker into first paragraph
            if (nodes.length > 0 && nodes[0].runs) {
                nodes[0].runs.unshift(createRun('', {
                    footnoteRef: true,
                    style: footnoteRefStyle
                }));

                nodes[0].runs.splice(1, 0, createRun(' '));

                // Force style to FootnoteText for all paragraphs in footnote
                nodes.forEach(p => {
                    p.style = footnoteTextStyle;
                });
            } else {
                // Fallback if no content
                nodes.push(createParagraph([
                    createRun('', { footnoteRef: true, style: footnoteRefStyle }),
                    createRun(' ')
                ], { style: footnoteTextStyle }));
            }
            paragraphs = nodes;
        }

        this.docxFootnotes[docxId] = { paragraphs };
    }
}

module.exports = DocxGenerator;
