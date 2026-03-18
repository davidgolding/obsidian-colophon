import JSZip from 'jszip';

export class MinimalDocxGenerator {
    constructor(options = {}) {
        this.paragraphs = options.paragraphs || [];
        this.styles = options.styles || [];
        this.fonts = options.fonts || ['Times New Roman', 'Arial'];
        this.footnotes = options.footnotes || {};
        
        // Fix P1-001: Normalize pageSize to object with width
        const rawPageSize = options.pageSize || 'Letter';
        this.pageSize = typeof rawPageSize === 'string' ? { width: rawPageSize } : rawPageSize;
        
        this.margins = options.margins || { top: 1, bottom: 1, left: 1, right: 1 };
        this.stylesConfig = options.stylesConfig || {}; // Source of truth from 2.0 Settings (blocks)
        
        // Fix P1-002: Store scale factor
        this.scale = (options.scale || 100) / 100;
        
        this.footnoteIdMap = new Map(); // Map<stringId, intId>
        this.comments = options.comments || {};
        this.commentIdMap = new Map(); // Map<stringId, intId>
    }

    async generate() {
        const zip = new JSZip();

        // 0. Map IDs to Integers (1-based)
        let fnIndex = 1;
        Object.keys(this.footnotes).forEach(id => {
            this.footnoteIdMap.set(id, fnIndex++);
        });

        let cmIndex = 0;
        Object.keys(this.comments).forEach(id => {
            this.commentIdMap.set(id, cmIndex++);
        });

        zip.file('[Content_Types].xml', this.createContentTypesXml());
        zip.folder('_rels').file('.rels', this.createRelsXml());

        const word = zip.folder('word');
        word.file('document.xml', this.createDocumentXml());
        word.file('styles.xml', this.createStylesXml());
        word.file('fontTable.xml', this.createFontTableXml());
        word.file('footnotes.xml', this.createFootnotesXml());
        word.file('settings.xml', this.createSettingsXml());
        word.file('comments.xml', this.createCommentsXml());

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
    <Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/>
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
    <Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/>
</Relationships>`;
    }

    createFontTableXml() {
        const fontsXml = this.fonts.map(font => `
    <w:font w:name="${this.escapeXml(font)}">
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
        const generatedIds = new Set();
        let stylesXml = '';

        // 1. Generate styles from blocks config (Source of Truth in 2.0)
        for (const [key, config] of Object.entries(this.stylesConfig)) {
            const { id, name, basedOn } = this.getDocxStyleInfo(key, config);

            // Generate properties using ONLY config (css=null)
            const pPr = this.cssToParaProps(null, id);
            const rPr = this.cssToRunProps(null, id);

            stylesXml += `
    <w:style w:type="paragraph" w:styleId="${this.escapeXml(id)}">
        <w:name w:val="${this.escapeXml(name)}"/>
        ${basedOn ? `<w:basedOn w:val="${this.escapeXml(basedOn)}"/>` : ''}
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
        this.styles.forEach(style => {
            if (!generatedIds.has(style.id)) {
                const css = style.computed;
                const pPr = this.cssToParaProps(css, style.id);
                const rPr = this.cssToRunProps(css, style.id);

                stylesXml += `
    <w:style w:type="paragraph" w:styleId="${this.escapeXml(style.id)}">
        <w:name w:val="${this.escapeXml(style.name)}"/>
        ${style.basedOn ? `<w:basedOn w:val="${this.escapeXml(style.basedOn)}"/>` : ''}
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

        // Fix P1-001: Correct page size dimensions and Legal support
        let width = 12240; // Default Letter
        let height = 15840;

        if (this.pageSize.width === 'A4') {
            width = 11906;
            height = 16838;
        } else if (this.pageSize.width === 'Legal') {
            width = 12240;
            height = 20160;
        }

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
            const intId = this.footnoteIdMap.get(id);
            const paragraphs = data.paragraphs || (Array.isArray(data) ? data : [data]);

            const content = paragraphs.map((p, index) => {
                const pCopy = { ...p, styleId: 'FootnoteText' };

                if (index === 0) {
                    const pPr = `
        <w:pPr>
            <w:pStyle w:val="FootnoteText"/>
            ${this.cssToParaProps(p.computed, 'FootnoteText')}
        </w:pPr>`;

                    const markerRun = `<w:r><w:rPr><w:rStyle w:val="FootnoteSymbol"/></w:rPr><w:footnoteRef/></w:r><w:r><w:t xml:space="preserve"> </w:t></w:r>`;
                    const runs = p.runs.map(r => this.createRunXml(r, 'FootnoteText')).join('');
                    return `<w:p>${pPr}${markerRun}${runs}</w:p>`;
                }

                return this.createParagraphXml(pCopy);
            }).join('');

            return `<w:footnote w:id="${this.escapeXml(String(intId))}">${content}</w:footnote>`;
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

    createCommentsXml() {
        const commentsContent = Object.entries(this.comments).map(([id, threads]) => {
            const intId = this.commentIdMap.get(id);
            // In 2.0, a thread is an array of messages
            const firstMessage = threads[0] || {};
            const author = firstMessage.author || 'Author';
            const date = firstMessage.date || new Date().toISOString();
            
            // Combine all messages in thread into the comment body
            const content = threads.map(msg => {
                const doc = msg.content;
                // doc is a Tiptap JSON doc
                return doc.content.map(pNode => {
                    const runs = [];
                    if (pNode.content) {
                        pNode.content.forEach(child => {
                            if (child.type === 'text') {
                                runs.push(`<w:r><w:t xml:space="preserve">${this.escapeXml(child.text)}</w:t></w:r>`);
                            }
                        });
                    }
                    return `<w:p><w:pPr><w:pStyle w:val="CommentText"/></w:pPr>${runs.join('')}</w:p>`;
                }).join('');
            }).join('<w:p><w:r><w:t>---</w:t></w:r></w:p>');

            return `<w:comment w:id="${intId}" w:author="${this.escapeXml(author)}" w:date="${this.escapeXml(date)}" w:initials="${this.escapeXml(author.substring(0, 2).toUpperCase())}">
                ${content}
            </w:comment>`;
        }).join('');

        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    ${commentsContent}
</w:comments>`;
    }

    // --- Element Generators ---

    createParagraphXml(p) {
        const pPr = `
        <w:pPr>
            <w:pStyle w:val="${this.escapeXml(p.styleId)}"/>
            ${this.cssToParaProps(p.computed, p.styleId)}
        </w:pPr>`;

        const runs = p.runs.map(r => this.createRunXml(r, p.styleId)).join('');
        return `<w:p>${pPr}${runs}</w:p>`;
    }

    createRunXml(r, styleId) {
        if (r.type === 'footnoteMarker') {
            const intId = this.footnoteIdMap.get(r.attrs.id);
            const idToUse = intId !== undefined ? intId : r.attrs.id;
            return `<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteReference w:id="${this.escapeXml(String(idToUse))}"/></w:r>`;
        }

        const rPr = `
        <w:rPr>
            ${this.cssToRunProps(r.style, styleId)}
            ${this.marksToRunProps(r.marks)}
        </w:rPr>`;

        let runXml = '';
        
        // Handle comment highlights (marks in Tiptap)
        const commentMark = r.marks?.find(m => m.type === 'commentHighlight');
        if (commentMark) {
            const intId = this.commentIdMap.get(commentMark.attrs.threadId);
            if (intId !== undefined) {
                // Word requires range start/end around the runs. 
                // Since our serializer flattens marks per run, we can wrap each run.
                runXml += `<w:commentRangeStart w:id="${intId}"/>`;
                runXml += `<w:r>${rPr}<w:t xml:space="preserve">${this.escapeXml(r.text)}</w:t></w:r>`;
                runXml += `<w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="${intId}"/></w:r>`;
                runXml += `<w:commentRangeEnd w:id="${intId}"/>`;
                return runXml;
            }
        }

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
            basedOn = 'DefaultParagraphFont';
        }

        return { id, name, basedOn };
    }

    cssToParaProps(css, styleId) {
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
        if (override && override['before-block']) {
            before = this.parseUnit(override['before-block'], 'twips');
        } else if (css) {
            before = this.parseUnit(css.marginTop, 'twips');
        }

        // After
        if (override && override['after-block']) {
            after = this.parseUnit(override['after-block'], 'twips');
        } else if (css) {
            after = this.parseUnit(css.marginBottom, 'twips');
        }

        // Line Height
        // Fix P1-002: Scale line height
        if (override && override['line-spacing']) {
            const val = override['line-spacing'];
            if (String(val).match(/^[0-9.]+$/)) {
                line = Math.round(parseFloat(val) * 240 * this.scale);
                lineRule = 'auto';
            } else {
                line = Math.round(this.parseUnit(val, 'twips') * this.scale);
                lineRule = 'exact';
            }
        } else if (css && css.lineHeight !== 'normal') {
            if (css.lineHeight.endsWith('px')) {
                line = Math.round(this.parseUnit(css.lineHeight, 'twips') * this.scale);
                lineRule = 'exact';
            } else if (!isNaN(parseFloat(css.lineHeight))) {
                line = Math.round(parseFloat(css.lineHeight) * 240 * this.scale);
            }
        }

        // --- Indentation ---
        let left = 0;
        let right = 0;
        let firstLine = 0;

        // Left
        if (override && override['left-indent']) {
            left = this.parseUnit(override['left-indent'], 'twips');
        } else if (css) {
            left = this.parseUnit(css.marginLeft, 'twips') + this.parseUnit(css.paddingLeft, 'twips');
        }

        // Right
        if (override && override['right-indent']) {
            right = this.parseUnit(override['right-indent'], 'twips');
        } else if (css) {
            right = this.parseUnit(css.marginRight, 'twips') + this.parseUnit(css.paddingRight, 'twips');
        }

        // First Line
        if (override && override['first-indent']) {
            firstLine = this.parseUnit(override['first-indent'], 'twips');
        } else if (css) {
            firstLine = this.parseUnit(css.textIndent, 'twips');
        }

        // Fix P1-003: Escape all dynamic attributes
        return `
            <w:jc w:val="${this.escapeXml(jc)}"/>
            <w:spacing w:before="${this.escapeXml(String(before))}" w:after="${this.escapeXml(String(after))}" w:line="${this.escapeXml(String(line))}" w:lineRule="${this.escapeXml(lineRule)}"/>
            <w:ind w:left="${this.escapeXml(String(left))}" w:right="${this.escapeXml(String(right))}" w:firstLine="${this.escapeXml(String(firstLine))}"/>
        `;
    }

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
        // Fix P1-002: Scale font size
        let size = 24; // 12pt
        if (override && override['font-size']) {
            size = Math.round(this.parseUnit(override['font-size'], 'half-points') * this.scale);
        } else if (css && css.fontSize) {
            size = Math.round(this.parseUnit(css.fontSize, 'half-points') * this.scale);
        }

        const color = 'auto';

        let bold = '';
        let italic = '';
        let underline = '';
        let strike = '';
        let smallCaps = '';
        let vertAlign = '';

        if (override) {
            if (override['font-weight'] === 'bold') bold = '<w:b/>';
            if (override['font-variant'] === 'italic' || override['font-style'] === 'italic') italic = '<w:i/>';
            if (override['text-decoration'] === 'underline') underline = '<w:u w:val="single"/>';
            if (override['text-decoration'] === 'line-through') strike = '<w:strike/>';
            if (override['font-variant'] === 'small-caps' || override['capitalization'] === 'small-caps') smallCaps = '<w:smallCaps/>';
            if (override['vertical-align'] === 'super') vertAlign = '<w:vertAlign w:val="superscript"/>';
            if (override['vertical-align'] === 'sub') vertAlign = '<w:vertAlign w:val="subscript"/>';
        } else if (css) {
            if (css.fontWeight === 'bold' || parseInt(css.fontWeight) >= 700) bold = '<w:b/>';
            if (css.fontStyle === 'italic') italic = '<w:i/>';
            if (css.textDecorationLine?.includes('underline')) underline = '<w:u w:val="single"/>';
            if (css.textDecorationLine?.includes('line-through')) strike = '<w:strike/>';
            if (css.fontVariant === 'small-caps') smallCaps = '<w:smallCaps/>';
            if (css.verticalAlign === 'super') vertAlign = '<w:vertAlign w:val="superscript"/>';
            if (css.verticalAlign === 'sub') vertAlign = '<w:vertAlign w:val="subscript"/>';
        }

        // Fix P1-003: Escape all dynamic attributes
        return `
            <w:rFonts w:ascii="${this.escapeXml(font)}" w:hAnsi="${this.escapeXml(font)}"/>
            <w:sz w:val="${this.escapeXml(String(size))}"/>
            <w:szCs w:val="${this.escapeXml(String(size))}"/>
            <w:color w:val="${this.escapeXml(color)}"/>
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
        if (unsafe === null || unsafe === undefined) return '';
        return String(unsafe).replace(/[<>&'"]/g, function (c) {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
            }
        });
    }

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
        else if (str.endsWith('px')) points = num * 0.75;
        else if (str.endsWith('pc')) points = num * 12;
        else points = num;

        if (targetUnit === 'twips') {
            return Math.round(points * 20);
        } else {
            return Math.round(points * 2);
        }
    }
}

export function cleanFont(fontStack) {
    if (!fontStack) return 'Times New Roman';

    if (typeof window !== 'undefined' && typeof document !== 'undefined' && fontStack.includes('var(')) {
        fontStack = fontStack.replace(/var\((--[^)]+)\)/g, (match, varName) => {
            const val = getComputedStyle(document.body).getPropertyValue(varName).trim();
            return val || '';
        });
    }
    const fonts = fontStack.split(',').map(f => f.trim().replace(/['"]/g, ''));
    const validFont = fonts.find(f => f && f !== '??' && f.toLowerCase() !== 'undefined' && f !== '');
    return validFont || 'Times New Roman';
}
