import { describe, it, expect } from 'vitest';
import MarkdownBridge from '../src/markdown-bridge';

describe('MarkdownBridge', () => {
    const bridge = new MarkdownBridge();

    it('should dehydrate and hydrate basic text', () => {
        const doc = {
            type: 'doc',
            content: [
                {
                    type: 'body',
                    attrs: { id: 'abc123' },
                    content: [{ type: 'text', text: 'Hello world' }]
                }
            ]
        };

        const markdown = bridge.dehydrate(doc);
        expect(markdown).not.toContain('<!-- colophon-block:');
        expect(markdown).toBe('Hello world');

        const hydrated = bridge.hydrate(markdown);
        expect(hydrated.doc.content[0].type).toBe('body');
        expect(hydrated.doc.content[0].content[0].text).toBe('Hello world');
    });

    it('should handle markdown headings', () => {
        const markdown = '# Heading 1\n\n## Heading 2\n\n### Heading 3\n\n#### Heading 4';
        const hydrated = bridge.hydrate(markdown);
        
        expect(hydrated.doc.content[0].type).toBe('heading-1');
        
        expect(hydrated.doc.content[1].type).toBe('heading-2');
        
        expect(hydrated.doc.content[2].type).toBe('heading-3');
        
        // Level 4 maps to body per current logic
        expect(hydrated.doc.content[3].type).toBe('body');
    });

    it('should round-trip footnotes', () => {
        const doc = {
            type: 'doc',
            content: [
                {
                    type: 'body',
                    content: [
                        { type: 'text', text: 'Text with footnote' },
                        { type: 'footnoteMarker', attrs: { id: 'fn-1' } }
                    ]
                }
            ]
        };
        const footnotes = {
            'fn-1': {
                type: 'doc',
                content: [{ type: 'body', content: [{ type: 'text', text: 'Footnote content' }] }]
            }
        };

        const markdown = bridge.dehydrate(doc, footnotes);
        expect(markdown).toContain('[^fn-1]');
        expect(markdown).toContain('[^fn-1]: Footnote content');

        const hydrated = bridge.hydrate(markdown);
        expect(hydrated.doc.content[0].content[1].type).toBe('footnoteMarker');
        expect(hydrated.doc.content[0].content[1].attrs.id).toBe('fn-1');
        expect(hydrated.footnotes['fn-1']).toBeDefined();
    });

    it('should round-trip formatting', () => {
        const doc = {
            type: 'doc',
            content: [
                {
                    type: 'body',
                    content: [
                        { type: 'text', marks: [{ type: 'bold' }], text: 'bold' },
                        { type: 'text', text: ' and ' },
                        { type: 'text', marks: [{ type: 'italic' }], text: 'italic' }
                    ]
                }
            ]
        };

        const markdown = bridge.dehydrate(doc);
        expect(markdown).toContain('**bold** and *italic*');

        const hydrated = bridge.hydrate(markdown);
        expect(hydrated.doc.content[0].content[0].marks[0].type).toBe('bold');
        expect(hydrated.doc.content[0].content[2].marks[0].type).toBe('italic');
    });

    it('should round-trip internal links', () => {
        const doc = {
            type: 'doc',
            content: [
                {
                    type: 'body',
                    content: [
                        { type: 'internalLink', attrs: { target: 'Note', alias: 'Alias' } }
                    ]
                }
            ]
        };

        const markdown = bridge.dehydrate(doc);
        expect(markdown).toContain('[[Note|Alias]]');

        const hydrated = bridge.hydrate(markdown);
        expect(hydrated.doc.content[0].content[0].type).toBe('internalLink');
        expect(hydrated.doc.content[0].content[0].attrs.target).toBe('Note');
        expect(hydrated.doc.content[0].content[0].attrs.alias).toBe('Alias');
    });

    it('should round-trip inline comments', () => {
        const doc = {
            type: 'doc',
            content: [
                {
                    type: 'body',
                    content: [
                        { 
                            type: 'text', 
                            marks: [{ type: 'commentHighlight', attrs: { threadId: 't1' } }], 
                            text: 'commented' 
                        }
                    ]
                }
            ]
        };

        const markdown = bridge.dehydrate(doc);
        expect(markdown).toContain('<!-- colophon-comment: threadId="t1" -->commented<!-- colophon-comment-end -->');

        const hydrated = bridge.hydrate(markdown);
        expect(hydrated.doc.content[0].content[0].marks[0].type).toBe('commentHighlight');
        expect(hydrated.doc.content[0].content[0].marks[0].attrs.threadId).toBe('t1');
    });
});
