import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Migration Logic (mirrored from src/main.js)
function migrateContentNodes(node) {
    if (!node) return;

    const generateId = () => Math.random().toString(36).substring(2, 8);

    if (node.type === 'paragraph') {
        const blockClass = node.attrs?.class;
        if (blockClass) {
            node.type = blockClass;
        } else {
            node.type = 'body';
        }
        if (!node.attrs) node.attrs = {};
        node.attrs.id = generateId();
        delete node.attrs.class;
    }

    if (node.type === 'heading') {
        const level = node.attrs?.level;
        const blockClass = node.attrs?.class;

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
    }

    if (node.type === 'footnote') {
        node.type = 'footnoteMarker';
    }

    if (node.content && Array.isArray(node.content)) {
        const processedContent = [];
        for (const child of node.content) {
            if (child.type === 'bulletList' || child.type === 'orderedList') {
                if (child.content && Array.isArray(child.content)) {
                    for (const listItem of child.content) {
                        if (listItem.type === 'listItem' && listItem.content) {
                            processedContent.push(...listItem.content);
                        }
                    }
                }
            } else {
                processedContent.push(child);
            }
        }
        node.content = processedContent;
        node.content.forEach(child => migrateContentNodes(child));
    }
}

function migrateInternalLinks(node) {
    if (!node) return;
    if (node.content && Array.isArray(node.content)) {
        const newContent = [];
        for (const child of node.content) {
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
            } else {
                if (child.marks) {
                    child.marks = child.marks.filter(m => 
                        m.type !== 'internallink' && 
                        !(m.type === 'link' && m.attrs?.class === 'internal-link')
                    );
                    if (child.marks.length === 0) delete child.marks;
                }
                if (child.content) migrateInternalLinks(child);
                newContent.push(child);
            }
        }
        node.content = newContent;
    }
}

function transformLegacyData(data) {
    migrateContentNodes(data.doc);
    migrateInternalLinks(data.doc);

    if (Array.isArray(data.footnotes)) {
        const footnotes = {};
        data.footnotes.forEach((fn) => {
            const id = fn.id || `fn-${crypto.randomUUID()}`;
            const content = fn.content || { type: 'doc', content: [{ type: 'body' }] };
            migrateContentNodes(content);
            migrateInternalLinks(content);
            footnotes[id] = content;
        });
        data.footnotes = footnotes;
    } else {
        data.footnotes = data.footnotes || {};
    }

    if (Array.isArray(data.comments)) {
        const comments = {};
        data.comments.forEach((comment) => {
            const id = comment.id || `comment-${crypto.randomUUID()}`;
            if (comment.content) {
                migrateContentNodes(comment.content);
                migrateInternalLinks(comment.content);
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

function runMigrationTest(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const match = content.match(/%% colophon:data\s*\{(.+?)\}\s*%%/s);
    expect(match, `Could not find colophon:data block in ${filePath}`).toBeTruthy();
    
    const parsed = JSON.parse('{' + match[1] + '}');
    const transformed = transformLegacyData(parsed);

    const doc = transformed.doc;
    expect(doc.content.length).toBeGreaterThan(0);

    // Verify all listItem/bulletList/orderedList are flattened
    const listNodes = [];
    const findLists = (n) => {
        if (['bulletList', 'orderedList', 'listItem'].includes(n.type)) listNodes.push(n);
        if (n.content) n.content.forEach(findLists);
    };
    doc.content.forEach(findLists);
    expect(listNodes.length, "Document should contain no list nodes after migration").toBe(0);

    // Verify block IDs exist
    doc.content.forEach(node => {
        if (node.type !== 'horizontalRule') {
            expect(node.attrs?.id, `Node of type ${node.type} missing ID`).toBeDefined();
        }
    });

    let foundFootnoteMarker = false;
    doc.content.forEach(node => {
        if (node.content) {
            node.content.forEach(child => {
                if (child.type === 'footnoteMarker') foundFootnoteMarker = true;
            });
        }
    });
    expect(foundFootnoteMarker).toBe(true);
}

describe('Legacy Migration', () => {
    it('should correctly migrate legacy-mock.md to 2.x format', () => {
        runMigrationTest(path.resolve(__dirname, '../docs/legacy-mock.md'));
    });

    it('should correctly migrate legacy-mock-alt.md to 2.x format', () => {
        runMigrationTest(path.resolve(__dirname, '../docs/legacy-mock-alt.md'));
    });

    it('should correctly migrate legacy-mock-2.md (with lists) to 2.x format', () => {
        runMigrationTest(path.resolve(__dirname, '../docs/legacy-mock-2.md'));
    });
});
