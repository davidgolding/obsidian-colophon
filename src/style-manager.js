
class StyleManager {
    constructor() {
        this.styles = {};
    }

    /**
     * Parses the style configuration and generates CSS.
     * @param {Object} stylesConfig - The configuration object (parsed YAML).
     * @returns {string} The generated CSS string.
     */
    generateCSS(stylesConfig) {
        this.styles = stylesConfig;
        let css = '';

        // Extract scale factor (default 100%)
        let scale = 1.0;
        if (stylesConfig['scale']) {
            const scaleStr = String(stylesConfig['scale']);
            if (scaleStr.endsWith('%')) {
                scale = parseFloat(scaleStr) / 100;
            } else {
                scale = parseFloat(scaleStr);
            }
            if (isNaN(scale)) scale = 1.0;
        }

        for (const [key, styleDef] of Object.entries(stylesConfig)) {
            if (key === 'scale') continue; // Skip scale definition itself

            if (styleDef.type === 'list') {
                const rules = this.generateListCSS(key, styleDef, scale);
                if (rules) css += rules;
            } else {
                const selector = this.getSelector(key);
                const rules = this.mapStyleToCSS(styleDef, scale);
                if (rules) {
                    css += `${selector} {\n${rules}\n}\n`;
                }
            }
        }

        return css;
    }

    /**
     * Returns the CSS selector for a given style key.
     * @param {string} key - The style key (e.g., 'heading-1', 'body').
     * @returns {string} The CSS selector.
     */
    getSelector(key) {
        // Base selector for Tiptap paragraphs/headings
        const base = '.colophon-workspace .ProseMirror';

        // Map keys to specific element selectors if needed, or use classes
        // We use classes for everything to be consistent with the YAML config keys
        // except for default 'body' which might just be 'p' but let's stick to classes for specificity
        // Actually, Tiptap defaults:
        // 'heading-1' -> h1.heading-1
        // 'body' -> p.body

        if (key.startsWith('heading-')) {
            const level = key.split('-')[1];
            return `${base} h${level}.${key}`; // e.g. h1.heading-1
        } else if (key === 'title') {
            return `${base} h1.title`;
        } else if (key === 'supertitle') {
            return `${base} p.supertitle`;
        } else if (key === 'footnote') {
            return `.colophon-footnote-view .colophon-footnote-editor-content p`;
        } else if (key === 'footnote-number') {
            return `span.colophon-footnote-number`;
        } else {
            // Default to paragraph with class
            return `${base} p.${key}`;
        }
    }

    /**
     * Maps a single style definition to CSS rules.
     * @param {Object} styleDef - The style definition object.
     * @returns {string} The CSS rules string.
     */
    mapStyleToCSS(styleDef, scale = 1.0) {
        const rules = [];

        if (styleDef['font-family']) {
            rules.push(`    font-family: ${this.formatFontFamily(styleDef['font-family'])};`);
        }

        if (styleDef['font-size']) {
            rules.push(`    font-size: ${this.convertValue(styleDef['font-size'], 'font-size', scale)};`);
        }

        if (styleDef['text-align']) {
            rules.push(`    text-align: ${styleDef['text-align']};`);
        }

        if (styleDef['line-spacing']) {
            rules.push(`    line-height: ${this.convertValue(styleDef['line-spacing'], 'line-spacing', scale)};`);
        }

        if (styleDef['before-paragraph']) {
            rules.push(`    margin-top: ${this.convertValue(styleDef['before-paragraph'], 'spacing', scale)};`);
        }

        if (styleDef['after-paragraph']) {
            rules.push(`    margin-bottom: ${this.convertValue(styleDef['after-paragraph'], 'spacing', scale)};`);
        }

        if (styleDef['first-indent']) {
            rules.push(`    text-indent: ${this.convertValue(styleDef['first-indent'], 'indent', scale)};`);
        }

        if (styleDef['left-indent']) {
            rules.push(`    margin-left: ${this.convertValue(styleDef['left-indent'], 'indent', scale)};`);
        }

        if (styleDef['right-indent']) {
            rules.push(`    margin-right: ${this.convertValue(styleDef['right-indent'], 'indent', scale)};`);
        }

        // Font Variant / Style / Weight handling
        if (styleDef['font-variant']) {
            const variant = styleDef['font-variant'].toLowerCase();
            if (variant === 'italic') {
                rules.push(`    font-style: italic;`);
            } else if (variant === 'bold') {
                rules.push(`    font-weight: bold;`);
            } else if (variant === 'small-caps') {
                rules.push(`    font-variant: small-caps;`);
            } else {
                rules.push(`    font-style: normal;`);
                rules.push(`    font-weight: normal;`);
                rules.push(`    font-variant: normal;`);
            }
        }

        if (styleDef['capitalization']) {
            if (styleDef['capitalization'] === 'small-caps') {
                rules.push(`    font-variant: small-caps;`);
            } else {
                rules.push(`    text-transform: ${styleDef['capitalization']};`);
            }
        }

        if (styleDef['character-spacing']) {
            rules.push(`    letter-spacing: ${styleDef['character-spacing']};`);
        }

        if (styleDef['keep-with-next']) {
            rules.push(`    page-break-after: avoid;`);
            rules.push(`    break-after: avoid;`);
        }

        if (styleDef['color']) {
            rules.push(`    color: ${styleDef['color']};`);
        }

        if (styleDef['font-weight']) {
            rules.push(`    font-weight: ${styleDef['font-weight']};`);
        }

        return rules.join('\n');
    }

