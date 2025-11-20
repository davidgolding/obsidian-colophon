
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

    // 2. Extract Sidecar
    const sidecarRegex = /%% colophon:data\s*(\{[\s\S]*?\})\s*%%$/;
    const scMatch = markdown.match(sidecarRegex);

    if (scMatch) {
        try {
            data = JSON.parse(scMatch[1]);
            // Remove the sidecar from the markdown content
            markdown = markdown.replace(sidecarRegex, '').trimEnd();
        } catch (e) {
            console.error("Colophon: Failed to parse sidecar data", e);
        }
    }

    return { markdown, data, frontmatter };
}

/**
 * Serializes the Markdown body, Sidecar data, and Frontmatter into a single string.
 * 
 * @param {string} markdown 
 * @param {object} data 
 * @param {string} frontmatter
 * @returns {string}
 */
function serializeFile(markdown, data, frontmatter = '') {
    let content = frontmatter + markdown;

    if (data) {
        const json = JSON.stringify(data, null, 2);
        content = `${content.trimEnd()}\n\n%% colophon:data ${json} %%`;
    }

    return content;
}

module.exports = {
    parseFile,
    serializeFile
};
