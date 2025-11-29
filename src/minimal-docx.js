const JSZip = require('jszip');

class MinimalDocxGenerator {
    constructor(options = {}) {
        this.paragraphs = options.paragraphs || [];
        this.styles = options.styles || [];
        this.defaultFont = options.defaultFont || 'Times New Roman';
        this.defaultFontSize = options.defaultFontSize || 22; // 11pt
        this.pageSize = options.pageSize || { width: 12240, height: 15840 }; // Letter
        this.margins = options.margins || { top: 1440, bottom: 1440, left: 1440, right: 1440 }; // 1 inch
        this.footnotes = options.footnotes || {}; // Map of ID -> { paragraphs: [] }
        this.footnoteFormat = options.footnoteFormat || 'integer';
    }

    createContentTypesXml() {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
    <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
    <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
    <Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>
</Types>`;
    }

    createRelsXml() {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
    }

    createDocumentRelsXml() {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
        <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
        <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/>
    </Relationships>`;
    }

    createStylesXml() {
        const styleElements = this.styles.map(style => {
            const runProps = style.run || {};
            const paraProps = style.paragraph || {};
            
            const fontSize = runProps.size || style.fontSize || this.defaultFontSize;
            const font = runProps.font || style.font || this.defaultFont;
            const bold = runProps.bold || style.bold;
            const italic = runProps.italics || style.italic; // Note: converter uses 'italics', minimal used 'italic'
            const smallCaps = runProps.smallCaps || style.smallCaps;
            const color = runProps.color || style.color;
            
            const spacing = paraProps.spacing || style.spacing;
            const indent = paraProps.indent || style.indent;
            const alignment = paraProps.alignment || style.alignment;
            
            let spacingXml = '';
            if (spacing) {
                const before = spacing.before !== undefined ? ` w:before="${spacing.before}"` : '';
                const after = spacing.after !== undefined ? ` w:after="${spacing.after}"` : '';
                const line = spacing.line !== undefined ? ` w:line="${spacing.line}"` : '';
                const lineRule = spacing.lineRule !== undefined ? ` w:lineRule="${spacing.lineRule}"` : '';
                spacingXml = `<w:spacing${before}${after}${line}${lineRule}/>`;
            }
            
            let indentXml = '';
            if (indent) {
                const left = indent.left !== undefined ? ` w:left="${indent.left}"` : '';
                const right = indent.right !== undefined ? ` w:right="${indent.right}"` : '';
                const firstLine = indent.firstLine !== undefined ? ` w:firstLine="${indent.firstLine}"` : '';
                const hanging = indent.hanging !== undefined ? ` w:hanging="${indent.hanging}"` : '';
                indentXml = `<w:ind${left}${right}${firstLine}${hanging}/>`;
            }
            
            let jcXml = '';
            if (alignment) {
                jcXml = `<w:jc w:val="${alignment}"/>`;
            }
    
            return `
                <w:style w:type="${style.type || 'paragraph'}" w:styleId="${style.id}">
                <w:name w:val="${style.name}"/>
                ${style.basedOn ? `<w:basedOn w:val="${style.basedOn}"/>` : ''}
                <w:pPr>
                    ${spacingXml}
                    ${indentXml}
                    ${jcXml}
                </w:pPr>
                <w:rPr>
                    <w:rFonts w:ascii="${font}" w:hAnsi="${font}"/>
                    <w:sz w:val="${fontSize}"/>
                    <w:szCs w:val="${fontSize}"/>
                    ${bold ? '<w:b/>' : ''}
                    ${italic ? '<w:i/>' : ''}
                    ${smallCaps ? '<w:smallCaps/>' : ''}
                    ${color ? `<w:color w:val="${color}"/>` : ''}
                </w:rPr>
                </w:style>`;
        }).join('');

        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" mc:Ignorable="w14">
                ${styleElements}
            </w:styles>`;
    }

    escapeXml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    createRunXml(run) {
        const text = this.escapeXml(run.text);
        const size = run.size || this.defaultFontSize;
        const font = run.font || this.defaultFont;
    
        const props = [];
        if (run.bold) props.push('<w:b/>');
        if (run.italic) props.push('<w:i/>');
        if (run.underline) props.push('<w:u w:val="single"/>');
        if (run.smallCaps) props.push('<w:smallCaps/>');
        if (run.strike) props.push('<w:strike/>');
        if (run.superScript) props.push('<w:vertAlign w:val="superscript"/>');
        if (run.subScript) props.push('<w:vertAlign w:val="subscript"/>');
        if (run.color) props.push(`<w:color w:val="${run.color}"/>`);
        if (run.position) props.push(`<w:position w:val="${run.position}"/>`);
        if (run.vertAlign) props.push(`<w:vertAlign w:val="${run.vertAlign}"/>`);
        if (run.break) return '<w:r><w:br/></w:r>';
        if (run.footnoteRef) {
            const styleXml = run.style ? `<w:rPr><w:rStyle w:val="${run.style}"/></w:rPr>` : '';
            return `<w:r>${styleXml}<w:footnoteRef/></w:r>`;
        }
        if (run.footnoteReference) {
            const styleXml = run.style ? `<w:rPr><w:rStyle w:val="${run.style}"/></w:rPr>` : '';
            return `<w:r>${styleXml}<w:footnoteReference w:id="${run.footnoteReference}"/></w:r>`;
        }
        
        if (run.font) props.push(`<w:rFonts w:ascii="${font}" w:hAnsi="${font}"/>`);
        if (run.size) {
            props.push(`<w:sz w:val="${size}"/>`);
            props.push(`<w:szCs w:val="${size}"/>`);
        }
    
        const propsXml = props.length > 0 ? `<w:rPr>${props.join('')}</w:rPr>` : '';
    
        return `
            <w:r>
                ${propsXml}
                <w:t xml:space="preserve">${text}</w:t>
            </w:r>`;
    }

    createParagraphXml(paragraph) {
        const runs = paragraph.runs.map(run => this.createRunXml(run)).join('');
    
        const pPrElements = [];
    
        if (paragraph.style) {
            pPrElements.push(`<w:pStyle w:val="${paragraph.style}"/>`);
        }
    
        if (paragraph.alignment) {
            pPrElements.push(`<w:jc w:val="${paragraph.alignment}"/>`);
        }
    
        if (paragraph.indent !== undefined) {
        // Handle simple number or object
        if (typeof paragraph.indent === 'number') {
            pPrElements.push(`<w:ind w:left="${paragraph.indent}"/>`);
        } else {
            const left = paragraph.indent.left !== undefined ? ` w:left="${paragraph.indent.left}"` : '';
            const right = paragraph.indent.right !== undefined ? ` w:right="${paragraph.indent.right}"` : '';
            const firstLine = paragraph.indent.firstLine !== undefined ? ` w:firstLine="${paragraph.indent.firstLine}"` : '';
            pPrElements.push(`<w:ind${left}${right}${firstLine}/>`);
        }
        }
    
        if (paragraph.spacing) {
            const before = paragraph.spacing.before !== undefined ? ` w:before="${paragraph.spacing.before}"` : '';
            const after = paragraph.spacing.after !== undefined ? ` w:after="${paragraph.spacing.after}"` : '';
            const line = paragraph.spacing.line !== undefined ? ` w:line="${paragraph.spacing.line}"` : '';
            const lineRule = paragraph.spacing.lineRule !== undefined ? ` w:lineRule="${paragraph.spacing.lineRule}"` : '';
            pPrElements.push(`<w:spacing${before}${after}${line}${lineRule}/>`);
        }
    
        if (paragraph.heading) {
            const lvl = parseInt(paragraph.heading) - 1;
            if (!isNaN(lvl) && lvl >= 0) {
                pPrElements.push(`<w:outlineLvl w:val="${lvl}"/>`);
            }
        }
    
        const pPrXml = pPrElements.length > 0 ? `<w:pPr>${pPrElements.join('')}</w:pPr>` : '';
    
        return `
            <w:p>
            ${pPrXml}${runs}
            </w:p>`;
    }

    createDocumentXml() {
        const paragraphsXml = this.paragraphs.map(p => this.createParagraphXml(p)).join('');
    
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
            <w:body>
                ${paragraphsXml}
                <w:sectPr>
                <w:pgSz w:w="${this.pageSize.width}" w:h="${this.pageSize.height}"/>
                <w:pgMar w:top="${this.margins.top}" w:right="${this.margins.right}" w:bottom="${this.margins.bottom}" w:left="${this.margins.left}" w:header="720" w:footer="720" w:gutter="0"/>
                </w:sectPr>
            </w:body>
            </w:document>`;
    }

