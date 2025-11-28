const { Document, Packer, Paragraph, TextRun, HeadingLevel, PageOrientation, FootnoteReferenceRun } = require('docx');

class DocxGenerator {
    constructor(view, stylesConfig, styleIdMap) {
        this.view = view;
        this.stylesConfig = stylesConfig;
        this.styleIdMap = styleIdMap;
        this.footnotes = view.adapter ? view.adapter.footnotes : [];
        this.footnoteCounter = 0;
        this.docxFootnotes = {};
    }

    generate(doc, exportSettings) {
        const children = [];

        doc.content.forEach(node => {
            const element = this.processNode(node);
            if (element) {
                if (Array.isArray(element)) {
                    children.push(...element);
                } else {
                    children.push(element);
                }
            }
        });

        const pageSizeMap = {
            'Letter': { width: 12240, height: 15840 },
            'A4': { width: 11906, height: 16838 },
            'Legal': { width: 12240, height: 20160 }
        };
        const pageSize = pageSizeMap[exportSettings.pageSize] || pageSizeMap['Letter'];

        // Convert margins to twips (approximate if string, but assuming number from modal for now? 
        // actually modal returns strings like "1", so we need to convert)
        // Helper to convert inches/string to twips
        const toTwips = (val) => Math.round(parseFloat(val) * 1440);

        const margins = {
            top: toTwips(exportSettings.margins.top),
            bottom: toTwips(exportSettings.margins.bottom),
            left: toTwips(exportSettings.margins.left),
            right: toTwips(exportSettings.margins.right),
        };

        const docxDoc = new Document({
            // externalStyles: '', // Attempt to suppress defaults if possible, or just rely on our styles
            sections: [{
                properties: {
                    page: {
                        size: {
                            width: pageSize.width,
                            height: pageSize.height,
                            orientation: PageOrientation.PORTRAIT
                        },
                        margin: margins
                    }
                },
                children: children,
                footnotes: this.docxFootnotes
            }],
            styles: this.stylesConfig
        });

        return Packer.toBuffer(docxDoc);
    }

    processNode(node) {
        if (node.type.name === 'paragraph') {
            return this.createParagraph(node);
        } else if (node.type.name === 'heading') {
            return this.createHeading(node);
        }
        // Handle other top-level blocks if necessary
        return null;
    }

    createParagraph(node) {
        const children = this.processInlineContent(node);

        const styleKey = node.attrs.class || 'body';
        const styleId = this.styleIdMap[styleKey] || styleKey;

        return new Paragraph({
            style: styleId,
            children: children
        });
    }

    createHeading(node) {
        const children = this.processInlineContent(node);

        const styleKey = node.attrs.class || `heading-${node.attrs.level}`;
        const styleId = this.styleIdMap[styleKey] || styleKey;

        const options = {
            style: styleId,
            children: children
        };

        // Only apply structural heading level if it's a standard heading
        // or if no class is provided (defaulting to standard heading)
        if (!node.attrs.class || node.attrs.class.startsWith('heading-')) {
            const headingLevelMap = [
                HeadingLevel.HEADING_1,
                HeadingLevel.HEADING_2,
                HeadingLevel.HEADING_3,
                HeadingLevel.HEADING_4,
                HeadingLevel.HEADING_5,
                HeadingLevel.HEADING_6,
            ];
            options.heading = headingLevelMap[node.attrs.level - 1] || HeadingLevel.HEADING_1;
        }

        return new Paragraph(options);
    }

    processInlineContent(node) {
        const children = [];
        if (node.content) {
            node.content.forEach(child => {
                if (child.type.name === 'text') {
                    children.push(this.createTextRun(child));
                } else if (child.type.name === 'footnote') {
                    children.push(this.createFootnote(child));
                } else if (child.type.name === 'hard_break') {
                    children.push(new TextRun({ break: 1 }));
                }
            });
        }
        return children;
    }

    createTextRun(node) {
        const options = {
            text: node.text
        };

        if (node.marks) {
            node.marks.forEach(mark => {
                if (mark.type.name === 'bold') options.bold = true;
                if (mark.type.name === 'italic') options.italics = true;
                if (mark.type.name === 'strike') options.strike = true;
                if (mark.type.name === 'underline') options.underline = {};
                if (mark.type.name === 'superscript') options.superScript = true;
                if (mark.type.name === 'subscript') options.subScript = true;
                if (mark.type.name === 'smallCaps') options.smallCaps = true;
            });
        }

        return new TextRun(options);
    }

    createFootnote(node) {
        const id = node.attrs.id;
        const fnData = this.footnotes.find(f => f.id === id);
        const content = fnData ? fnData.content : '';

        this.footnoteCounter++;
        const refId = this.footnoteCounter;

        // Register footnote in the document's footnote collection
        this.docxFootnotes[refId] = {
            children: [new Paragraph({
                children: [new TextRun(content)]
            })]
        };

        return new FootnoteReferenceRun(refId);
    }
}

module.exports = DocxGenerator;
