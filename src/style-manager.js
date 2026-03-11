export class StyleManager {
    constructor() {
        this.styleTagId = 'colophon-dynamic-styles';
    }

    applyStyles(settings) {
        if (!settings || !settings.blocks) return;

        let css = '';

        // 0. Global Variables
        css += `.colophon-workspace { --colophon-editor-width: ${settings.textColumnWidth || 700}px; }\n`;

        // Footnote Symbol dynamic styling
        const symbolDef = settings.blocks['footnote-symbol'];
        if (symbolDef) {
            css += `.colophon-footnote-marker {\n`;
            if (symbolDef['font-family']) css += `  font-family: ${symbolDef['font-family']};\n`;
            if (symbolDef['font-size']) css += `  font-size: ${this.normalizeValue(symbolDef['font-size'])};\n`;
            if (symbolDef['color']) css += `  color: ${symbolDef['color']};\n`;
            if (symbolDef['align']) {
                css += `  vertical-align: ${this.normalizeValue(symbolDef['align'])};\n`;
                css += `  line-height: 0;\n`;
            }
            css += `}\n`;
        }

        // Footnote sidebar dynamic styling
        const footnoteDef = settings.blocks['footnote'];
        if (footnoteDef) {
            css += `.colophon-footnote-editor {\n`;
            if (footnoteDef['font-family']) css += `  font-family: ${footnoteDef['font-family']};\n`;
            if (footnoteDef['font-size']) css += `  font-size: ${this.normalizeValue(footnoteDef['font-size'])};\n`;
            if (footnoteDef['line-spacing']) css += `  line-height: ${this.normalizeValue(footnoteDef['line-spacing'])};\n`;
            css += `}\n`;
            if (footnoteDef['space-between-notes']) {
                css += `.colophon-footnote-item { margin-bottom: ${this.normalizeValue(footnoteDef['space-between-notes'])}; }\n`;
            }
        }

        const numberDef = settings.blocks['footnote-number'];
        if (numberDef) {
            css += `.colophon-footnote-number {\n`;
            if (numberDef['font-family']) css += `  font-family: ${numberDef['font-family']};\n`;
            if (numberDef['font-size']) css += `  font-size: ${this.normalizeValue(numberDef['font-size'])};\n`;
            if (numberDef['font-weight']) css += `  font-weight: ${numberDef['font-weight']};\n`;
            css += `}\n`;
        }

        // 1. Generate CSS Variables for each block
        for (const [blockId, properties] of Object.entries(settings.blocks)) {
            css += this.generateBlockStyles(blockId, properties);
        }

        this.injectStyles(css);
    }

    generateBlockStyles(blockId, properties) {
        // Broaden the selector to apply to any ProseMirror instance within the workspace,
        // including sidebar editors.
        const base = '.colophon-workspace .ProseMirror';

        // Determine Tag
        let tag = 'p';
        if (blockId.startsWith('heading-')) {
            const level = blockId.split('-')[1];
            if (level && !isNaN(level)) tag = `h${level}`;
        }

        // Construct Selector: .ProseMirror tag.class
        const selector = `${base} ${tag}.${blockId}`;
        let blockCss = `${selector} {\n`;

        // CSS Property Map
        const propertyMap = {
            'after-block': 'margin-bottom',
            'before-block': 'margin-top',
            'color': 'color',
            'first-indent': 'text-indent',
            'font-family': 'font-family',
            'font-size': 'font-size',
            // 'font-variant' handling moved below
            'line-spacing': 'line-height',
            'text-align': 'text-align',
            'left-indent': 'padding-left', // using padding for block indent
            'right-indent': 'padding-right',
            'font-weight': 'font-weight',
            // 'font-style' handling moved below
            'text-transform': 'text-transform' // for capitalization
        };

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
                const normalizedValue = this.normalizeValue(value);
                blockCss += `  ${propertyMap[key]}: ${normalizedValue};\n`;
            }
        }

        // List specific handling would go here (markers etc)

        blockCss += `}\n`;
        return blockCss;
    }

    /**
     * Normalizes values to 'rem' based on the rule 10pt = 1rem.
     * Supports: pt, pc, in, cm, mm, px, em, rem.
     */
    normalizeValue(value) {
        if (typeof value !== 'string') return value;

        const match = value.match(/^([\d.]+)([a-z%]+)?$/);
        if (!match) return value; // Return as-is (e.g., "inherit", "auto", "0")

        const num = parseFloat(match[1]);
        const unit = match[2];

        if (!unit) return value; // Multiplier like line-height: 1.5

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
