// const { AlignmentType, UnderlineType } = require('docx'); // Removed dependency

class DocxStyleConverter {
    constructor() {
    }

    /**
     * Converts YAML styles to DOCX IStylesOptions.
     * @param {Object} stylesConfig - The parsed YAML styles.
     * @param {number} scalePercent - The scale percentage (e.g., 100).
     * @param {string} globalFont - The global font family.
     * @param {Object} context - Context for resolving styles (baseFontSize, getVariable).
     * @returns {Object} The DOCX styles configuration.
     */
    convertStyles(stylesConfig, scalePercent = 100, globalFont = "Minion 3", context = null) {
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
            let docxId = styleDef.name || key;
            const docxName = styleDef.name || key;

            styleIdMap[key] = docxId;

            // Special handling for Body and Footnote to avoid collisions/ensure functionality
            if (key === 'body') {
                docxId = 'BodyText';
            } else if (key === 'footnote') {
                docxId = 'FootnoteText';
            }

            if (!styleDef.type || styleDef.type === 'paragraph' || styleDef.type === 'heading' || styleDef.type === 'footnote') {
                const docxStyle = this.mapParagraphStyle(docxId, docxName, styleDef, scale, globalFont, context);
                paragraphStyles.push(docxStyle);
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

    mapParagraphStyle(id, name, styleDef, scale, globalFont, context) {
        const runProps = {};
        const paraProps = {};

        // Helper to resolve value
        const resolve = (val) => this.resolveValue(val, context);

        // Font Family
        if (styleDef['font-family']) {
            let font = resolve(styleDef['font-family']);
            const validFont = this.cleanFontStack(font);
            if (validFont) {
                runProps.font = validFont;
            } else {
                runProps.font = globalFont;
            }
        } else {
            runProps.font = globalFont;
        }

        // Font Size (Half-points)
        if (styleDef['font-size']) {
            runProps.size = this.toHalfPoints(resolve(styleDef['font-size']), scale, context);
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
            const color = resolve(styleDef['color']);
            if (color) runProps.color = color.replace('#', '');
        }

        // Paragraph Alignment
        if (styleDef['text-align']) {
            const align = resolve(styleDef['text-align']);
            switch (align) {
                case 'center': paraProps.alignment = 'center'; break;
                case 'right': paraProps.alignment = 'right'; break;
                case 'justify': paraProps.alignment = 'both'; break;
                case 'left': paraProps.alignment = 'left'; break;
            }
        }

        // Indentation (Twips)
        const indent = {};
        // CSS text-indent maps to firstLine
        if (styleDef['text-indent']) {
            indent.firstLine = this.toTwips(resolve(styleDef['text-indent']), scale, context);
        }
        // Also support explicit first-indent key if used
        if (styleDef['first-indent']) {
            indent.firstLine = this.toTwips(resolve(styleDef['first-indent']), scale, context);
        }

        // CSS margin-left/padding-left maps to left indent
        if (styleDef['margin-left']) {
            indent.left = this.toTwips(resolve(styleDef['margin-left']), scale, context);
        }
        if (styleDef['padding-left']) {
            // Add to existing left indent if any? DOCX usually treats indentation as one value.
            // Let's assume margin-left OR padding-left is used for indentation.
            // If both, we might need to sum them, but for now take padding if margin not set.
            if (indent.left === undefined) {
                indent.left = this.toTwips(resolve(styleDef['padding-left']), scale, context);
            } else {
                indent.left += this.toTwips(resolve(styleDef['padding-left']), scale, context);
            }
        }
        // Explicit left-indent key
        if (styleDef['left-indent']) {
            indent.left = this.toTwips(resolve(styleDef['left-indent']), scale, context);
        }

        // Right indent
        if (styleDef['margin-right']) {
            indent.right = this.toTwips(resolve(styleDef['margin-right']), scale, context);
        }
        if (styleDef['padding-right']) {
            if (indent.right === undefined) {
                indent.right = this.toTwips(resolve(styleDef['padding-right']), scale, context);
            } else {
                indent.right += this.toTwips(resolve(styleDef['padding-right']), scale, context);
            }
        }
        if (styleDef['right-indent']) {
            indent.right = this.toTwips(resolve(styleDef['right-indent']), scale, context);
        }

        if (Object.keys(indent).length > 0) {
            paraProps.indent = indent;
        }

        // Spacing (Twips/Lines)
        const spacing = {};
        // CSS margin-top -> before
        if (styleDef['margin-top']) {
            spacing.before = this.toTwips(resolve(styleDef['margin-top']), scale, context);
        }
        if (styleDef['before-paragraph']) {
            spacing.before = this.toTwips(resolve(styleDef['before-paragraph']), scale, context);
        }

        // CSS margin-bottom -> after
        if (styleDef['margin-bottom']) {
            spacing.after = this.toTwips(resolve(styleDef['margin-bottom']), scale, context);
        }
        if (styleDef['after-paragraph']) {
            spacing.after = this.toTwips(resolve(styleDef['after-paragraph']), scale, context);
        }

        // Line Height / Line Spacing
        // CSS line-height can be unitless (multiplier) or length (px, em, etc)
        let lineSpacingVal = styleDef['line-height'] || styleDef['line-spacing'];
        if (lineSpacingVal) {
            lineSpacingVal = resolve(lineSpacingVal);
            const valStr = String(lineSpacingVal).trim();

            if (valStr.match(/^[0-9.]+$/)) {
                // Unitless multiplier (e.g. 1.5)
                // DOCX line rule "auto" takes 240ths of a line. 240 = 1 line.
                const mult = parseFloat(valStr);
                if (!isNaN(mult)) {
                    spacing.line = Math.round(mult * 240);
                    spacing.lineRule = "auto";
                }
            } else {
                // Has units (e.g. 24px, 12pt)
                // DOCX line rule "exact" takes twips.
                spacing.line = this.toTwips(valStr, scale, context);
                spacing.lineRule = "exact";
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
     * Cleans a font stack string, removing quotes and invalid fonts like "??".
     * Returns the first valid font found, or null.
     */
    cleanFontStack(fontStackString) {
        if (!fontStackString) return null;
        // Split by comma, strip quotes, and find first valid font
        const fonts = fontStackString.split(',').map(f => f.trim().replace(/['"]/g, ''));
        const validFont = fonts.find(f => f && f !== '??' && f.toLowerCase() !== 'undefined');
        return validFont || null;
    }

    resolveValue(value, context) {
        if (!value) return value;
        if (typeof value !== 'string') return value;

        // Check for var(--variable)
        if (value.includes('var(') && context && context.getVariable) {
            // Simple regex to extract variable name
            const match = value.match(/var\((--[^)]+)\)/);
            if (match) {
                const varName = match[1];
                const resolved = context.getVariable(varName);
                if (resolved) {
                    // Recursively resolve in case the variable points to another variable
                    // (Simple recursion limit or check needed? Assuming no cycles for now)
                    return this.resolveValue(resolved, context);
                }
            }
        }
        return value;
    }

    /**
     * Converts a value to Half-Points (1/144 inch).
     * Used for Font Size.
     */
    toHalfPoints(value, scale = 1.0, context = null) {
        if (typeof value === 'number') return Math.round(value * 2 * scale);
        const str = String(value).trim();
        const num = parseFloat(str);
        if (isNaN(num)) return 24; // Default 12pt

        let points = num;
        const baseFontSize = context ? context.baseFontSize : 16; // Default 16px

        if (str.endsWith('pt')) points = num;
        else if (str.endsWith('in')) points = num * 72;
        else if (str.endsWith('mm')) points = num * 2.835;
        else if (str.endsWith('cm')) points = num * 28.35;
        else if (str.endsWith('px')) points = num * 0.75; // Approx 96dpi: 1px = 0.75pt
        else if (str.endsWith('em') || str.endsWith('rem')) {
            // 1em = baseFontSize (px) -> convert to points
            const px = num * baseFontSize;
            points = px * 0.75;
        }

        return Math.round(points * 2 * scale);
    }

    /**
     * Converts a value to Twips (1/1440 inch).
     * Used for Spacing, Indents, Margins.
     */
    toTwips(value, scale = 1.0, context = null) {
        if (typeof value === 'number') return Math.round(value * 20 * scale); // Assume input was points if number
        const str = String(value).trim();
        const num = parseFloat(str);
        if (isNaN(num)) return 0;

        let points = num;
        const baseFontSize = context ? context.baseFontSize : 16;

        if (str.endsWith('pt')) points = num;
        else if (str.endsWith('in')) points = num * 72;
        else if (str.endsWith('mm')) points = num * 2.835;
        else if (str.endsWith('cm')) points = num * 28.35;
        else if (str.endsWith('px')) points = num * 0.75;
        else if (str.endsWith('em') || str.endsWith('rem')) {
            const px = num * baseFontSize;
            points = px * 0.75;
        }

        return Math.round(points * 20 * scale);
    }
}

module.exports = DocxStyleConverter;
