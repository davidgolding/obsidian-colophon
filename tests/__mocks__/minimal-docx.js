// minimal-docx/index.js

const JSZip = require('jszip');

class MinimalDocxGenerator {
  constructor(options = {}) {
    this.paragraphs = options.paragraphs || [];
    this.styles = options.styles || [];
    this.defaultFont = options.defaultFont || 'Calibri';
    this.defaultFontSize = options.defaultFontSize || 22; // 11pt
  }

  createContentTypesXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
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
</Relationships>`;
  }

  createStylesXml() {
    const styleElements = this.styles.map(style => {
      const fontSize = style.fontSize || this.defaultFontSize;
      const font = style.font || this.defaultFont;

      let spacingXml = '';
      if (style.spacing) {
        const before = style.spacing.before !== undefined ? ` w:before="${style.spacing.before}"` : '';
        const after = style.spacing.after !== undefined ? ` w:after="${style.spacing.after}"` : '';
        const line = style.spacing.line !== undefined ? ` w:line="${style.spacing.line}"` : '';
        spacingXml = `<w:spacing${before}${after}${line}/>`;
      }

      return `
    <w:style w:type="paragraph" w:styleId="${style.id}">
      <w:name w:val="${style.name}"/>
      ${style.basedOn ? `<w:basedOn w:val="${style.basedOn}"/>` : ''}
      <w:pPr>
        ${spacingXml}
      </w:pPr>
      <w:rPr>
        <w:rFonts w:ascii="${font}" w:hAnsi="${font}"/>
        <w:sz w:val="${fontSize}"/>
        <w:szCs w:val="${fontSize}"/>
        ${style.bold ? '<w:b/>' : ''}
        ${style.italic ? '<w:i/>' : ''}
        ${style.color ? `<w:color w:val="${style.color}"/>` : ''}
      </w:rPr>
    </w:style>`;
    }).join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="${this.defaultFont}" w:hAnsi="${this.defaultFont}"/>
        <w:sz w:val="${this.defaultFontSize}"/>
        <w:szCs w:val="${this.defaultFontSize}"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:pPr>
      <w:spacing w:after="0" w:before="0" w:line="276"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="${this.defaultFont}" w:hAnsi="${this.defaultFont}"/>
      <w:sz w:val="${this.defaultFontSize}"/>
      <w:szCs w:val="${this.defaultFontSize}"/>
    </w:rPr>
  </w:style>${styleElements}
</w:styles>`;
  }

  escapeXml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  createRunXml(run) {
    const text = this.escapeXml(run.text);
    const size = run.size || this.defaultFontSize;
    const font = run.font || this.defaultFont;

    const props = [];
    if (run.bold) props.push('<w:b/>');
    if (run.italic) props.push('<w:i/>');
    if (run.underline) props.push('<w:u w:val="single"/>');
    if (run.color) props.push(`<w:color w:val="${run.color}"/>`);
    props.push(`<w:rFonts w:ascii="${font}" w:hAnsi="${font}"/>`);
    props.push(`<w:sz w:val="${size}"/>`);
    props.push(`<w:szCs w:val="${size}"/>`);

    const propsXml = props.length > 0 ? `<w:rPr>${props.join('')}</w:rPr>` : '';

    return `
      <w:r>
        ${propsXml}
        <w:t xml:space="preserve">${text}</w:t>
      </w:r>`;
  }

  createParagraphXml(paragraph) {
    const runs = paragraph.runs.map(run => this.createRunXml(run)).join('');

    const pPrElements = [];

    if (paragraph.style) {
      pPrElements.push(`<w:pStyle w:val="${paragraph.style}"/>`);
    }

    if (paragraph.alignment) {
      pPrElements.push(`<w:jc w:val="${paragraph.alignment}"/>`);
    }

    if (paragraph.indent !== undefined) {
      pPrElements.push(`<w:ind w:left="${paragraph.indent}"/>`);
    }

    if (paragraph.spacing) {
      const before = paragraph.spacing.before !== undefined ? ` w:before="${paragraph.spacing.before}"` : '';
      const after = paragraph.spacing.after !== undefined ? ` w:after="${paragraph.spacing.after}"` : '';
      const line = paragraph.spacing.line !== undefined ? ` w:line="${paragraph.spacing.line}"` : '';
      pPrElements.push(`<w:spacing${before}${after}${line}/>`);
    }

    const pPrXml = pPrElements.length > 0 ? `<w:pPr>${pPrElements.join('')}</w:pPr>` : '';

    return `
    <w:p>
      ${pPrXml}${runs}
    </w:p>`;
  }

  createDocumentXml() {
    const paragraphsXml = this.paragraphs.map(p => this.createParagraphXml(p)).join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${paragraphsXml}
  </w:body>
</w:document>`;
  }

  async generate() {
    const zip = new JSZip();

    // Add [Content_Types].xml
    zip.file('[Content_Types].xml', this.createContentTypesXml());

    // Add _rels/.rels
    zip.folder('_rels');
    zip.file('_rels/.rels', this.createRelsXml());

    // Add word folder and files
    zip.folder('word');
    zip.folder('word/_rels');
    zip.file('word/_rels/document.xml.rels', this.createDocumentRelsXml());
    zip.file('word/document.xml', this.createDocumentXml());
    zip.file('word/styles.xml', this.createStylesXml());

    return await zip.generateAsync({ type: 'nodebuffer' });
  }
}

// Helper functions for creating content
function createRun(text, options = {}) {
  return {
    text,
    bold: options.bold,
    italic: options.italic,
    underline: options.underline,
    size: options.size,
    color: options.color,
    font: options.font
  };
}

function createParagraph(runs, options = {}) {
  return {
    runs: Array.isArray(runs) ? runs : [runs],
    style: options.style,
    alignment: options.alignment,
    indent: options.indent,
    spacing: options.spacing
  };
}

function createStyle(id, name, options = {}) {
  return {
    id,
    name,
    basedOn: options.basedOn,
    fontSize: options.fontSize,
    bold: options.bold,
    italic: options.italic,
    color: options.color,
    font: options.font,
    spacing: options.spacing
  };
}

module.exports = {
  MinimalDocxGenerator,
  createRun,
  createParagraph,
  createStyle
};

// ============================================================
// package.json
// ============================================================
/*
{
  "name": "minimal-docx",
  "version": "1.0.0",
  "description": "A minimal DOCX generator with no default styles",
  "main": "index.js",
  "dependencies": {
    "jszip": "^3.10.1"
  },
  "keywords": ["docx", "word", "document", "office"],
  "author": "",
  "license": "MIT"
}
*/

// ============================================================
// README.md - Usage Examples
// ============================================================
/*
# minimal-docx

A minimal DOCX generator that gives you complete control over styles and content.

## Installation

```bash
pnpm add jszip
```

Then copy the `index.js` file into your project.

## Usage

```javascript
const fs = require('fs');
const { MinimalDocxGenerator, createRun, createParagraph, createStyle } = require('./minimal-docx');

// Create a simple document
async function example1() {
  const doc = new MinimalDocxGenerator({
    paragraphs: [
      createParagraph(createRun('Hello, World!')),
      createParagraph(createRun('This is a simple paragraph.'))
    ]
  });

  const buffer = await doc.generate();
  fs.writeFileSync('output.docx', buffer);
}

// Document with custom styles
async function example2() {
  const doc = new MinimalDocxGenerator({
    styles: [
      createStyle('Heading1', 'Heading 1', {
        fontSize: 32, // 16pt
        bold: true,
        color: '2E74B5',
        spacing: { before: 240, after: 120 }
      }),
      createStyle('Heading2', 'Heading 2', {
        fontSize: 26, // 13pt
        bold: true,
        color: '2E74B5',
        spacing: { before: 200, after: 100 }
      })
    ],
    paragraphs: [
      createParagraph(createRun('Document Title'), { style: 'Heading1' }),
      createParagraph(createRun('Introduction'), { style: 'Heading2' }),
      createParagraph(createRun('This is the introduction text.'))
    ]
  });

  const buffer = await doc.generate();
  fs.writeFileSync('styled.docx', buffer);
}

// Paragraph with multiple runs (mixed formatting)
async function example3() {
  const doc = new MinimalDocxGenerator({
    paragraphs: [
      createParagraph([
        createRun('This is '),
        createRun('bold', { bold: true }),
        createRun(' and this is '),
        createRun('italic', { italic: true }),
        createRun(' text.')
      ])
    ]
  });

  const buffer = await doc.generate();
  fs.writeFileSync('mixed.docx', buffer);
}

// Custom alignment and spacing
async function example4() {
  const doc = new MinimalDocxGenerator({
    paragraphs: [
      createParagraph(createRun('Centered Title'), {
        alignment: 'center',
        spacing: { after: 240 }
      }),
      createParagraph(createRun('Right-aligned text'), {
        alignment: 'right'
      }),
      createParagraph(createRun('Indented paragraph'), {
        indent: 720 // 720 twips = 0.5 inch
      })
    ]
  });

  const buffer = await doc.generate();
  fs.writeFileSync('formatted.docx', buffer);
}
```

## API

### MinimalDocxGenerator(options)

**options:**
- `paragraphs`: Array of paragraph objects
- `styles`: Array of style definitions (optional)
- `defaultFont`: Default font name (default: 'Calibri')
- `defaultFontSize`: Default font size in half-points (default: 22 = 11pt)

### createRun(text, options)

Creates a text run with formatting.

**options:**
- `bold`: boolean
- `italic`: boolean
- `underline`: boolean
- `size`: number (half-points, e.g., 24 = 12pt)
- `color`: string (hex without #, e.g., 'FF0000')
- `font`: string (font name)

### createParagraph(runs, options)

Creates a paragraph.

**runs:** Single run object or array of run objects

**options:**
- `style`: string (style ID)
- `alignment`: 'left' | 'center' | 'right' | 'justify'
- `indent`: number (twips, 1440 = 1 inch)
- `spacing`: object with `before`, `after`, `line` (in twips)

### createStyle(id, name, options)

Creates a style definition.

**options:**
- `basedOn`: string (parent style ID)
- `fontSize`: number (half-points)
- `bold`: boolean
- `italic`: boolean
- `color`: string (hex without #)
- `font`: string (font name)
- `spacing`: object with `before`, `after`, `line` (in twips)

## Notes

- Font sizes are in half-points (e.g., 24 = 12pt, 22 = 11pt)
- Measurements (spacing, indent) are in twips (1/1440 of an inch)
- Colors are hex values without the # symbol
- Only styles you define are included in the document
*/