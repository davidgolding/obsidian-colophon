import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Migration Logic (mirrored from src/main.js)
function migrateContentNodes(node) {
    if (!node) return;

    // Generate a simple 6-char random ID for v2.0 blocks
    const generateId = () => Math.random().toString(36).substring(2, 8);

    const blockClass = node.attrs?.class;
    const validTypes = ['body', 'supertitle', 'title', 'subtitle', 'epigraph', 'body-first', 'footnote', 'heading-1', 'heading-2', 'heading-3'];
    const legacyMsoClasses = ['MsoNormal', 'MsoNoSpacing', 'MsoFootnoteText', 'MsoListParagraph'];

    // 1. Handle Block Conversion (v1.x -> v2.0)
    if (node.type === 'paragraph' || node.type === 'blockquote' || node.type === 'codeBlock' || node.type === 'listItem' || (blockClass && legacyMsoClasses.includes(blockClass))) {
        if (blockClass && validTypes.includes(blockClass)) {
            node.type = blockClass;
        } else {
            node.type = 'body';
        }
        
        // Ensure every block has a unique ID for v2.0
        if (!node.attrs) node.attrs = {};
        node.attrs.id = generateId();
        delete node.attrs.class;
    } else if (node.type === 'heading') {
        const level = node.attrs?.level;
        if (blockClass === 'title') {
            node.type = 'title';
        } else if (level) {
            node.type = `heading-${level}`;
        } else {
            node.type = 'heading-1';
        }

        if (!node.attrs) node.attrs = {};
        node.attrs.id = generateId();
        delete node.attrs.level;
        delete node.attrs.class;
    } else if (node.type === 'footnote') {
        node.type = 'footnoteMarker';
    }

    // 2. Handle marks on the current node's content (if it's a text container)
    const inlineContainers = ['body', 'title', 'subtitle', 'supertitle', 'epigraph', 'body-first', 'footnote', 'footnoteMarker', 'heading-1', 'heading-2', 'heading-3', 'paragraph', 'listItem'];
    if (inlineContainers.includes(node.type) || (node.type && node.type.startsWith('heading-'))) {
        migrateMarks(node);
    }

    // 3. Flatten Lists and Recurse
    if (node.content && Array.isArray(node.content)) {
        // A. Flatten standard lists
        const processedContent = [];
        for (const child of node.content) {
            if (child.type === 'bulletList' || child.type === 'orderedList') {
                if (child.content && Array.isArray(child.content)) {
                    for (const listItem of child.content) {
                        if (listItem.type === 'listItem' && listItem.content) {
                            // Important: We recurse into listItem content BEFORE flattening
                            listItem.content.forEach(c => migrateContentNodes(c));
                            processedContent.push(...listItem.content);
                        }
                    }
                }
            } else {
                processedContent.push(child);
            }
        }
        node.content = processedContent;

        // B. Recurse into all children (except those already processed by flattening)
        node.content.forEach(child => {
            if (!child.attrs?.id || !validTypes.includes(child.type)) {
                migrateContentNodes(child);
            }
        });
    }
}

function migrateMarks(node) {
    if (!node || !node.content || !Array.isArray(node.content)) return;

    const newContent = [];
    
    for (const child of node.content) {
        // 1. Handle legacy 'internallink' marks or 'link' marks with 'internal-link' class
        const linkMark = child.marks?.find(m => 
            m.type === 'internallink' || 
            (m.type === 'link' && m.attrs?.class === 'internal-link')
        );
        
        if (linkMark && child.type === 'text') {
            newContent.push({
                type: 'internalLink',
                attrs: {
                    target: linkMark.attrs?.href || '',
                    alias: linkMark.attrs?.text || child.text || ''
                }
            });
            continue; // Link becomes a new node
        }

        // 2. Handle other marks (migrate legacy ones)
        if (child.marks) {
            child.marks = child.marks.map(mark => {
                if (mark.type === 'comment') {
                    return {
                        type: 'commentHighlight',
                        attrs: {
                            threadId: mark.attrs?.id || mark.attrs?.threadId
                        }
                    };
                }
                return mark;
            });

            // Filter out link marks converted to nodes
            child.marks = child.marks.filter(m => 
                m.type !== 'internallink' && 
                !(m.type === 'link' && m.attrs?.class === 'internal-link')
            );
            
            if (child.marks.length === 0) {
                delete child.marks;
            }
        }
        
        newContent.push(child);
    }
    
    node.content = newContent;
}

