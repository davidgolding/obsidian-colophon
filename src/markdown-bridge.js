/**
 * MarkdownBridge handles conversion between Colophon JSON and Clean Markdown (Option B).
 * 
 * Strategy:
 * - Block types and IDs: Stored in preceding HTML comments <!-- colophon-block: id="..." type="..." -->
 * - Inline Comments: Wrapped in HTML comments <!-- colophon-comment: threadId="..." -->...<!-- colophon-comment-end -->
 * - Footnotes: Standard Markdown syntax [^id] with definitions at bottom.
 * - Formatting: Standard Markdown (**bold**, *italic*, `code`).
 */
class MarkdownBridge {
    constructor() {
        // No schema needed for this implementation as we work with JSON directly
    }

    /**
     * Converts Colophon data into a Clean Markdown string.
     */
    dehydrate(doc, footnotes = {}, comments = {}) {
        if (!doc || !doc.content) return '';

        const markdownBlocks = [];

        // 1. Serialize Blocks
        doc.content.forEach((node) => {
            const blockMd = this.serializeNode(node);
            if (blockMd) {
                // We no longer add block metadata comments as requested
                markdownBlocks.push(blockMd);
            }
        });

        let output = markdownBlocks.join('\n\n');

        // 2. Append Footnotes
        const footnoteEntries = Object.entries(footnotes);
        if (footnoteEntries.length > 0) {
            output += '\n\n---\n\n'; // Separator
            footnoteEntries.forEach(([id, content]) => {
                // Footnote content is a 'doc' object in Colophon
                const contentMd = content.content.map(node => this.serializeNode(node)).join(' ').trim();
                output += `[^${id}]: ${contentMd}\n`;
            });
        }

        return output;
    }

