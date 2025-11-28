const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { MinimalDocxGenerator, createRun, createParagraph } = require('../src/minimal-docx');
const DocxStyleConverter = require('../src/docx-style-converter');

async function verifyDocxExport() {
    console.log('Starting DOCX Export Verification...');

    // --- TEST 1: Font Selection Logic (Simulating main.js) ---
    console.log('\n--- Test 1: Font Selection Logic ---');
    const testFontLogic = (fontStackString) => {
        let globalFont = "Minion 3";
        if (fontStackString) {
            const fonts = fontStackString.split(',').map(f => f.trim().replace(/['"]/g, ''));
            const validFont = fonts.find(f => f && f !== '??' && f.toLowerCase() !== 'undefined');
            if (validFont) globalFont = validFont;
        }
        return globalFont;
    };

    const fontTests = [
        { input: '??, "Minion 3", sans-serif', expected: 'Minion 3' },
        { input: '"Times New Roman", Arial', expected: 'Times New Roman' },
        { input: '??, ??, Arial', expected: 'Arial' },
        { input: '', expected: 'Minion 3' },
        { input: '??', expected: 'Minion 3' }
    ];

    let fontLogicPassed = true;
    fontTests.forEach(t => {
        const result = testFontLogic(t.input);
        if (result === t.expected) {
            console.log(`✅ Input: '${t.input}' -> '${result}'`);
        } else {
            console.error(`❌ Input: '${t.input}' -> Expected '${t.expected}', got '${result}'`);
            fontLogicPassed = false;
        }
    });

    if (!fontLogicPassed) {
        console.error('💥 Font logic verification failed');
        process.exit(1);
    }


    // --- TEST 2: Full Export (Existing Test) ---
    console.log('\n--- Test 2: Full Export Generation ---');
    // 1. Define Test Data with Relative Units and CSS Variables
    const stylesConfig = {
        'body': {
            name: 'Body',
            'font-family': 'var(--font-text)',
            'font-size': '1.5rem', // Should be 1.5 * 16px = 24px = 18pt = 36 half-points
            'text-indent': '2em', // Should be 2 * 16px = 32px = 24pt = 480 twips
            'margin-bottom': '10px', // 10px = 7.5pt = 150 twips
            'text-align': 'justify'
        },
        'footnote': {
            name: 'Footnote',
            'font-size': '12pt',
            'line-height': '1.2' // 1.2 * 240 = 288
        }
    };

    // Mock Context
    const context = {
        baseFontSize: 16,
        getVariable: (name) => {
            if (name === '--font-text') return '??, "Minion 3"'; // Simulate bad variable
            return null;
        }
    };

    // 2. Convert Styles
    const converter = new DocxStyleConverter();
    const { styles, styleIdMap } = converter.convertStyles(stylesConfig, 100, 'Arial', context);

    // 3. Generate DOCX
    const paragraphs = [
        createParagraph(createRun('Hello World'), { style: styleIdMap['body'] })
    ];

    const generator = new MinimalDocxGenerator({
        paragraphs,
        styles: styles.paragraphStyles,
        defaultFont: 'Minion 3',
        defaultFontSize: 24
    });

    const buffer = await generator.generate();

    // 4. Inspect XML
    const zip = await JSZip.loadAsync(buffer);
    const stylesXml = await zip.file('word/styles.xml').async('string');

    let passed = true;

    // Helper to check for content
    const check = (desc, condition) => {
        if (condition) {
            console.log(`✅ ${desc}`);
        } else {
            console.error(`❌ ${desc}`);
            passed = false;
        }
    };

    console.log('--- DEBUG: Generated Styles XML ---');
    // console.log(stylesXml); // Commented out to reduce noise unless needed
    console.log('(XML hidden)');
    console.log('-----------------------------------');

    // Check Body Style
    // Font Size: 1.5rem = 24px = 18pt = 36 half-points
    check('Body Font Size (36 half-points)', stylesXml.includes('<w:sz w:val="36"/>'));

    // Font Family: Resolved from var(--font-text) -> Minion 3
    check('Body Font Family (Minion 3)', stylesXml.includes('w:ascii="Minion 3"'));

    // Text Indent: 2em = 32px = 24pt = 480 twips
    check('Body First Line Indent (480 twips)', stylesXml.includes('w:firstLine="480"'));

    // Margin Bottom: 10px = 7.5pt = 150 twips
    check('Body Spacing After (150 twips)', stylesXml.includes('w:after="150"'));

    // Alignment: justify
    // AlignmentType.JUSTIFIED is "both" in docx package usually
    check('Body Alignment (both)', stylesXml.includes('<w:jc w:val="both"/>') || stylesXml.includes('<w:jc w:val="distribute"/>'));

    // Check Footnote Style
    // Line Height: 1.2 -> 288
    check('Footnote Line Height (288)', stylesXml.includes('w:line="288"'));

    if (passed) {
        console.log('\n🎉 VERIFICATION PASSED');
        process.exit(0);
    } else {
        console.error('\n💥 VERIFICATION FAILED');
        console.log('Styles XML Preview:', stylesXml.substring(0, 2000));
        process.exit(1);
    }
}

verifyDocxExport().catch(err => {
    console.error(err);
    process.exit(1);
});