    createSettingsXml() {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
            <w:doNotAutoCompressPictures w:val="false"/>
            <w:attachedTemplate r:id=""/>
            <w:footnotePr>
                <w:numFmt w:val="${this.getDocxNumberFormat(this.footnoteFormat)}"/>
            </w:footnotePr>
            </w:settings>`;
    }

    getDocxNumberFormat(format) {
        const map = {
            'integer': 'decimal',
            'lower-roman': 'lowerRoman',
            'upper-roman': 'upperRoman',
            'lower-alpha': 'lowerLetter',
            'upper-alpha': 'upperLetter',
            'symbols': 'chicago' // *, †, ‡, etc.
        };
        return map[format] || 'decimal';
    }

    async generate() {
        const zip = new JSZip();
    
        // Add [Content_Types].xml
        zip.file('[Content_Types].xml', this.createContentTypesXml());
    
        // Add _rels/.rels
        zip.folder('_rels');
        zip.file('_rels/.rels', this.createRelsXml());
    
        // Add word folder and files
        zip.folder('word');
        zip.folder('word/_rels');
        zip.file('word/_rels/document.xml.rels', this.createDocumentRelsXml());
        zip.file('word/document.xml', this.createDocumentXml());
        zip.file('word/styles.xml', this.createStylesXml());
        zip.file('word/settings.xml', this.createSettingsXml());
        zip.file('word/footnotes.xml', this.createFootnotesXml());
    
        return zip.generateAsync({ type: 'nodebuffer' });
    }

    createFootnotesXml() {
        const footnotesXml = Object.entries(this.footnotes).map(([id, footnote]) => {
            const paragraphsXml = footnote.paragraphs.map(p => this.createParagraphXml(p)).join('');
            return `
                <w:footnote w:id="${id}">
                ${paragraphsXml}
                </w:footnote>`;
        }).join('');
    
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
            <w:footnote w:type="separator" w:id="-1">
                <w:p>
                <w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>
                <w:r><w:separator/></w:r>
                </w:p>
            </w:footnote>
            <w:footnote w:type="continuationSeparator" w:id="0">
                <w:p>
                <w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>
                <w:r><w:continuationSeparator/></w:r>
                </w:p>
            </w:footnote>
            ${footnotesXml}
            </w:footnotes>`;
    }


}

function createRun(text, options = {}) {
    return Object.assign({ text }, options);
}

function createParagraph(runs, options = {}) {
    return Object.assign({ runs: Array.isArray(runs) ? runs : [runs] }, options);
}

module.exports = { MinimalDocxGenerator, createRun, createParagraph };
