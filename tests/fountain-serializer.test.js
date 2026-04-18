import { describe, it, expect, vi } from 'vitest';
import { processDocument } from '../src/extensions/fountain-serializer';

vi.mock('obsidian', () => ({
    Notice: vi.fn()
}));

describe('Fountain Serializer Engine', () => {
    
    // Helper to mock the Tiptap document tree structure expected by `doc.descendants`
    const createMockDoc = (blocks) => {
        return {
            descendants: (cb) => {
                blocks.forEach((block) => {
                    // Simulates Tiptap callback (node, position)
                    cb(block, 0); 
                });
            }
        };
    };

    const createTextNode = (text, marks = []) => ({
        isText: true,
        text,
        marks: marks.length > 0 ? marks : undefined
    });

    const createBlockNode = (type, children) => ({
        isText: false,
        isBlock: true,
        type: { name: type },
        content: children
    });

    it('should properly format scene headings (natural and forced)', () => {
        // Natural prefix
        const doc1 = createMockDoc([
            createBlockNode('script-scene', [createTextNode('INT. OFFICE - DAY')])
        ]);
        expect(processDocument(doc1)).toBe('INT. OFFICE - DAY');

        // Forced prefix due to missing standard trigger
        const doc2 = createMockDoc([
            createBlockNode('script-scene', [createTextNode('LIVING ROOM')])
        ]);
        expect(processDocument(doc2)).toBe('.LIVING ROOM');
    });

    it('should format standard action blocks sequentially without prefixes', () => {
        const doc = createMockDoc([
            createBlockNode('script-action', [createTextNode('He walks across the room.')])
        ]);
        expect(processDocument(doc)).toBe('He walks across the room.');
    });

    it('should force uppercase on characters and inject forced character @ when needed', () => {
        const doc = createMockDoc([
            createBlockNode('script-character', [createTextNode('John')])
        ]);
        expect(processDocument(doc)).toBe('@JOHN');
        
        // Should not double-inject if already there
        const doc2 = createMockDoc([
            createBlockNode('script-character', [createTextNode('@MARY (V.O.)')])
        ]);
        expect(processDocument(doc2)).toBe('@MARY (V.O.)');
    });

    it('should wrap parentheticals gracefully without altering case', () => {
        const doc = createMockDoc([
            createBlockNode('script-parenthetical', [createTextNode('angrily')]),
            createBlockNode('script-parenthetical', [createTextNode('(softly)')])
        ]);
        
        // Expect single block line spacing between multiple back-to-back parentheticals
        expect(processDocument(doc)).toBe("(angrily)\n(softly)");
    });

    it('should inject correct spacing over a complex, compound script sequence', () => {
        const doc = createMockDoc([
            createBlockNode('script-scene', [createTextNode('INT. KITCHEN - NIGHT')]),
            createBlockNode('script-action', [createTextNode('Jack enters.')]),
            createBlockNode('script-character', [createTextNode('Jack')]),
            createBlockNode('script-parenthetical', [createTextNode('sighs')]),
            createBlockNode('script-dialogue', [createTextNode('Where is everyone?')]),
            createBlockNode('script-transition', [createTextNode('Cut To:')])
        ]);

        const expected = "INT. KITCHEN - NIGHT\n\nJack enters.\n\n@JACK\n(sighs)\nWhere is everyone?\n\n> CUT TO:";
        expect(processDocument(doc)).toBe(expected);
    });

    it('should maintain text markdown like bold and italics natively', () => {
         const doc = createMockDoc([
            createBlockNode('script-action', [
                createTextNode('He walks to the '),
                createTextNode('door', [{ type: { name: 'bold' } }]),
                createTextNode('.')
            ])
        ]);
        
        expect(processDocument(doc)).toBe('He walks to the **door**.');
    });
});
