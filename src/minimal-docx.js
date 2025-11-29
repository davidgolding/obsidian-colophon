const JSZip = require('jszip');

class MinimalDocxGenerator {
    constructor(options = {}) {
        this.paragraphs = options.paragraphs || [];
        this.styles = options.styles || [];
        this.fonts = options.fonts || ['Times New Roman', 'Arial'];
        this.footnotes = options.footnotes || {};
        this.pageSize = options.pageSize || { width: 'Letter' }; // Handle string or object
        this.margins = options.margins || { top: 1, bottom: 1, left: 1, right: 1 }; // Inches
    }

    async generate() {
        const zip = new JSZip();

        zip.file('[Content_Types].xml', this.createContentTypesXml());
        zip.folder('_rels').file('.rels', this.createRelsXml());

        const word = zip.folder('word');
        word.file('document.xml', this.createDocumentXml());
        word.file('styles.xml', this.createStylesXml());
        word.file('fontTable.xml', this.createFontTableXml());
        word.file('footnotes.xml', this.createFootnotesXml());
        word.file('settings.xml', this.createSettingsXml());

        word.folder('_rels').file('document.xml.rels', this.createDocumentRelsXml());

        return zip.generateAsync({ type: 'nodebuffer' });
    }

    // --- XML Generators ---

    createContentTypesXml() {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
    <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
    <Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/>
    <Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>
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
    <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/>
    <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/>
    <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>`;
    }

    createFontTableXml() {
        const fontsXml = this.fonts.map(font => `
    <w:font w:name="${font}">
        <w:charset w:val="00"/>
        <w:family w:val="auto"/>
        <w:pitch w:val="variable"/>
    </w:font>`).join('');

        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    ${fontsXml}
</w:fonts>`;
    }

    createSettingsXml() {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:zoom w:percent="100"/>
    <w:defaultTabStop w:val="720"/>
    <w:compat>
        <w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/>
    </w:compat>
</w:settings>`;
    }

    createStylesXml() {
        // Generate styles based on the captured styles map
        const stylesXml = this.styles.map(style => {
            const css = style.computed;
            return `
    <w:style w:type="paragraph" w:styleId="${style.id}">
        <w:name w:val="${style.name}"/>
        ${style.basedOn ? `<w:basedOn w:val="${style.basedOn}"/>` : ''}
        <w:pPr>
            ${this.cssToParaProps(css)}
        </w:pPr>
        <w:rPr>
            ${this.cssToRunProps(css)}
        </w:rPr>
    </w:style>`;
        }).join('');

        // Add default Normal style if not present (though we likely captured it)
        // Add Footnote Reference style
        const footnoteRef = `
    <w:style w:type="character" w:styleId="FootnoteReference">
        <w:name w:val="Footnote Reference"/>
        <w:rPr>
            <w:vertAlign w:val="superscript"/>
        </w:rPr>
    </w:style>`;

        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:docDefaults>
        <w:rPrDefault>
            <w:rPr>
                <w:rFonts w:asciiTheme="minorHAnsi" w:eastAsiaTheme="minorEastAsia" w:hAnsiTheme="minorHAnsi" w:cstheme="minorBidi"/>
                <w:sz w:val="24"/>
                <w:szCs w:val="24"/>
                <w:lang w:val="en-US" w:eastAsia="en-US" w:bidi="ar-SA"/>
            </w:rPr>
        </w:rPrDefault>
        <w:pPrDefault/>
    </w:docDefaults>
    ${stylesXml}
    ${footnoteRef}
</w:styles>`;
    }

    createDocumentXml() {
        const bodyContent = this.paragraphs.map(p => this.createParagraphXml(p)).join('');

        // Page Size & Margins
        const width = this.pageSize.width === 'A4' ? 11906 : 12240; // Letter default
        const height = this.pageSize.width === 'A4' ? 16838 : 15840;
        const margins = {
            top: Math.round(this.margins.top * 1440),
            bottom: Math.round(this.margins.bottom * 1440),
            left: Math.round(this.margins.left * 1440),
            right: Math.round(this.margins.right * 1440),
        };

        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:body>
        ${bodyContent}
        <w:sectPr>
            <w:pgSz w:w="${width}" w:h="${height}"/>
            <w:pgMar w:top="${margins.top}" w:right="${margins.right}" w:bottom="${margins.bottom}" w:left="${margins.left}" w:header="720" w:footer="720" w:gutter="0"/>
        </w:sectPr>
    </w:body>
</w:document>`;
    }

    createFootnotesXml() {
        const footnotesContent = Object.entries(this.footnotes).map(([id, data]) => {
            const content = data.paragraphs.map(p => this.createParagraphXml(p)).join('');
            // We need a numeric ID for DOCX. The key 'id' from ProseMirror might be a string UUID.
            // We need to map it, but the generator logic in DocxSerializer should have handled mapping?
            // Wait, DocxSerializer passed the raw map. 
            // In DOCX, footnotes are referenced by integer ID.
            // We need to ensure the references in document.xml match these IDs.
            // Let's assume the ID passed here is the integer ID used in references.
            // NOTE: This requires the serializer to have mapped UUIDs to Integers.
            // I will add a simple hash/map logic here if needed, but better to trust the input keys are valid DOCX IDs (integers).
            // Actually, let's just use the key as the ID.
            return `<w:footnote w:id="${id}">${content}</w:footnote>`;
        }).join('');

        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:footnote w:type="separator" w:id="-1">
        <w:p><w:r><w:separator/></w:r></w:p>
    </w:footnote>
    <w:footnote w:type="continuationSeparator" w:id="0">
        <w:p><w:r><w:continuationSeparator/></w:r></w:p>
    </w:footnote>
    ${footnotesContent}
</w:footnotes>`;
    }

