
/**
 * Parses the file content into Markdown body and Sidecar data.
 * The sidecar is expected to be in a comment block at the end of the file:
 * %% colophon:data { ... } %%
 * 
 * @param {string} content 
 * @returns {{ markdown: string, data: object|null }}
 */
function parseFile(content) {
    const sidecarRegex = /%% colophon:data\s*(\{[\s\S]*?\})\s*%%$/;
    const match = content.match(sidecarRegex);

    if (match) {
        try {
            const data = JSON.parse(match[1]);
            // Remove the sidecar from the markdown content
            const markdown = content.replace(sidecarRegex, '').trimEnd();
            return { markdown, data };
        } catch (e) {
            console.error("Colophon: Failed to parse sidecar data", e);
            // If parsing fails, return content as is and null data
            return { markdown: content, data: null };
        }
    }

    return { markdown: content, data: null };
}

/**
 * Serializes the Markdown body and Sidecar data into a single string.
 * 
 * @param {string} markdown 
 * @param {object} data 
 * @returns {string}
 */
function serializeFile(markdown, data) {
    if (!data) {
        return markdown;
    }

    const json = JSON.stringify(data, null, 2);
    return `${markdown.trimEnd()}\n\n%% colophon:data ${json} %%`;
}

module.exports = {
    parseFile,
    serializeFile
};
