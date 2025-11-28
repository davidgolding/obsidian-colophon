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

        // Flatten stylesConfig (which is { styles: { default, paragraphStyles }, styleIdMap }) 
        // passed from main.js is actually just docxStyles (the object with default/paragraphStyles)
        // Wait, main.js passes: new DocxGenerator(view, docxStyles, styleIdMap)
        // docxStyles has { default, paragraphStyles }
        // Minimal generator expects array of styles.

        const styles = this.stylesConfig.paragraphStyles || [];
        // We might need to handle default style separately or merge it?
        // Minimal generator has hardcoded defaults but accepts styles array.
        // Let's pass the paragraph styles.

        const generator = new MinimalDocxGenerator({
            paragraphs: paragraphs,
            styles: styles,
            pageSize: pageSize,
            margins: margins,
            footnotes: this.docxFootnotes,
            footnoteFormat: this.stylesConfig.default?.['footnote-symbol']?.format || 'integer',
            defaultFont: this.stylesConfig.default?.document?.run?.font || 'Minion 3',
            defaultFontSize: this.stylesConfig.default?.document?.run?.size || 24
        });

        return generator.generate();
    }

    processNode(node) {
        if (node.type.name === 'paragraph') {
            return this.createParagraph(node);
        } else if (node.type.name === 'heading') {
            return this.createHeading(node);
        }
        return null;
    }

    createParagraph(node) {
        const runs = this.processInlineContent(node);

        const styleKey = node.attrs.class || 'body';
        const styleId = this.styleIdMap[styleKey] || styleKey;

        return createParagraph(runs, {
            style: styleId
        });
    }

    createHeading(node) {
        const runs = this.processInlineContent(node);

        const styleKey = node.attrs.class || `heading-${node.attrs.level}`;
        const styleId = this.styleIdMap[styleKey] || styleKey;

        const options = {
            style: styleId
        };

        // Only apply structural heading level if it's a standard heading
        if (!node.attrs.class || node.attrs.class.startsWith('heading-')) {
            options.heading = node.attrs.level; // Pass number 1-6
        }

        return createParagraph(runs, options);
    }

    processInlineContent(node) {
        const runs = [];
        if (node.content) {
            node.content.forEach(child => {
                if (child.type.name === 'text') {
                    runs.push(this.createTextRun(child));
                } else if (child.type.name === 'footnote') {
                    // Handle footnote reference
                    const footnoteId = child.attrs.id;
                    const docxId = this.getDocxFootnoteId(footnoteId);

                    // Add reference run
                    runs.push(createRun('', { footnoteReference: docxId }));

                    // Process footnote content if not already processed
                    if (!this.docxFootnotes[docxId]) {
                        this.processFootnoteContent(footnoteId, docxId);
                    }

                } else if (child.type.name === 'hard_break') {
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
                if (mark.type.name === 'bold') options.bold = true;
                if (mark.type.name === 'italic') options.italic = true;
                if (mark.type.name === 'strike') options.strike = true;
                if (mark.type.name === 'underline') options.underline = true;
                if (mark.type.name === 'superscript') options.superScript = true;
                if (mark.type.name === 'subscript') options.subScript = true;
                if (mark.type.name === 'smallCaps') options.smallCaps = true;
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
        const footnoteTextStyle = this.styleIdMap['footnote'] || 'FootnoteText';
        // Use footnote-symbol for the reference marker style
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
                // Prepend marker run
                // Actually, let's look at how Word does it.
                // <w:footnote ...>
                //   <w:p>
                //     <w:pPr><w:pStyle w:val="FootnoteText"/></w:pPr>
                //     <w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteRef/></w:r>
                //     <w:r><w:t>Actual text</w:t></w:r>
                //   </w:p>
                // </w:footnote>

                // So I need to add `footnoteRef` support to createRun in minimal-docx.
                // Let's add it as a run option.
                firstPara.runs.unshift(createRun('', { footnoteRef: true }));

                // Force style to FootnoteText for all paragraphs in footnote?
                // Or just the first? Usually all.
                nodes.forEach(p => {
                    if (!p.style || p.style === 'body') p.style = 'FootnoteText';
                });
            } else {
                // Fallback if no content
                nodes.push(createParagraph([
                    createRun('', { footnoteRef: true }),
                    createRun(' ')
                ], { style: 'FootnoteText' }));
            }
            paragraphs = nodes;
        }

        this.docxFootnotes[docxId] = { paragraphs };
    }
}

module.exports = DocxGenerator;