    /**
     * Parses Clean Markdown back into Colophon structure.
     */
    hydrate(markdown) {
        const lines = markdown.split('\n');
        const docContent = [];
        const footnotes = {};
        
        let currentBlockMeta = null;
        let currentBlockLines = [];

        const flushBlock = () => {
            if (currentBlockLines.length === 0 && !currentBlockMeta) return;
            
            let text = currentBlockLines.join('\n').trim();
            if (!text && !currentBlockMeta) return;

            let type = currentBlockMeta?.type || 'body';
            let attrs = { id: currentBlockMeta?.id || this.generateShortId() };
            
            // Auto-detect heading levels if no explicit meta is present
            const headingMatch = text.match(/^(#{1,4})\s+([\s\S]*)/);
            if (headingMatch && !currentBlockMeta) {
                const level = headingMatch[1].length;
                if (level <= 3) {
                    type = `heading-${level}`;
                } else {
                    // Level 4 maps to body per request
                    type = 'body'; 
                }
                text = headingMatch[2];
            }

            // In Colophon v2.0, the node type name IS 'heading-1', 'heading-2', etc.
            // There is no generic 'heading' node in the schema.
            docContent.push({
                type: type,
                attrs: attrs,
                content: this.parseInline(text)
            });
            
            currentBlockLines = [];
            currentBlockMeta = null;
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // 1. Check for Footnote definitions at the bottom
            const fnMatch = line.match(/^\[\^([\w-]+)\]:\s*(.*)/);
            if (fnMatch) {
                flushBlock();
                const id = fnMatch[1];
                const fnText = fnMatch[2];
                footnotes[id] = {
                    type: 'doc',
                    content: [{ type: 'body', attrs: { id: this.generateShortId() }, content: this.parseInline(fnText) }]
                };
                continue;
            }

            // 2. Check for separator
            if (line.trim() === '---' && i > lines.length - 20) {
                flushBlock();
                continue;
            }

            // 3. Check for block metadata (keep support for legacy or manual round-trips)
            const blockMatch = line.match(/<!-- colophon-block: id="(.*?)" type="(.*?)" -->/);
            if (blockMatch) {
                flushBlock();
                currentBlockMeta = { id: blockMatch[1], type: blockMatch[2] };
                continue;
            }

            // 4. Handle empty lines (paragraph breaks)
            if (line.trim() === '') {
                flushBlock();
                continue;
            }

            currentBlockLines.push(line);
        }
        flushBlock();

        return {
            type: 'manuscript',
            doc: { type: 'doc', content: docContent },
            footnotes,
            comments: {} // Comments are hydrated via parseInline into marks
        };
    }

    serializeNode(node) {
        if (!node) return '';
        
        switch (node.type) {
            case 'heading':
            case 'heading-1':
            case 'heading-2':
            case 'heading-3':
                let level = node.attrs?.level;
                if (!level && node.type.startsWith('heading-')) {
                    level = parseInt(node.type.split('-')[1]);
                }
                const prefix = '#'.repeat(level || 1);
                return `${prefix} ${this.serializeInline(node.content)}`;
            case 'body':
            case 'paragraph':
            case 'supertitle':
            case 'title':
            case 'subtitle':
            case 'epigraph':
            case 'body-first':
            case 'footnote':
                return this.serializeInline(node.content);
            case 'horizontalRule':
                return '---';
            case 'hardBreak':
                return '\n';
            default:
                return this.serializeInline(node.content);
        }
    }

    serializeInline(content) {
        if (!content || !Array.isArray(content)) return '';
        
        return content.map(node => {
            if (node.type === 'footnoteMarker' || node.type === 'footnote') {
                return `[^${node.attrs?.id}]`;
            }
            if (node.type === 'internalLink') {
                const alias = node.attrs?.alias || node.attrs?.target;
                return `[[${node.attrs?.target}|${alias}]]`;
            }
            
            let text = node.text || '';
            if (node.marks) {
                node.marks.forEach(mark => {
                    switch (mark.type) {
                        case 'bold': text = `**${text}**`; break;
                        case 'italic': text = `*${text}*`; break;
                        case 'code': text = `\`${text}\``; break;
                        case 'strike': text = `~~${text}~~`; break;
                        case 'underline': text = `<u>${text}</u>`; break;
                        case 'commentHighlight': 
                            text = `<!-- colophon-comment: threadId="${mark.attrs?.threadId}" -->${text}<!-- colophon-comment-end -->`;
                            break;
                    }
                });
            }
            return text;
        }).join('');
    }

    parseInline(text) {
        const nodes = [];
        // Regex to find footnotes, internal links, comments, and standard markdown marks
        // 1. Footnotes: [^id]
        // 2. Internal Links: [[target|alias]]
        // 3. Comments: <!-- colophon-comment ... -->
        // 4. Bold: **text**
        // 5. Italic: *text*
        // 6. Code: `text`
        // 7. Strike: ~~text~~
        // 8. Underline: <u>text</u>
        const regex = /(\[\^([\w-]+)\])|(\[\[(.*?)(?:\|(.*?))?\]\])|(<!-- colophon-comment: threadId="(.*?)" -->([\s\S]*?)<!-- colophon-comment-end -->)|(\*\*(.*?)\*\*)|(\*(.*?)\*)|(`(.*?)`)|(~~(.*?)~~)|(<u>(.*?)<\/u>)/g;
        
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
            // Add preceding plain text
            if (match.index > lastIndex) {
                nodes.push({ type: 'text', text: text.substring(lastIndex, match.index) });
            }

            if (match[1]) { // Footnote
                nodes.push({ type: 'footnoteMarker', attrs: { id: match[2] } });
            } else if (match[3]) { // Internal Link
                const target = match[4];
                const alias = match[5] || target;
                nodes.push({ type: 'internalLink', attrs: { target, alias } });
            } else if (match[6]) { // Comment
                const threadId = match[7];
                const content = match[8];
                const innerNodes = this.parseInline(content);
                innerNodes.forEach(n => {
                    if (n.type === 'text') {
                        if (!n.marks) n.marks = [];
                        n.marks.push({ type: 'commentHighlight', attrs: { threadId } });
                    }
                    nodes.push(n);
                });
            } else if (match[9]) { // Bold
                nodes.push({ type: 'text', text: match[10], marks: [{ type: 'bold' }] });
            } else if (match[11]) { // Italic
                nodes.push({ type: 'text', text: match[12], marks: [{ type: 'italic' }] });
            } else if (match[13]) { // Code
                nodes.push({ type: 'text', text: match[14], marks: [{ type: 'code' }] });
            } else if (match[15]) { // Strike
                nodes.push({ type: 'text', text: match[16], marks: [{ type: 'strike' }] });
            } else if (match[17]) { // Underline
                nodes.push({ type: 'text', text: match[18], marks: [{ type: 'underline' }] });
            }
            
            lastIndex = regex.lastIndex;
        }

        if (lastIndex < text.length) {
            nodes.push({ type: 'text', text: text.substring(lastIndex) });
        }

        return nodes;
    }

    generateShortId() {
        return Math.random().toString(36).substring(2, 8);
    }
}

module.exports = MarkdownBridge;