    /**
     * Generates CSS for list styles.
     * @param {string} key - The style key.
     * @param {Object} styleDef - The style definition.
     * @param {number} scale - The scale factor.
     * @returns {string} The CSS string.
     */
    generateListCSS(key, styleDef, scale = 1.0) {
        let css = '';
        const defaults = styleDef.defaults || {};
        const levels = styleDef.levels || {};

        // Generate styles for levels 1-9
        for (let level = 1; level <= 9; level++) {
            const levelConfig = { ...defaults, ...(levels[level] || {}) };

            // Build selector for this level using :is() for nesting
            // Level 1: .colophon-workspace .ProseMirror :is(ul, ol).key
            // Level 2: .colophon-workspace .ProseMirror :is(ul, ol).key > li > :is(ul, ol)

            let currentSelector = `.colophon-workspace .ProseMirror :is(ul, ol).${key}`;
            if (level > 1) {
                const repeat = level - 1;
                for (let i = 0; i < repeat; i++) {
                    currentSelector += ` > li > :is(ul, ol)`;
                }
            }

            // 1. List Container Styles
            let containerRules = `    list-style-type: none;\n    padding-left: 0;\n    margin-left: 0;\n    margin-top: 0;\n    margin-bottom: 0;\n`;

            if (levelConfig['list-type'] === 'ordered' || levelConfig['type'] === 'ordered') {
                containerRules += `    counter-reset: colophon-list-item;\n`;
            }

            css += `${currentSelector} {\n${containerRules}}\n`;

            // 2. List Item Styles (li)
            const liSelector = `${currentSelector} > li`;
            const textIndent = this.convertValue(levelConfig['text-indent'], 'indent', scale);
            const markerIndent = this.convertValue(levelConfig['marker-indent'], 'indent', scale);

            let liRules = `    position: relative;\n`;
            liRules += `    padding-left: ${textIndent};\n`;
            liRules += `    margin-left: 0;\n`;

            css += `${liSelector} {\n${liRules}}\n`;

            // 3. Paragraph inside LI (The anchor for the marker)
            // We set position relative here so the marker (absolute) is relative to the P
            // We reset text-indent because the LI handles the block indent
            css += `${liSelector} > p {\n    position: relative;\n    text-indent: 0;\n    margin: 0;\n}\n`;

            // 4. Marker Styles (::before on the P)
            // Attaching to P ensures we inherit font-size, line-height, and font-family from the paragraph style
            let markerRules = `    position: absolute;\n`;

            // Calculate left relative to P. 
            // P starts at textIndent. Marker wants to be at markerIndent.
            // So relative left = markerIndent - textIndent.
            markerRules += `    left: calc(${markerIndent} - ${textIndent});\n`;
            markerRules += `    top: 0;\n`;

            // Alignment (vertical shift)
            if (levelConfig['align']) {
                const alignVal = this.convertValue(levelConfig['align'], 'indent', scale);
                markerRules += `    transform: translateY(calc(-1 * ${alignVal}));\n`;
            }

            if (levelConfig['color'] && levelConfig['color'] !== 'inherit') {
                markerRules += `    color: ${levelConfig['color']};\n`;
            }

            if (levelConfig['size']) {
                markerRules += `    font-size: ${levelConfig['size']};\n`;
            }

            if (levelConfig['font-weight']) {
                markerRules += `    font-weight: ${levelConfig['font-weight']};\n`;
            }

            // Content
            const isOrdered = levelConfig['list-type'] === 'ordered' || levelConfig['type'] === 'ordered';

            if (isOrdered) {
                const markerType = levelConfig['marker'] || 'decimal';
                const suffix = levelConfig['suffix'] || '.';
                markerRules += `    counter-increment: colophon-list-item;\n`;
                markerRules += `    content: counter(colophon-list-item, ${markerType}) "${suffix}";\n`;
            } else {
                const markerChar = levelConfig['marker'] || '•';
                // Escape double quotes in markerChar if needed
                const safeMarker = markerChar.replace(/"/g, '\\"');
                markerRules += `    content: "${safeMarker}";\n`;
            }

            // Apply to the first paragraph in the list item
            css += `${liSelector} > p:first-child::before {\n${markerRules}}\n`;
        }

        return css;
    }

    convertValue(value, type, scale = 1.0) {
        if (typeof value !== 'string' && typeof value !== 'number') return value;
        const strVal = String(value);
        const numVal = parseFloat(strVal);

        if (isNaN(numVal)) return value;

        // Scaling Factors based on user request:
        // pt -> rem: value * (1/12)
        // in -> rem: value * 6

        // Apply global scale factor to the numeric value before conversion
        // Or after? Usually scale applies to the final size.
        // Let's apply it to the numeric value.
        const scaledVal = numVal * scale;

        if (strVal.endsWith('in')) {
            return `${(scaledVal * 6).toFixed(3)}rem`;
        }

        if (type === 'font-size') {
            if (strVal.endsWith('pt')) {
                return `${(scaledVal / 12).toFixed(3)}rem`;
            }
        } else if (type === 'indent') {
            // Indents are now handled by the generic 'in' check above if they use inches.
            // If they use other units, we leave them alone.
        } else if (type === 'line-spacing') {
            if (strVal.endsWith('pt')) {
                return `${(scaledVal / 12).toFixed(3)}rem`;
            }
            // If unitless (e.g. "1"), treat as multiplier - DO NOT SCALE MULTIPLIERS
            if (!strVal.match(/[a-z%]/i)) {
                return strVal;
            }
        } else if (type === 'spacing') {
            // For margins (before/after paragraph)
            if (strVal.endsWith('pt')) {
                return `${(scaledVal / 12).toFixed(3)}rem`;
            }
        }

        return value;
    }

    formatFontFamily(value) {
        const str = String(value).trim();
        if (str.includes('var(')) return str;
        if (str.includes(',')) return str;
        if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) return str;
        if (str.includes(' ')) return `"${str}"`;
        return str;
    }

    /**
     * Returns a list of options for the UI select menu.
     * @param {Object} stylesConfig 
     * @returns {Array} Array of { label, value, action? }
     */
    getStyleOptions(stylesConfig) {
        const paragraphOptions = [];
        const listOptions = [];

        // Add "None" option for lists
        listOptions.push({ label: 'None', value: 'none', type: 'list' });

        for (const [key, styleDef] of Object.entries(stylesConfig)) {
            if (key === 'scale') continue;
            if (key === 'footnote') continue;
            if (key === 'footnote-number') continue;

            const type = styleDef.type || 'paragraph';
            const option = {
                label: styleDef.name || key,
                value: key,
                type: type,
                listType: styleDef.defaults?.['list-type'] || 'unordered'
            };

            if (type === 'list') {
                listOptions.push(option);
            } else if (type === 'paragraph' || !type) {
                // Include paragraphs and items without explicit type (legacy/default)
                paragraphOptions.push(option);
            }
            // Character styles are excluded from these menus
        }
        return { paragraphOptions, listOptions };
    }
}

module.exports = StyleManager;
