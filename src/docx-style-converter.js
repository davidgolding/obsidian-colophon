const { AlignmentType, UnderlineType } = require('docx');

class DocxStyleConverter {
    constructor() {
    }

    /**
     * Converts YAML styles to DOCX IStylesOptions.
     * @param {Object} stylesConfig - The parsed YAML styles.
     * @param {number} scalePercent - The scale percentage (e.g., 100).
     * @returns {Object} The DOCX styles configuration.
     */
    convertStyles(stylesConfig, scalePercent = 100, globalFont = "Minion 3") {
        const scale = scalePercent / 100;
        const paragraphStyles = [];
        const styleIdMap = {}; // Map internal key -> DOCX Style ID

        // Default styles (Normal) - Minimal fallback
        const defaultStyle = {
            document: {
                run: {
                    font: globalFont,
                    size: 24, // 12pt
                },
                paragraph: {
                    spacing: { line: 360 }, // 1.5 lines
                },
            },
        };

        for (const [key, styleDef] of Object.entries(stylesConfig)) {
            if (key === 'scale') continue;
            if (key === 'footnote-symbol') continue;

            // Determine DOCX Style ID and Name
            // User wants "Body First" -> ID="Body First", Name="Body First"
            // Fallback to key if name is missing
            let docxId = styleDef.name || key;
            const docxName = styleDef.name || key;

            styleIdMap[key] = docxId;

            // Special handling for Body and Footnote to avoid collisions/ensure functionality
            // while keeping user's preferred names
            if (key === 'body') {
                docxId = 'BodyText'; // Standard Word ID to avoid "Body A" collision
                // Name remains "Body" from styleDef.name
            } else if (key === 'footnote') {
                docxId = 'FootnoteText'; // Standard Word ID for footnotes
                // Name remains "Footnote" from styleDef.name
            }

            // We map 'paragraph' types to DOCX paragraph styles
            // Also include 'footnote' type styles if they are intended as paragraph styles for footnote text
            if (!styleDef.type || styleDef.type === 'paragraph' || styleDef.type === 'heading' || styleDef.type === 'footnote') {
                const docxStyle = this.mapParagraphStyle(docxId, docxName, styleDef, scale, globalFont);
                paragraphStyles.push(docxStyle);

                // Update map with the actual ID used
                styleIdMap[key] = docxId;
            }
        }

        return {
            styles: {
                default: defaultStyle,
                paragraphStyles: paragraphStyles,
            },
            styleIdMap: styleIdMap
        };
    }

    mapParagraphStyle(id, name, styleDef, scale, globalFont) {
        const runProps = {};
        const paraProps = {};

        // Font Family
        if (styleDef['font-family']) {
            let font = styleDef['font-family'];
            // Simple check for var()
            if (font.includes('var(')) {
                // Use global override if provided
                runProps.font = globalFont;
            } else {
                // Strip quotes and take first font
                font = font.split(',')[0].replace(/['"]/g, '').trim();
                runProps.font = font;
            }
        } else {
            runProps.font = globalFont;
        }

        // Font Size (Half-points)
        if (styleDef['font-size']) {
            runProps.size = this.toHalfPoints(styleDef['font-size'], scale);
        }

        // Font Attributes
        if (styleDef['font-weight'] === 'bold' || styleDef['font-variant'] === 'bold') {
            runProps.bold = true;
        }
        if (styleDef['font-variant'] === 'italic') {
            runProps.italics = true;
        }
        if (styleDef['capitalization'] === 'small-caps' || styleDef['font-variant'] === 'small-caps') {
            runProps.smallCaps = true;
        }
        if (styleDef['color']) {
            runProps.color = styleDef['color'].replace('#', '');
        }

        // Paragraph Alignment
        if (styleDef['text-align']) {
            switch (styleDef['text-align']) {
                case 'center': paraProps.alignment = AlignmentType.CENTER; break;
                case 'right': paraProps.alignment = AlignmentType.RIGHT; break;
                case 'justify': paraProps.alignment = AlignmentType.JUSTIFIED; break;
                case 'left': paraProps.alignment = AlignmentType.LEFT; break;
            }
        }

        // Indentation (Twips)
        const indent = {};
        if (styleDef['left-indent']) {
            indent.left = this.toTwips(styleDef['left-indent'], scale);
        }
        if (styleDef['right-indent']) {
            indent.right = this.toTwips(styleDef['right-indent'], scale);
        }
        if (styleDef['first-indent']) {
            indent.firstLine = this.toTwips(styleDef['first-indent'], scale);
        }
        if (Object.keys(indent).length > 0) {
            paraProps.indent = indent;
        }

        // Spacing (Twips/Lines)
        const spacing = {};
        if (styleDef['before-paragraph']) {
            spacing.before = this.toTwips(styleDef['before-paragraph'], scale);
        }
        if (styleDef['after-paragraph']) {
            spacing.after = this.toTwips(styleDef['after-paragraph'], scale);
        }
        if (styleDef['line-spacing']) {
            const val = String(styleDef['line-spacing']);
            if (val.endsWith('pt') || val.endsWith('in')) {
                spacing.line = this.toTwips(val, scale);
                spacing.lineRule = "exact";
            } else {
                const mult = parseFloat(val);
                if (!isNaN(mult)) {
                    spacing.line = Math.round(mult * 240);
                    spacing.lineRule = "auto";
                }
            }
        }
        if (Object.keys(spacing).length > 0) {
            paraProps.spacing = spacing;
        }

        // Keep with next
        if (styleDef['keep-with-next']) {
            paraProps.keepNext = true;
        }

        return {
            id: id,
            name: name,
            run: runProps,
            paragraph: paraProps,
            quickFormat: true,
        };
    }

    /**
     * Converts a value to Half-Points (1/144 inch).
     * Used for Font Size.
     */
    toHalfPoints(value, scale = 1.0) {
        if (typeof value === 'number') return Math.round(value * 2 * scale);
        const str = String(value).trim();
        const num = parseFloat(str);
        if (isNaN(num)) return 24; // Default 12pt

        let points = num;
        if (str.endsWith('pt')) points = num;
        else if (str.endsWith('in')) points = num * 72;
        else if (str.endsWith('mm')) points = num * 2.835;
        else if (str.endsWith('cm')) points = num * 28.35;
        else if (str.endsWith('px')) points = num * 0.75; // Approx

        return Math.round(points * 2 * scale);
    }

    /**
     * Converts a value to Twips (1/1440 inch).
     * Used for Spacing, Indents, Margins.
     */
    toTwips(value, scale = 1.0) {
        if (typeof value === 'number') return Math.round(value * 20 * scale); // Assume input was points if number
        const str = String(value).trim();
        const num = parseFloat(str);
        if (isNaN(num)) return 0;

        let points = num;
        if (str.endsWith('pt')) points = num;
        else if (str.endsWith('in')) points = num * 72;
        else if (str.endsWith('mm')) points = num * 2.835;
        else if (str.endsWith('cm')) points = num * 28.35;
        else if (str.endsWith('px')) points = num * 0.75;

        return Math.round(points * 20 * scale);
    }
}

module.exports = DocxStyleConverter;