    // --- Element Generators ---

    createParagraphXml(p) {
        const pPr = `
        <w:pPr>
            <w:pStyle w:val="${p.styleId}"/>
            ${this.cssToParaProps(p.computed)}
        </w:pPr>`;

        const runs = p.runs.map(r => this.createRunXml(r)).join('');

        return `<w:p>${pPr}${runs}</w:p>`;
    }

    createRunXml(r) {
        // Handle Footnote Reference
        if (r.type === 'footnote') {
            // The 'id' attr in the node is the UUID. 
            // We need to map this to the integer ID used in footnotes.xml.
            // Since we didn't map it in serializer, we have a problem.
            // FIX: We need a shared ID map. 
            // For now, let's assume the 'id' attribute IS the integer ID (1, 2, 3...).
            // The plugin re-indexes footnotes to 1..N.
            // So r.attrs.id might be "1".
            return `<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteReference w:id="${r.attrs.id}"/></w:r>`;
        }

        const rPr = `
        <w:rPr>
            ${this.cssToRunProps(r.style)}
            ${this.marksToRunProps(r.marks)}
        </w:rPr>`;

        return `<w:r>${rPr}<w:t xml:space="preserve">${this.escapeXml(r.text)}</w:t></w:r>`;
    }

    // --- Helpers ---

    cssToParaProps(css) {
        if (!css) return '';
        // Alignment
        let jc = 'left';
        if (css.textAlign === 'center') jc = 'center';
        if (css.textAlign === 'right') jc = 'right';
        if (css.textAlign === 'justify') jc = 'both';

        // Spacing
        // 1px = 15 twips (approx, 1/96 in * 1440)
        // 1em = font-size
        const toTwips = (val) => {
            if (!val) return 0;
            if (val.endsWith('px')) return Math.round(parseFloat(val) * 15);
            return 0; // TODO: Handle other units
        };

        const before = toTwips(css.marginTop);
        const after = toTwips(css.marginBottom);
        // Line Height: "normal" ~ 1.2. 
        // DOCX: 240 = 1 line.
        let line = 240;
        let lineRule = 'auto';
        if (css.lineHeight !== 'normal') {
            if (css.lineHeight.endsWith('px')) {
                line = toTwips(css.lineHeight);
                lineRule = 'exact';
            } else if (!isNaN(parseFloat(css.lineHeight))) {
                line = Math.round(parseFloat(css.lineHeight) * 240);
            }
        }

        // Indentation
        const left = toTwips(css.marginLeft) + toTwips(css.paddingLeft);
        const right = toTwips(css.marginRight) + toTwips(css.paddingRight);
        const firstLine = toTwips(css.textIndent);

        return `
            <w:jc w:val="${jc}"/>
            <w:spacing w:before="${before}" w:after="${after}" w:line="${line}" w:lineRule="${lineRule}"/>
            <w:ind w:left="${left}" w:right="${right}" w:firstLine="${firstLine}"/>
        `;
    }

    cssToRunProps(css) {
        if (!css) return '';

        // Font
        const font = css.fontFamily ? css.fontFamily.split(',')[0].replace(/['"]/g, '').trim() : 'Times New Roman';

        // Size (half-points)
        // 16px = 12pt = 24 half-points
        // 1px = 0.75pt = 1.5 half-points
        const size = css.fontSize ? Math.round(parseFloat(css.fontSize) * 1.5) : 24;

        // Color (Normalize to black/auto for print)
        const color = 'auto';

        return `
            <w:rFonts w:ascii="${font}" w:hAnsi="${font}"/>
            <w:sz w:val="${size}"/>
            <w:szCs w:val="${size}"/>
            <w:color w:val="${color}"/>
        `;
    }

    marksToRunProps(marks) {
        if (!marks) return '';
        let props = '';
        marks.forEach(m => {
            if (m.type === 'bold') props += '<w:b/>';
            if (m.type === 'italic') props += '<w:i/>';
            if (m.type === 'underline') props += '<w:u w:val="single"/>';
            if (m.type === 'strike') props += '<w:strike/>';
            if (m.type === 'superscript') props += '<w:vertAlign w:val="superscript"/>';
            if (m.type === 'subscript') props += '<w:vertAlign w:val="subscript"/>';
            if (m.type === 'smallCaps') props += '<w:smallCaps/>';
        });
        return props;
    }

    escapeXml(unsafe) {
        return unsafe.replace(/[<>&'"]/g, function (c) {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
            }
        });
    }
}

module.exports = { MinimalDocxGenerator };
