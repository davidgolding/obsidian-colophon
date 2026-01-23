const { DOMParser } = require('@tiptap/core'); // Theoretically available if needed, but we deal with JSON/Strings
// Note: We might need a more robust Markown parser if complexity grows.
// For now, we implement a bespoke parser/serializer for the specific Colophon schema.

class MarkdownBridge {
    constructor(schema) {
        this.schema = schema;
    }

    /**
     * Serializes a ProseMirror JSON document to Obsidian-flavored Markdown.
     * @param {Object} doc - The ProseMirror JSON document.
     * @returns {string} - The Markdown string.
     */
    serialize(doc) {
        if (!doc || !doc.content) return '';
        return doc.content.map(node => this.serializeNode(node)).join('\n\n');
    }

    serializeNode(node) {
        switch (node.type) {
            case 'paragraph':
                return this.serializeInline(node.content);
            case 'heading':
                const level = '#'.repeat(node.attrs.level || 1);
                return `${level} ${this.serializeInline(node.content)}`;
            case 'bulletList':
                return node.content.map(listItem => this.serializeListItem(listItem, '-')).join('\n');
            case 'orderedList':
                return node.content.map((listItem, index) => this.serializeListItem(listItem, `${index + 1}.`)).join('\n');
            case 'footnote':
                // Serialize as a footnote marker. The definition is separate.
                // Actually, in the body, it's just `[^fn-id]`.
                return `[^${node.attrs.id}]`;
            // Add other block types here
            default:
                console.warn(`Unknown node type: ${node.type}`);
                return '';
        }
    }

    serializeListItem(node, bullet) {
        if (node.type !== 'listItem') return '';
        const content = node.content.map(child => this.serializeNode(child)).join('\n    '); // Indent children
        return `${bullet} ${content}`;
    }

    serializeInline(content) {
        if (!content) return '';
        return content.map(node => {
            let text = node.text || '';

            if (node.type === 'footnote') {
                return `[^${node.attrs.id}]`;
            }

            // Check for Comment Mark first to wrap content
            let commentId = null;
            if (node.marks) {
                const commentMark = node.marks.find(m => m.type === 'comment');
                if (commentMark) {
                    commentId = commentMark.attrs.id;
                }

                // First apply inner marks (bold, italic)
                node.marks.forEach(mark => {
                    if (mark.type === 'comment') return; // Handle wrapper later
                    switch (mark.type) {
                        case 'bold':
                            text = `**${text}**`;
                            break;
                        case 'italic':
                            text = `*${text}*`;
                            break;
                        case 'code':
                            text = `\`${text}\``;
                            break;
                    }
                });
            }

            // Wrap in CriticMarkup Highlight+Comment if commented
            if (commentId) {
                text = `{==${text}==}{>> #${commentId} <<}`;
            }

            return text;
        }).join('');
    }

    /**
     * Parses Markdown into a ProseMirror JSON document.
     * @param {string} markdown 
     * @returns {Object} - ProseMirror JSON
     */
    parse(markdown) {
        // Very basic parser for now. 
        // A complete parser would be complex. 
        // TODO: Integrate a proper Markdown parser (e.g. centralized parser or library).

        const lines = markdown.split(/\n\n+/);
        const content = lines.map(line => {
            // Detect Headers
            const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
            if (headingMatch) {
                return {
                    type: 'heading',
                    attrs: { level: headingMatch[1].length },
                    content: this.parseInline(headingMatch[2])
                };
            }

            // Detect Lists (Basic)
            // ...

            // Default to Paragraph
            return {
                type: 'paragraph',
                content: this.parseInline(line.trim())
            };
        });

        return {
            type: 'doc',
            content: content
        };
    }

    parseInline(text) {
        const nodes = [];
        // Regex to match:
        // 1. Footnote: [^fn-id]
        // 2. Highlight+Comment: {== text ==}{>> #id <<}
        // Note: Regex for balanced braces is hard. Assuming simple non-nested for now.
        const regex = /(\[\^fn-[\w-]+\])|(\{==(.*?)==\}\{>>\s*#([\w-]+)\s*<<\})/g;

        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
            // Text before match
            if (match.index > lastIndex) {
                nodes.push({ type: 'text', text: text.substring(lastIndex, match.index) });
            }

            if (match[1]) {
                // Footnote: [^fn-id]
                const id = match[1].substring(2, match[1].length - 1);
                nodes.push({
                    type: 'footnote',
                    attrs: { id: id, number: '#' }
                });
            } else if (match[2]) {
                // Highlight+Comment
                const contentText = match[3];
                const id = match[4];

                nodes.push({
                    type: 'text',
                    text: contentText,
                    marks: [
                        {
                            type: 'comment',
                            attrs: { id: id, class: 'comment' }
                        }
                    ]
                });
            }

            lastIndex = regex.lastIndex;
        }

        if (lastIndex < text.length) {
            nodes.push({ type: 'text', text: text.substring(lastIndex) });
        }

        return nodes.length > 0 ? nodes : (text ? [{ type: 'text', text: text }] : []);
    }

    /**
     * Generates a SHA-256 hash of the content.
     * @param {string} content 
     * @returns {Promise<string>}
     */
    async generateHash(content) {
        const msgBuffer = new TextEncoder().encode(content);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }
}

module.exports = MarkdownBridge;