function parseLegacyFormat(content) {
    const match = content.match(/%% colophon:data\s*(\{[\s\S]*\})\s*%%/);
    if (!match) return null;

    try {
        return JSON.parse(match[1]);
    } catch (err) {
        console.error('Colophon: Failed to parse legacy data block:', err);
        return null;
    }
}

function transformLegacyData(data) {
    if (!data || !data.doc) return data;
    
    migrateContentNodes(data.doc);

    if (Array.isArray(data.footnotes)) {
        const footnotes = {};
        data.footnotes.forEach((fn) => {
            const id = fn.id || `fn-${Math.random().toString(36).substring(2, 8)}`;
            const content = fn.content || { type: 'doc', content: [{ type: 'body' }] };
            migrateContentNodes(content);
            footnotes[id] = content;
        });
        data.footnotes = footnotes;
    } else {
        data.footnotes = data.footnotes || {};
    }

    if (Array.isArray(data.comments)) {
        const comments = {};
        data.comments.forEach((comment) => {
            const id = comment.id || `comment-${Math.random().toString(36).substring(2, 8)}`;
            if (comment.content) {
                migrateContentNodes(comment.content);
            }
            if (!comment.replies) {
                comment.replies = [];
            }
            comments[id] = [comment];
        });
        data.comments = comments;
    } else {
        data.comments = data.comments || {};
    }

    return {
        type: 'manuscript',
        doc: data.doc,
        footnotes: data.footnotes,
        comments: data.comments
    };
}

describe('Legacy Migration', () => {
    it('should correctly migrate basic legacy format', () => {
        const data = {
            doc: {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        attrs: { class: 'supertitle' },
                        content: [{ type: 'text', text: 'Chapter 1' }]
                    }
                ]
            }
        };

        const transformed = transformLegacyData(data);
        expect(transformed.doc.content[0].type).toBe('supertitle');
    });

    it('should handle large nested JSON in parseLegacyFormat', () => {
        const content = `
---
colophon-plugin: manuscript
---

%% colophon:data {
  "doc": {
    "type": "doc",
    "content": [
      {
        "type": "paragraph",
        "attrs": { "class": "body" },
        "content": [ { "type": "text", "text": "Hello" } ]
      },
      {
        "type": "paragraph",
        "attrs": { "class": "MsoNormal" },
        "content": [ { "type": "text", "text": "World" } ]
      }
    ]
  },
  "footnotes": [],
  "comments": []
} %%
`;
        const parsed = parseLegacyFormat(content);
        expect(parsed).not.toBeNull();
        expect(parsed.doc.content.length).toBe(2);
        expect(parsed.doc.content[1].attrs.class).toBe('MsoNormal');
    });

    it('should flatten lists and migrate items correctly', () => {
        const data = {
            doc: {
                type: 'doc',
                content: [
                    {
                        type: 'bulletList',
                        content: [
                            {
                                type: 'listItem',
                                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 1' }] }]
                            }
                        ]
                    }
                ]
            }
        };

        const transformed = transformLegacyData(data);
        expect(transformed.doc.content[0].type).toBe('body');
        expect(transformed.doc.content[0].content[0].text).toBe('Item 1');
    });

    it('should convert internallink marks to nodes and preserve other marks', () => {
        const data = {
            doc: {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {
                                type: 'text',
                                marks: [
                                    { type: 'bold' },
                                    { type: 'internallink', attrs: { href: 'Target', text: 'Alias' } }
                                ],
                                text: 'Link'
                            }
                        ]
                    }
                ]
            }
        };

        const transformed = transformLegacyData(data);
        expect(transformed.doc.content[0].content[0].type).toBe('internalLink');
    });

    it('should handle unknown Mso classes by defaulting to body', () => {
        const data = {
            doc: {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        attrs: { class: 'MsoNoSpacing' },
                        content: [{ type: 'text', text: 'Text' }]
                    }
                ]
            }
        };

        const transformed = transformLegacyData(data);
        expect(transformed.doc.content[0].type).toBe('body');
    });
});
