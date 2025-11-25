const Paragraph = require('@tiptap/extension-paragraph');
console.log('Type of Paragraph:', typeof Paragraph);
console.log('Keys:', Object.keys(Paragraph));
console.log('Paragraph.extend:', Paragraph.extend);
console.log('Paragraph.default:', Paragraph.default);
if (Paragraph.default) {
    console.log('Paragraph.default.extend:', Paragraph.default.extend);
}
