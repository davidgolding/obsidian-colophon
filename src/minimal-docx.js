const JSZip = require('jszip');

class MinimalDocxGenerator {
    constructor(options = {}) {
        this.paragraphs = options.paragraphs || [];
        this.styles = options.styles || [];
        this.fonts = options.fonts || ['Times New Roman', 'Arial'];
        this.footnotes = options.footnotes || {};
        this.pageSize = options.pageSize || { width: 'Letter' };
        this.margins = options.margins || { top: 1, bottom: 1, left: 1, right: 1 };
        this.stylesConfig = options.stylesConfig || {}; // Source of truth from YAML/Settings
        this.footnoteIdMap = new Map(); // Map<stringId, intId>
    }

    async generate() {
        const zip = new JSZip();

        // 0. Map Footnote IDs to Integers (1-based)
        let fnIndex = 1;
        Object.keys(this.footnotes).forEach(id => {
            this.footnoteIdMap.set(id, fnIndex++);
        });

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

    minifyXMLString(xml) {
        xml = xml.replace(/<!--[\s\S]*?-->/g, ''); // Remove XML comments (<!-- ... -->)

        const cdataBlocks = []; // Preserve CDATA sections by temporarily replacing them
        xml = xml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (match) => {
            cdataBlocks.push(match);
            return `__CDATA_${cdataBlocks.length - 1}__`;
        });
        xml = xml.replace(/>\s+</g, '><'); // Remove whitespace between tags (but not within text content)
        xml = xml.replace(/\s*=\s*/g, '='); // Remove whitespace around = in attributes
        xml = xml.replace(/<([^>]+)>/g, (match, content) => { // Remove extra whitespace within tags (multiple spaces/newlines between attributes)
            return '<' + content.replace(/\s+/g, ' ').trim() + '>';
        });
        cdataBlocks.forEach((block, i) => { // Restore CDATA sections
            xml = xml.replace(`__CDATA_${i}__`, block);
        });
        return xml.trim(); // Remove leading and trailing whitespace
    }

    // --- XML Generators ---

