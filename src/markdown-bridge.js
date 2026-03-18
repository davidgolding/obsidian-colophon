const { DOMParser } = require('@tiptap/core');
const diff = require('fast-diff');

class MarkdownBridge {
    constructor(schema) {
        this.schema = schema;
    }

    /**
     * Dehydrates a ProseMirror document into Markdown Body and Line-Based Metadata.
     * @param {Object} doc - The ProseMirror JSON document.
     * @returns {Object} - { markdown: string, linesMeta: Array }
     */
    dehydrate(doc) {
        if (!doc || !doc.content) return { markdown: '', linesMeta: [] };

        const linesMeta = [];
        const markdownLines = [];

        // We assume block-level nodes map 1:1 to "lines" in our simplified Markdown.
        // Complex nesting (nested lists) poses a challenge for 1:1 mapping if not careful.
        // For this MVP, we treat top-level blocks as "lines".

        doc.content.forEach((node, index) => {
            const lineIndex = index; // Simplified: Top-level index.

            // 1. Extract Structural Metadata (classes, ids, types)
            // We store anything that isn't standard Markdown.
            const meta = {
                line: lineIndex,
                type: node.type,
                attrs: node.attrs || {} // We might want to filter standard attrs (level)
            };

            // Optimization: Only store meta if it has non-default attributes?
            // For robustness, explicit is better for now.
            linesMeta.push(meta);

            // 2. Generate Markdown Line
            markdownLines.push(this.serializeNode(node));
        });

        return {
            markdown: markdownLines.join('\n\n'), // Standard blank line separation
            linesMeta: linesMeta
        };
    }

