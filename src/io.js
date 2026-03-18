
/**
 * Parses the file content into Markdown body and Sidecar data.
 * The sidecar is expected to be in a comment block at the end of the file:
 * %% colophon:data { ... } %%
 * 
 * @param {string} content 
 * @returns {{ markdown: string, data: object|null }}
 */
/**
 * Parses the file content into Markdown body, Sidecar data, and Frontmatter.
 * 
 * @param {string} content 
 * @returns {{ markdown: string, data: object|null, frontmatter: string }}
 */
function parseFile(content) {
    let markdown = content;
    let frontmatter = '';
    let data = null;

    // 1. Extract Frontmatter (must be at start of file)
    const fmRegex = /^---\n[\s\S]*?\n---\n/;
    const fmMatch = content.match(fmRegex);
    if (fmMatch) {
        frontmatter = fmMatch[0];
        markdown = markdown.substring(frontmatter.length);
    }

    // 2. Extract Sidecar (Metadata Only)
    // New format: %% colophon:meta { ... } %%
    // Legacy format support could be added here if migration is needed, but for now we target the new format.
    const metaRegex = /%% colophon:meta\s*(\{[\s\S]*?\})\s*%%$/;
    const metaMatch = markdown.match(metaRegex);

    if (metaMatch) {
        try {
            data = JSON.parse(metaMatch[1]);
            // Remove the metadata block from the markdown content
            markdown = markdown.replace(metaRegex, '').trimEnd();
        } catch (e) {
            console.error("Colophon: Failed to parse metadata block", e);
        }
    } else {
        // Fallback: Check for legacy data block to avoid data loss during transition/dev
        const legacyRegex = /%% colophon:data\s*(\{[\s\S]*?\})\s*%%$/;
        const legacyMatch = markdown.match(legacyRegex);
        if (legacyMatch) {
            try {
                data = JSON.parse(legacyMatch[1]);
                markdown = markdown.replace(legacyRegex, '').trimEnd();
                // We might want to flag this data as legacy structure?
                // For now, the adapter deals with structure.
            } catch (e) {
                console.error("Colophon: Failed to parse legacy data block", e);
            }
        }
    }

    return { markdown, data, frontmatter };
}

/**
 * Serializes the Markdown body, Metadata, and Frontmatter into a single string.
 * This does NOT generate the hash; the caller (Adapter/Bridge) should provide the complete metadata object.
 * 
 * @param {string} markdown 
 * @param {object} data - The metadata object (including syncHash, richData, etc.)
 * @param {string} frontmatter
 * @returns {string}
 */
function serializeFile(markdown, data, frontmatter = '') {
    let content = frontmatter + markdown;

    if (data) {
        // Ensure consistent key order or formatting?
        const json = JSON.stringify(data, null, 2);
        content = `${content.trimEnd()}\n\n%% colophon:meta ${json} %%`;
    }

    return content;
}

module.exports = {
    parseFile,
    serializeFile
};
