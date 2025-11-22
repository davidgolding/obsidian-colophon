const TiptapAdapter = require('../src/tiptap-adapter');

// Mock Obsidian dependencies if needed (though adapter mostly uses Tiptap)
// Tiptap uses DOM, so jsdom environment is required.

describe('TiptapAdapter', () => {
    let container;
    let adapter;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        adapter = new TiptapAdapter(container, false, null);
    });

    afterEach(() => {
        if (adapter) adapter.destroy();
        document.body.innerHTML = '';
    });

    test('loads markdown content correctly', () => {
        const markdown = 'Hello World';
        adapter.load(markdown, null);

        expect(adapter.editor.getText()).toBe('Hello World');
    });

    test('adds a footnote', () => {
        adapter.load('Text', null);
        const id = adapter.addFootnote();

        expect(id).toBeDefined();
        expect(id).toMatch(/^fn-/);

        const footnotes = adapter.getFootnotes();
        expect(footnotes.length).toBe(1);
        expect(footnotes[0].id).toBe(id);
        expect(footnotes[0].content).toBe('');
    });

    test('updates footnote content', () => {
        adapter.load('Text', null);
        const id = adapter.addFootnote();

        adapter.updateFootnote(id, 'New Content');

        const footnotes = adapter.getFootnotes();
        expect(footnotes[0].content).toBe('New Content');
    });

    test('calculates footnote numbers', () => {
        adapter.load('Text', null);
        const id1 = adapter.addFootnote();
        const id2 = adapter.addFootnote();

        // Trigger update to calculate numbers
        adapter.triggerUpdate();

        const footnotes = adapter.getFootnotes();
        expect(footnotes.length).toBe(2);

        // Since we append, order should be preserved if cursor is at end
        // But addFootnote inserts at cursor.
        // Let's check the numbers assigned.
        // Note: TiptapAdapter.triggerUpdate updates the 'number' property in the footnotes list

        expect(footnotes[0].number).toBe('1');
        expect(footnotes[1].number).toBe('2');
    });
});
