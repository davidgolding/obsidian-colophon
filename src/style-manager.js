
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

            const selector = this.getSelector(key);
            const rules = this.mapStyleToCSS(styleDef, scale);
            if (rules) {
                css += `${selector} {\n${rules}\n}\n`;
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
            return `.colophon-footnote-editor-content p`;
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
            rules.push(`    font-family: "${styleDef['font-family']}", serif;`);
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

    /**
     * Returns a list of options for the UI select menu.
     * @param {Object} stylesConfig 
     * @returns {Array} Array of { label, value, action? }
     */
    getStyleOptions(stylesConfig) {
        const options = [];
        // Define order? Or just use object order? 
        // The user provided list has a specific order, we should try to respect it or use a priority list.
        // For now, Object.entries usually preserves insertion order in modern JS for non-integer keys.

        for (const [key, styleDef] of Object.entries(stylesConfig)) {
            if (key === 'scale') continue; // Skip scale
            // Skip footnote style for the main paragraph picker usually?
            // The user requested: "the list of paragraph styles to expose in the popover menu"
            // Footnote is usually special, but let's include it if it's in the list, 
            // though usually you don't convert a paragraph TO a footnote this way.
            if (key === 'footnote') continue;
            if (key === 'footnote-number') continue; // Also skip footnote-number

            options.push({
                label: styleDef.name || key,
                value: key,
                // We don't define the action here, the UI component should handle the action based on the value
                // because it needs access to the editor instance.
            });
        }
        return options;
    }
}

module.exports = StyleManager;
