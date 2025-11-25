
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

        for (const [key, styleDef] of Object.entries(stylesConfig)) {
            const selector = this.getSelector(key);
            const rules = this.mapStyleToCSS(styleDef);
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
    mapStyleToCSS(styleDef) {
        const rules = [];

        if (styleDef['font-family']) {
            rules.push(`    font-family: "${styleDef['font-family']}", serif;`);
        }

        if (styleDef['font-size']) {
            rules.push(`    font-size: ${styleDef['font-size']};`);
        }

        if (styleDef['text-align']) {
            rules.push(`    text-align: ${styleDef['text-align']};`);
        }

        if (styleDef['line-spacing']) {
            // If unitless, it's a multiplier. If pt/px, it's fixed.
            // CSS line-height handles both, but let's be safe.
            rules.push(`    line-height: ${styleDef['line-spacing']};`);
        }

        if (styleDef['before-paragraph']) {
            rules.push(`    margin-top: ${styleDef['before-paragraph']};`);
        }

        if (styleDef['after-paragraph']) {
            rules.push(`    margin-bottom: ${styleDef['after-paragraph']};`);
        }

        if (styleDef['first-indent']) {
            rules.push(`    text-indent: ${styleDef['first-indent']};`);
        }

        if (styleDef['left-indent']) {
            rules.push(`    margin-left: ${styleDef['left-indent']};`);
        }

        if (styleDef['right-indent']) {
            rules.push(`    margin-right: ${styleDef['right-indent']};`);
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

        // Color - default to variable if not specified, but usually handled by theme
        // We can add specific color overrides if needed later.

        return rules.join('\n');
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
            // Skip footnote style for the main paragraph picker usually?
            // The user requested: "the list of paragraph styles to expose in the popover menu"
            // Footnote is usually special, but let's include it if it's in the list, 
            // though usually you don't convert a paragraph TO a footnote this way.
            if (key === 'footnote') continue;

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
