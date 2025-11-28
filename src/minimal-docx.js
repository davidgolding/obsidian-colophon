const JSZip = require('jszip');

class MinimalDocxGenerator {
    constructor(options = {}) {
        this.paragraphs = options.paragraphs || [];
        this.styles = options.styles || [];
        this.defaultFont = options.defaultFont || 'Calibri';
        this.defaultFontSize = options.defaultFontSize || 22; // 11pt
        this.pageSize = options.pageSize || { width: 12240, height: 15840 }; // Letter
        this.margins = options.margins || { top: 1440, bottom: 1440, left: 1440, right: 1440 }; // 1 inch
    }

    createContentTypesXml() {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
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
    <w:style w:type="paragraph" w:styleId="${style.id}">
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
  <w:docDefaults>
        <w:rPrDefault>
            <w:rPr>
                <w:rFonts w:ascii="Times New Roman" w:cs="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Arial Unicode MS" />
                <w:b w:val="0" />
                <w:bCs w:val="0" />
                <w:i w:val="0" />
                <w:iCs w:val="0" />
                <w:caps w:val="0" />
                <w:smallCaps w:val="0" />
                <w:strike w:val="0" />
                <w:dstrike w:val="0" />
                <w:outline w:val="0" />
                <w:emboss w:val="0" />
                <w:imprint w:val="0" />
                <w:vanish w:val="0" />
                <w:color w:val="auto" />
                <w:spacing w:val="0" />
                <w:w w:val="100" />
                <w:kern w:val="0" />
                <w:position w:val="0" />
                <w:sz w:val="20" />
                <w:szCs w:val="20" />
                <w:u w:val="none" w:color="auto" />
                <w:bdr w:val="nil" />
                <w:vertAlign w:val="baseline" />
                <w:lang />
            </w:rPr>
        </w:rPrDefault>
        <w:pPrDefault>
            <w:pPr>
                <w:keepNext w:val="0" />
                <w:keepLines w:val="0" />
                <w:pageBreakBefore w:val="0" />
                <w:framePr w:anchorLock="0" w:w="0" w:h="0" w:vSpace="0" w:hSpace="0" w:xAlign="left" w:y="0" w:hRule="exact" w:vAnchor="margin" />
                <w:widowControl w:val="1" />
                <w:numPr>
                    <w:ilvl w:val="0" />
                    <w:numId w:val="0" />
                </w:numPr>
                <w:suppressLineNumbers w:val="0" />
                <w:pBdr>
                    <w:top w:val="nil" />
                    <w:left w:val="nil" />
                    <w:bottom w:val="nil" />
                    <w:right w:val="nil" />
                    <w:between w:val="nil" />
                    <w:bar w:val="nil" />
                </w:pBdr>
                <w:shd w:val="clear" w:color="auto" w:fill="auto" />
                <w:suppressAutoHyphens w:val="0" />
                <w:spacing w:before="0" w:beforeAutospacing="0" w:after="0" w:afterAutospacing="0" w:line="240" w:lineRule="auto" />
                <w:ind w:left="0" w:right="0" w:firstLine="0" />
                <w:jc w:val="left" />
                <w:outlineLvl w:val="9" />
            </w:pPr>
        </w:pPrDefault>
    </w:docDefaults>
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
        if (run.break) return '<w:r><w:br/></w:r>';

        // Only add font/size if explicitly different from default or style? 
        // For now, let's rely on style unless overridden. 
        // But the mock implementation adds them always. 
        // Let's keep it simple: if run has specific font/size, add it.
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
            // Outline level
            // heading is 1-based (Heading 1 = 0 in outlineLvl? No, Heading 1 is outlineLvl 0)
            // Actually, w:outlineLvl val="0" is for Heading 1.
            // paragraph.heading comes as enum or number? 
            // Let's assume it's a number 1-9.
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
</w:settings>`;
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

        return await zip.generateAsync({ type: 'nodebuffer' });
    }
}

function createRun(text, options = {}) {
    return Object.assign({ text }, options);
}

function createParagraph(runs, options = {}) {
    return Object.assign({ runs: Array.isArray(runs) ? runs : [runs] }, options);
}

module.exports = { MinimalDocxGenerator, createRun, createParagraph };