    createContentTypesXml() {
        return this.minifyXMLString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
    <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
    <Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/>
    <Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>
    <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
</Types>`);
    }

    createRelsXml() {
        return this.minifyXMLString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
    }

    createDocumentRelsXml() {
        return this.minifyXMLString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
    <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/>
    <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/>
    <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>`);
    }

    createFontTableXml() {
        const fontsXml = this.fonts.map(font => `
    <w:font w:name="${font}">
        <w:charset w:val="00"/>
        <w:family w:val="auto"/>
        <w:pitch w:val="variable"/>
    </w:font>`).join('');

        return this.minifyXMLString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    ${fontsXml}
</w:fonts>`);
    }

    createSettingsXml() {
        return this.minifyXMLString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:zoom w:percent="100"/>
    <w:defaultTabStop w:val="720"/>
    <w:compat>
        <w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/>
    </w:compat>
</w:settings>`);
    }

    createStylesXml() {
        const generatedIds = new Set();
        let stylesXml = '';

        // 1. Generate styles from stylesConfig (Source of Truth)
        for (const [key, config] of Object.entries(this.stylesConfig)) {
            if (key === 'scale' || key === 'footnote-number') continue;

            const { id, name, basedOn } = this.getDocxStyleInfo(key, config);

            // Generate properties using ONLY config (css=null)
            const pPr = this.cssToParaProps(null, id);
            const rPr = this.cssToRunProps(null, id);

            stylesXml += `
    <w:style w:type="paragraph" w:styleId="${id}">
        <w:name w:val="${name}"/>
        ${basedOn ? `<w:basedOn w:val="${basedOn}"/>` : ''}
        <w:pPr>
            ${pPr}
        </w:pPr>
        <w:rPr>
            ${rPr}
        </w:rPr>
    </w:style>`;
            generatedIds.add(id);
        }

        // 2. Fallback: Generate styles found in document but NOT in config
        // (e.g. if user used a style that isn't in the config file?)
        this.styles.forEach(style => {
            if (!generatedIds.has(style.id)) {
                const css = style.computed;
                const pPr = this.cssToParaProps(css, style.id);
                const rPr = this.cssToRunProps(css, style.id);

                stylesXml += `
    <w:style w:type="paragraph" w:styleId="${style.id}">
        <w:name w:val="${style.name}"/>
        ${style.basedOn ? `<w:basedOn w:val="${style.basedOn}"/>` : ''}
        <w:pPr>
            ${pPr}
        </w:pPr>
        <w:rPr>
            ${rPr}
        </w:rPr>
    </w:style>`;
                generatedIds.add(style.id);
            }
        });

        const footnoteRef = `
    <w:style w:type="character" w:styleId="FootnoteReference">
        <w:name w:val="Footnote Reference"/>
        <w:rPr>
            <w:vertAlign w:val="superscript"/>
        </w:rPr>
    </w:style>
    <w:style w:type="character" w:styleId="FootnoteSymbol">
        <w:name w:val="Footnote Symbol"/>
        <w:rPr>
            ${this.cssToRunProps(null, 'FootnoteSymbol')}
        </w:rPr>
    </w:style>`;

        return this.minifyXMLString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
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
</w:styles>`);
    }

    createDocumentXml() {
        const bodyContent = this.paragraphs.map(p => this.createParagraphXml(p)).join('');

        const width = this.pageSize.width === 'A4' ? 11906 : 12240;
        const height = this.pageSize.width === 'A4' ? 16838 : 15840;
        const margins = {
            top: Math.round(this.margins.top * 1440),
            bottom: Math.round(this.margins.bottom * 1440),
            left: Math.round(this.margins.left * 1440),
            right: Math.round(this.margins.right * 1440),
        };

        return this.minifyXMLString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:body>
        ${bodyContent}
        <w:sectPr>
            <w:pgSz w:w="${width}" w:h="${height}"/>
            <w:pgMar w:top="${margins.top}" w:right="${margins.right}" w:bottom="${margins.bottom}" w:left="${margins.left}" w:header="720" w:footer="720" w:gutter="0"/>
        </w:sectPr>
    </w:body>
</w:document>`);
    }

    createFootnotesXml() {
        const footnotesContent = Object.entries(this.footnotes).map(([id, data]) => {
            const intId = this.footnoteIdMap.get(id);
            // Ensure data.paragraphs exists. If data is just the paragraph object (as user snippet suggested might happen?), handle it.
            // But based on docx-serializer, it should be { paragraphs: [] }.
            // Let's be robust:
            const paragraphs = data.paragraphs || (Array.isArray(data) ? data : [data]);

            const content = paragraphs.map((p, index) => {
                // Force FootnoteText style
                const pCopy = { ...p, styleId: 'FootnoteText' };

                // Prepend footnote marker to the first paragraph
                if (index === 0) {
                    // We need to inject a run at the beginning
                    // <w:r><w:rPr><w:rStyle w:val="FootnoteSymbol"/></w:rPr><w:footnoteRef/></w:r>
                    // We can't easily modify pCopy.runs if we use createParagraphXml directly unless we modify it.
                    // Let's manually construct the XML for the first paragraph to include the marker.

                    const pPr = `
        <w:pPr>
            <w:pStyle w:val="FootnoteText"/>
            ${this.cssToParaProps(p.computed, 'FootnoteText')}
        </w:pPr>`;

                    const markerRun = `<w:r><w:rPr><w:rStyle w:val="FootnoteSymbol"/></w:rPr><w:footnoteRef/></w:r><w:r><w:t xml:space="preserve"> </w:t></w:r>`; // Add space after marker?
                    const runs = p.runs.map(r => this.createRunXml(r, 'FootnoteText')).join('');
                    return `<w:p>${pPr}${markerRun}${runs}</w:p>`;
                }

                return this.createParagraphXml(pCopy);
            }).join('');

            return `<w:footnote w:id="${intId}">${content}</w:footnote>`;
        }).join('');

        return this.minifyXMLString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:footnote w:type="separator" w:id="-1">
        <w:p><w:r><w:separator/></w:r></w:p>
    </w:footnote>
    <w:footnote w:type="continuationSeparator" w:id="0">
        <w:p><w:r><w:continuationSeparator/></w:r></w:p>
    </w:footnote>
    ${footnotesContent}
</w:footnotes>`);
    }

    // --- Element Generators ---

    createParagraphXml(p) {
        // Pass styleId to look up overrides
        const pPr = `
        <w:pPr>
            <w:pStyle w:val="${p.styleId}"/>
            ${this.cssToParaProps(p.computed, p.styleId)}
        </w:pPr>`;

        const runs = p.runs.map(r => this.createRunXml(r, p.styleId)).join('');
        return `<w:p>${pPr}${runs}</w:p>`;
    }

    createRunXml(r, styleId) {
        if (r.type === 'footnote') {
            const intId = this.footnoteIdMap.get(r.attrs.id);
            // If ID not found (shouldn't happen if sync is correct), fallback or warn?
            // If undefined, it might break XML. Use 0 or -1? Or keep original if not found?
            // Let's use the mapped ID if available, else original (though original string ID is invalid).
            const idToUse = intId !== undefined ? intId : r.attrs.id;
            return `<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteReference w:id="${idToUse}"/></w:r>`;
        }

        const rPr = `
        <w:rPr>
            ${this.cssToRunProps(r.style, styleId)}
            ${this.marksToRunProps(r.marks)}
        </w:rPr>`;

        return `<w:r>${rPr}<w:t xml:space="preserve">${this.escapeXml(r.text)}</w:t></w:r>`;
    }

    // --- Helpers ---

    getDocxStyleInfo(key, config) {
        let id = key;
        let name = config.name || key;
        let basedOn = 'Normal';

        if (key === 'body') {
            id = 'Normal';
            name = 'Normal';
            basedOn = null;
        } else if (key === 'title') {
            id = 'Title';
            name = 'Title';
            basedOn = 'Normal';
        } else if (key === 'subtitle') {
            id = 'Subtitle';
            name = 'Subtitle';
            basedOn = 'Title';
        } else if (key.startsWith('heading-')) {
            const level = key.replace('heading-', '');
            id = `Heading${level}`;
            name = `Heading ${level}`;
            basedOn = 'Normal';
        } else if (key === 'footnote') {
            id = 'FootnoteText';
            name = 'Footnote Text';
            basedOn = 'Normal';
        } else if (key === 'footnote-symbol') {
            id = 'FootnoteSymbol';
            name = 'Footnote Symbol';
            basedOn = 'DefaultParagraphFont'; // Character style
        }

        return { id, name, basedOn };
    }

    /**
     * Converts CSS to Paragraph Properties.
     * Checks `this.stylesConfig` for overrides based on `styleId`.
     */
    cssToParaProps(css, styleId) {
        // Check for override
        let configKey = null;
        if (styleId === 'Normal') configKey = 'body';
        else if (styleId === 'Title') configKey = 'title';
        else if (styleId === 'Subtitle') configKey = 'subtitle';
        else if (styleId === 'FootnoteText') configKey = 'footnote';
        else if (styleId === 'FootnoteSymbol') configKey = 'footnote-symbol';
        else if (styleId && styleId.startsWith('Heading')) {
            const level = styleId.replace('Heading', '');
            configKey = `heading-${level}`;
        } else {
            // Fallback: assume styleId IS the configKey (for custom styles)
            configKey = styleId;
        }

        const override = configKey ? this.stylesConfig[configKey] : null;

        // --- Alignment ---
        let jc = 'left';
        if (override && override['text-align']) {
            jc = override['text-align'];
        } else if (css && css.textAlign) {
            if (css.textAlign === 'center') jc = 'center';
            if (css.textAlign === 'right') jc = 'right';
            if (css.textAlign === 'justify') jc = 'both';
        }

        // --- Spacing ---
        let before = 0;
        let after = 0;
        let line = 240;
        let lineRule = 'auto';

        // Before
        if (override && (override['margin-top'] || override['before-paragraph'])) {
            before = this.parseUnit(override['margin-top'] || override['before-paragraph'], 'twips');
        } else if (css) {
            before = this.parseUnit(css.marginTop, 'twips');
        }

        // After
        if (override && (override['margin-bottom'] || override['after-paragraph'])) {
            after = this.parseUnit(override['margin-bottom'] || override['after-paragraph'], 'twips');
        } else if (css) {
            after = this.parseUnit(css.marginBottom, 'twips');
        }

        // Line Height
        if (override && (override['line-height'] || override['line-spacing'])) {
            const val = override['line-height'] || override['line-spacing'];
            if (String(val).match(/^[0-9.]+$/)) {
                // Multiplier
                line = Math.round(parseFloat(val) * 240);
                lineRule = 'auto';
            } else {
                // Exact
                line = this.parseUnit(val, 'twips');
                lineRule = 'exact';
            }
        } else if (css && css.lineHeight !== 'normal') {
            if (css.lineHeight.endsWith('px')) {
                line = this.parseUnit(css.lineHeight, 'twips');
                lineRule = 'exact';
            } else if (!isNaN(parseFloat(css.lineHeight))) {
                line = Math.round(parseFloat(css.lineHeight) * 240);
            }
        }

        // --- Indentation ---
        let left = 0;
        let right = 0;
        let firstLine = 0;

        // Left
        if (override && (override['margin-left'] || override['left-indent'])) {
            left = this.parseUnit(override['margin-left'] || override['left-indent'], 'twips');
        } else if (css) {
            left = this.parseUnit(css.marginLeft, 'twips') + this.parseUnit(css.paddingLeft, 'twips');
        }

        // Right
        if (override && (override['margin-right'] || override['right-indent'])) {
            right = this.parseUnit(override['margin-right'] || override['right-indent'], 'twips');
        } else if (css) {
            right = this.parseUnit(css.marginRight, 'twips') + this.parseUnit(css.paddingRight, 'twips');
        }

        // First Line
        if (override && (override['text-indent'] || override['first-indent'])) {
            firstLine = this.parseUnit(override['text-indent'] || override['first-indent'], 'twips');
        } else if (css) {
            firstLine = this.parseUnit(css.textIndent, 'twips');
        }

        return `
            <w:jc w:val="${jc}"/>
            <w:spacing w:before="${before}" w:after="${after}" w:line="${line}" w:lineRule="${lineRule}"/>
            <w:ind w:left="${left}" w:right="${right}" w:firstLine="${firstLine}"/>
        `;
    }

    /**
     * Converts CSS to Run Properties.
     * Checks `this.stylesConfig` for overrides based on `styleId`.
     */
    cssToRunProps(css, styleId) {
        let configKey = null;
        if (styleId === 'Normal') configKey = 'body';
        else if (styleId === 'Title') configKey = 'title';
        else if (styleId === 'Subtitle') configKey = 'subtitle';
        else if (styleId === 'FootnoteText') configKey = 'footnote';
        else if (styleId === 'FootnoteSymbol') configKey = 'footnote-symbol';
        else if (styleId && styleId.startsWith('Heading')) {
            const level = styleId.replace('Heading', '');
            configKey = `heading-${level}`;
        } else {
            configKey = styleId;
        }

        const override = configKey ? this.stylesConfig[configKey] : null;

        // --- Font ---
        let font = 'Times New Roman';
        if (override && override['font-family']) {
            font = cleanFont(override['font-family']);
        } else if (css && css.fontFamily) {
            font = cleanFont(css.fontFamily);
        }

        // --- Size ---
        let size = 24; // 12pt
        if (override && override['font-size']) {
            size = this.parseUnit(override['font-size'], 'half-points');
        } else if (css && css.fontSize) {
            size = this.parseUnit(css.fontSize, 'half-points');
        }

        // Color (Normalize to black/auto for print)
        const color = 'auto';

        // --- Inline Styles from Config ---
        let bold = '';
        let italic = '';
        let underline = '';
        let strike = '';
        let smallCaps = '';
        let vertAlign = '';

        if (override) {
            if (override['font-weight'] === 'bold') bold = '<w:b/>';
            if (override['font-variant'] === 'Italic' || override['font-style'] === 'italic') italic = '<w:i/>';
            if (override['text-decoration'] === 'underline') underline = '<w:u w:val="single"/>';
            if (override['text-decoration'] === 'line-through') strike = '<w:strike/>';
            if (override['font-variant'] === 'small-caps') smallCaps = '<w:smallCaps/>';
            if (override['vertical-align'] === 'super') vertAlign = '<w:vertAlign w:val="superscript"/>';
            if (override['vertical-align'] === 'sub') vertAlign = '<w:vertAlign w:val="subscript"/>';
        } else if (css) {
            if (css.fontWeight === 'bold' || parseInt(css.fontWeight) >= 700) bold = '<w:b/>';
            if (css.fontStyle === 'italic') italic = '<w:i/>';
            if (css.textDecorationLine.includes('underline')) underline = '<w:u w:val="single"/>';
            if (css.textDecorationLine.includes('line-through')) strike = '<w:strike/>';
            if (css.fontVariant === 'small-caps') smallCaps = '<w:smallCaps/>';
            if (css.verticalAlign === 'super') vertAlign = '<w:vertAlign w:val="superscript"/>';
            if (css.verticalAlign === 'sub') vertAlign = '<w:vertAlign w:val="subscript"/>';
        }

        return `
            <w:rFonts w:ascii="${font}" w:hAnsi="${font}"/>
            <w:sz w:val="${size}"/>
            <w:szCs w:val="${size}"/>
            <w:color w:val="${color}"/>
            ${bold}
            ${italic}
            ${underline}
            ${strike}
            ${smallCaps}
            ${vertAlign}
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

    /**
     * Parses a unit string (e.g., "12pt", "0.5in", "16px") into DOCX units.
     * targetUnit: 'twips' (1/1440 in) or 'half-points' (1/144 in).
     */
    parseUnit(value, targetUnit = 'twips') {
        if (!value) return 0;
        const str = String(value).trim();
        const num = parseFloat(str);
        if (isNaN(num)) return 0;

        let points = 0;

        if (str.endsWith('pt')) points = num;
        else if (str.endsWith('in')) points = num * 72;
        else if (str.endsWith('mm')) points = num * 2.835;
        else if (str.endsWith('cm')) points = num * 28.35;
        else if (str.endsWith('px')) points = num * 0.75; // Approx 96dpi
        else if (str.endsWith('pc')) points = num * 12;
        else points = num; // Assume points if no unit, or px? Let's assume points for safety in DOCX context, but CSS is usually px.
        // If it came from getComputedStyle, it's likely px.
        // If it came from YAML, user might omit unit.
        // Let's assume px if no unit and it looks like a CSS value, but for YAML "11.5" usually means pt.
        // Let's stick to the unit check. If no unit, treat as pt for YAML compatibility.

        if (targetUnit === 'twips') {
            return Math.round(points * 20);
        } else {
            // half-points
            return Math.round(points * 2);
        }
    }
}

function cleanFont(fontStack) {
    if (!fontStack) return 'Times New Roman';

    // Resolve CSS variables if running in browser
    if (typeof window !== 'undefined' && typeof document !== 'undefined' && fontStack.includes('var(')) {
        fontStack = fontStack.replace(/var\((--[^)]+)\)/g, (match, varName) => {
            const val = getComputedStyle(document.body).getPropertyValue(varName).trim();
            return val || '';
        });
    }

    // "Minion 3", serif -> Minion 3
    const fonts = fontStack.split(',').map(f => f.trim().replace(/['"]/g, ''));
    const validFont = fonts.find(f => f && f !== '??' && f.toLowerCase() !== 'undefined' && f !== '');
    return validFont || 'Times New Roman';
}

module.exports = { MinimalDocxGenerator, cleanFont };
