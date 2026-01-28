export class StyleManager {
    constructor() {
        this.styleTagId = 'colophon-dynamic-styles';
    }

    applyStyles(settings) {
        if (!settings || !settings.blocks) return;

        let css = '';

        // 1. Generate CSS Variables for each block
        for (const [blockId, properties] of Object.entries(settings.blocks)) {
            css += this.generateBlockStyles(blockId, properties);
        }

        this.injectStyles(css);
    }

    generateBlockStyles(blockId, properties) {
        // Map simplified property names to CSS properties
        // We scope everything to .colophon-block-[id]
        // But we also want to expose them as variables for Tiptap

        const className = `.colophon-block-${blockId}`;
        let blockCss = `${className} {\n`;

        // CSS Property Map
        const propertyMap = {
            'after-block': 'margin-bottom',
            'before-block': 'margin-top',
            'color': 'color',
            'first-indent': 'text-indent',
            'font-family': 'font-family',
            'font-size': 'font-size',
            'font-variant': 'font-variant', // might need more specific handling
            'line-spacing': 'line-height',
            'text-align': 'text-align',
            'left-indent': 'padding-left', // approximation for block indent
            'right-indent': 'padding-right',
            'font-weight': 'font-weight',
            'font-style': 'font-style', // derived or direct
            'text-transform': 'text-transform' // for capitalization
        };

        // Special handling / conversions
        if (properties['capitalization']) {
            if (properties['capitalization'] === 'all-caps') blockCss += `  text-transform: uppercase;\n`;
            if (properties['capitalization'] === 'small-caps') blockCss += `  font-variant: small-caps;\n`;
        }

        // Standard Properties
        for (const [key, value] of Object.entries(properties)) {
            if (propertyMap[key]) {
                // Ensure value has units if number? (Settings usually have units "18pt")
                blockCss += `  ${propertyMap[key]}: ${value};\n`;
            }
        }

        // List specific handling would go here (markers etc)

        blockCss += `}\n`;
        return blockCss;
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