    /**
     * Hydrates a ProseMirror document from Markdown and Line-Based Metadata.
     * @param {string} markdown - The raw markdown content.
     * @param {Array} linesMeta - The stored metadata array.
     * @param {string} storedHash - The hash of the markdown when meta was saved.
     * @returns {Promise<Object>} - The ProseMirror JSON document.
     */
    async hydrate(markdown, linesMeta, storedHash) {
        const currentHash = await this.generateHash(markdown);
        let validMeta = linesMeta || [];

        // 1. Check for drift
        if (storedHash && currentHash !== storedHash) {
            console.log("Colophon: Hash mismatch. Attempting healing...");

            // We need the "Old Markdown" to diff against.
            // But we don't store the full markdown text in the sidecar (Zero Duplication!).
            // We only have the hash.
            // This is a Catch-22 for "Diffing" if we don't have the original text.

            // RFC Update / Correction:
            // "Diff between Last Known Markdown (reconstructed...) and Current".
            // To reconstruct, we need the "Old Markdown". 
            // If we don't store it, we can't diff it.
            // WE MUST STORE THE MARKDOWN BODY in the sidecar if we want robust diffing?
            // OR we store "Line Checksums"?

            // Alternative: Heuristic Healing.
            // If we lack the original text, we can't reliably know WHERE lines were inserted.
            // However, the metadata array has "types".
            // We could try to align based on content? No, content changed.

            // Realization: For "Hydrated Text" to support Diff-Healing, we DO need a reference copy.
            // But storing the full copy violates "Zero Duplication".

            // Hybrid Solution: "Shadow Copy" or "Line Hashes".
            // Let's store an array of [LineHash, LineMeta] in the sidecar?
            // If we store a hash for EVERY line, we can re-align.
            // fast-diff works on strings.
            // If we store the "Previous Markdown" compressed? Or just accept duplication for safety?
            // Zero-Duplication was the goal. 
            // "Line Hashes" is the most efficient Zero-Dupe way.

            // Implementation Adjustment:
            // dehydrate() now needs to return "Line Hashes".
            // healMetadata() will diff (OldLineHashes vs NewLineHashes).

            // For this step, I will implement `healMetadata` assuming we have `linesMeta` containing `contentHash` for each line.
            // I will update `dehydrate` to include `contentHash`.

            validMeta = this.healMetadata(markdown, linesMeta);
        }

        // 2. Parse Markdown into Lines
        const lines = markdown.split(/\n\n+/);

        // 3. Reconstruct Nodes
        const content = lines.map((lineText, index) => {
            // Find metadata for this line index
            // If healing worked, indices in validMeta should align with 'lines'.
            const meta = validMeta.find(m => m.line === index);

            let nodeType = 'paragraph';
            let attrs = {};

            if (meta) {
                nodeType = meta.type;
                attrs = meta.attrs;
            } else {
                // Infer from Markdown if no meta (e.g. new line added externally)
                const headingMatch = lineText.match(/^(#{1,6})\s+(.*)/);
                if (headingMatch) {
                    nodeType = 'heading';
                    attrs = { level: headingMatch[1].length };
                    // Strip markdown syntax from text for the inline parser?
                    // serializeInline adds it. parseInline logic needs to handle clean text?
                    // Wait, our parseInline handles raw text.
                    // If we use 'heading' type, the content should NOT have '#'.
                    // So we must strip it here.
                    lineText = headingMatch[2];
                }
            }

            return {
                type: nodeType,
                attrs: attrs,
                content: this.parseInline(lineText.trim())
            };
        });

        return {
            type: 'doc',
            content: content
        };
    }

    /**
     * Re-aligns metadata indices by diffing line hashes.
     */
    healMetadata(currentMarkdown, oldMeta) {
        if (!oldMeta || oldMeta.length === 0) return [];

        const currentLines = currentMarkdown.split(/\n\n+/);
        // Generate hashes for current lines
        const currentHashes = currentLines.map(line => `${line.substring(0, 10)}:${line.length}`);
        const oldHashes = oldMeta.map(m => m.h);

        // Simplified Logic for MVP:
        // Iterate and find best match offset.
        // If Old Line 0 Hash == Current Line 1 Hash -> Offset +1.

        let validMeta = [];
        let offset = 0;

        // Very basic "Greedy Match" alignment
        oldMeta.forEach((meta) => {
            const oldIdx = meta.line;
            const targetIdx = oldIdx + offset;

            // Check if match at expected index
            if (currentHashes[targetIdx] === meta.h) {
                // Match confirmed
                validMeta.push({ ...meta, line: targetIdx });
            } else {
                // Mismatch. Search neighborhood.
                // Did we insert lines? Check +1, +2...
                let found = false;
                for (let i = 1; i < 5; i++) {
                    if (currentHashes[targetIdx + i] === meta.h) {
                        offset += i; // Update offset for subsequent lines
                        validMeta.push({ ...meta, line: targetIdx + i });
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    // Check deletions? Check -1, -2...
                    for (let i = 1; i < 5; i++) {
                        if (targetIdx - i >= 0 && currentHashes[targetIdx - i] === meta.h) {
                            offset -= i;
                            validMeta.push({ ...meta, line: targetIdx - i });
                            found = true;
                            break;
                        }
                    }
                }

                // If still not found, line likely modified heavily. Drop metadata for this line.
            }
        });

        return validMeta;
    }

    serializeNode(node) {
        switch (node.type) {
            case 'paragraph':
                return this.serializeInline(node.content);
            case 'heading':
                // We DON'T store '#' in markdown here if we want clean text?
                // RFC says "clean Markdown body". So yes, standard MD.
                const level = '#'.repeat(node.attrs.level || 1);
                return `${level} ${this.serializeInline(node.content)}`;
            case 'bulletList':
                return node.content.map(listItem => this.serializeListItem(listItem, '-')).join('\n');
            case 'orderedList':
                return node.content.map((listItem, index) => this.serializeListItem(listItem, `${index + 1}.`)).join('\n');
            case 'footnote':
                return `[^${node.attrs.id}]`;
            default:
                // Fallback for custom nodes: just serialize content
                return this.serializeInline(node.content);
        }
    }

    serializeListItem(node, bullet) {
        if (node.type !== 'listItem') return '';
        const content = node.content.map(child => this.serializeNode(child)).join('\n    ');
        return `${bullet} ${content}`;
    }

    serializeInline(content) {
        if (!content) return '';
        return content.map(node => {
            let text = node.text || '';

            if (node.type === 'footnote') {
                return `[^${node.attrs.id}]`;
            }

            let commentId = null;
            if (node.marks) {
                const commentMark = node.marks.find(m => m.type === 'comment');
                if (commentMark) {
                    commentId = commentMark.attrs.id;
                }
                node.marks.forEach(mark => {
                    if (mark.type === 'comment') return;
                    switch (mark.type) {
                        case 'bold': text = `**${text}**`; break;
                        case 'italic': text = `*${text}*`; break;
                        case 'code': text = `\`${text}\``; break;
                    }
                });
            }

            if (commentId) {
                text = `{==${text}==}{>> #${commentId} <<}`;
            }

            return text;
        }).join('');
    }

    parseInline(text) {
        // ... (Keep existing robust regex parser)
        const nodes = [];
        const regex = /(\[\^fn-[\w-]+\])|(\{==(.*?)==\}\{>>\s*#([\w-]+)\s*<<\})/g;
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                nodes.push({ type: 'text', text: text.substring(lastIndex, match.index) });
            }

            if (match[1]) {
                const id = match[1].substring(2, match[1].length - 1);
                nodes.push({ type: 'footnote', attrs: { id: id, number: '#' } });
            } else if (match[2]) {
                const contentText = match[3];
                const id = match[4];
                nodes.push({
                    type: 'text',
                    text: contentText,
                    marks: [{ type: 'comment', attrs: { id: id, class: 'comment' } }]
                });
            }
            lastIndex = regex.lastIndex;
        }

        if (lastIndex < text.length) {
            nodes.push({ type: 'text', text: text.substring(lastIndex) });
        }
        return nodes.length > 0 ? nodes : (text ? [{ type: 'text', text: text }] : []);
    }

    async generateHash(content) {
        const msgBuffer = new TextEncoder().encode(content);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
}

module.exports = MarkdownBridge;
