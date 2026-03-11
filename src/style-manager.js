export class StyleManager {
    constructor() {
        this.styleTagId = 'colophon-dynamic-styles';
    }

    applyStyles(settings) {
        if (!settings || !settings.blocks) return;

        let css = '';

        // 0. Global Variables
        css += `.colophon-workspace { --colophon-editor-width: ${settings.textColumnWidth || 700}px; }\n`;

        // Footnote Symbol dynamic styling (In Canvas)
        const symbolDef = settings.blocks['footnote-symbol'];
        if (symbolDef) {
            css += `.colophon-footnote-marker {\n`;
            if (symbolDef['font-family']) css += `  font-family: ${this.normalizeValue(symbolDef['font-family'], 'font-family')};\n`;
            if (symbolDef['font-size']) css += `  font-size: ${this.normalizeValue(symbolDef['font-size'], 'font-size')};\n`;
            if (symbolDef['color']) css += `  color: ${symbolDef['color']};\n`;
            if (symbolDef['align']) {
                css += `  vertical-align: ${this.normalizeValue(symbolDef['align'], 'align')};\n`;
                css += `  line-height: 0;\n`;
            }
            css += `}\n`;
        }

        // Footnote sidebar dynamic styling
        const footnoteDef = settings.blocks['footnote'];
        if (footnoteDef) {
            // High-precision selectors for sidebar content.
            // We target the ProseMirror element directly by joining the classes.
            const sidebarBase = '.ProseMirror.colophon-footnote-editor';
            
            css += `${sidebarBase}, ${sidebarBase} p {\n`;
            
            // Map all properties from the definition using our property map
            const propertyMap = this.getPropertyMap();
            for (const [key, value] of Object.entries(footnoteDef)) {
                if (propertyMap[key]) {
                    const normalizedValue = this.normalizeValue(value, key);
                    // Use !important to ensure sidebar styles win
                    css += `  ${propertyMap[key]}: ${normalizedValue} !important;\n`;
                }
            }

            // Handle font-variant / font-style overlap for sidebar
            if (footnoteDef['font-variant']) {
                const variant = footnoteDef['font-variant'].toLowerCase();
                if (variant === 'italic') css += `  font-style: italic !important;\n`;
                else if (variant === 'small-caps') css += `  font-variant: small-caps !important;\n`;
            }
            if (footnoteDef['font-style']) {
                css += `  font-style: ${footnoteDef['font-style']} !important;\n`;
            }

            // Ensure the paragraph inside is visible and interactive even if empty
            css += `  min-height: 1.2em !important;\n`;
            css += `}\n`;
            
            if (footnoteDef['space-between-notes']) {
                css += `.colophon-footnote-item { margin-bottom: ${this.normalizeValue(footnoteDef['space-between-notes'], 'space-between-notes')}; }\n`;
            }
        }

        const numberDef = settings.blocks['footnote-number'];
        if (numberDef) {
            css += `.colophon-footnote-number {\n`;
            if (numberDef['font-family']) css += `  font-family: ${this.normalizeValue(numberDef['font-family'], 'font-family')};\n`;
            if (numberDef['font-size']) css += `  font-size: ${this.normalizeValue(numberDef['font-size'], 'font-size')};\n`;
            if (numberDef['font-weight']) css += `  font-weight: ${numberDef['font-weight']};\n`;
            css += `}\n`;
        }

        // 1. Generate CSS Variables for each block (Main Canvas only)
        for (const [blockId, properties] of Object.entries(settings.blocks)) {
            css += this.generateBlockStyles(blockId, properties);
        }

        this.injectStyles(css);
    }

    getPropertyMap() {
        return {
            'after-block': 'margin-bottom',
            'before-block': 'margin-top',
            'color': 'color',
            'first-indent': 'text-indent',
            'font-family': 'font-family',
            'font-size': 'font-size',
            'line-spacing': 'line-height',
            'text-align': 'text-align',
            'left-indent': 'padding-left',
            'right-indent': 'padding-right',
            'font-weight': 'font-weight',
            'text-transform': 'text-transform'
        };
    }

    generateBlockStyles(blockId, properties) {
        // Scope general block definitions STRICTLY to the main editor canvas.
        const base = '.colophon-main-editor';

        // Determine Tag
        let tag = 'p';
        if (blockId.startsWith('heading-')) {
            const level = blockId.split('-')[1];
            if (level && !isNaN(level)) tag = `h${level}`;
        }

        // Construct Selector: .colophon-main-editor tag.class
        const selector = `${base} ${tag}.${blockId}`;
        let blockCss = `${selector} {\n`;

        // CSS Property Map
        const propertyMap = this.getPropertyMap();

        // Special handling / conversions
        if (properties['capitalization']) {
            if (properties['capitalization'] === 'all-caps') blockCss += `  text-transform: uppercase;\n`;
            if (properties['capitalization'] === 'small-caps') blockCss += `  font-variant: small-caps;\n`;
        }

        // Handle font-variant / font-style overlap (Legacy support)
        if (properties['font-variant']) {
            const variant = properties['font-variant'].toLowerCase();
            if (variant === 'italic') {
                blockCss += `  font-style: italic;\n`;
            } else if (variant === 'small-caps') {
                blockCss += `  font-variant: small-caps;\n`;
            } else if (variant !== 'regular' && variant !== 'normal') {
                blockCss += `  font-variant: ${variant};\n`;
            }
        }

        if (properties['font-style']) {
            blockCss += `  font-style: ${properties['font-style']};\n`;
        }

        // Standard Properties
        for (const [key, value] of Object.entries(properties)) {
            if (propertyMap[key]) {
                const normalizedValue = this.normalizeValue(value, key);
                blockCss += `  ${propertyMap[key]}: ${normalizedValue};\n`;
            }
        }

        blockCss += `}\n`;
        return blockCss;
    }

    /**
     * Sanitizes font-family strings to prevent CSS injection.
     * Wraps non-generic font names in quotes and strips illegal characters.
     */
    sanitizeFontFamily(fontFamily) {
        if (typeof fontFamily !== 'string' || !fontFamily) return '';

        const genericFamilies = [
            'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy',
            'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace',
            'ui-rounded', 'emoji', 'math', 'fan-out'
        ];

        return fontFamily.split(',')
            .map(part => {
                let trimmed = part.trim();
                if (!trimmed) return '';

                // Remove illegal characters: ; { } < > \
                trimmed = trimmed.replace(/[;{}<>\\]/g, '');

                if (genericFamilies.includes(trimmed.toLowerCase())) {
                    return trimmed;
                }

                // Strip existing quotes
                trimmed = trimmed.replace(/^["'](.*)["']$/, '$1');

                // Return quoted, escaping internal double quotes
                return `"${trimmed.replace(/"/g, '\\"')}"`;
            })
            .filter(part => part !== '')
            .join(', ');
    }

    /**
     * Normalizes values to 'rem' based on the rule 10pt = 1rem.
     * Also handles font-family sanitization if the key is provided.
     */
    normalizeValue(value, key) {
        if (typeof value !== 'string') return value;

        if (key === 'font-family') {
            return this.sanitizeFontFamily(value);
        }

        const match = value.match(/^([\d.]+)([a-z%]+)?$/);
        if (!match) return value;

        const num = parseFloat(match[1]);
        const unit = match[2];

        if (!unit) return value;

        switch (unit) {
            case 'pt': return `${num * 0.1}rem`;
            case 'pc': return `${num * 1.2}rem`;
            case 'in': return `${num * 7.2}rem`;
            case 'cm': return `${(num * 7.2) / 2.54}rem`;
            case 'mm': return `${(num * 0.72) / 2.54}rem`;
            case 'px': return `${num * 0.075}rem`;
            case 'rem':
            case 'em':
            case '%':
                return value;
            default:
                return value;
        }
    }

    injectStyles(css) {
        let styleTag = document.getElementById(this.styleTagId);
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = this.styleTagId;
            document.head.appendChild(styleTag);
        }
        styleTag.textContent = css;
    }
}
