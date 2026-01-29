import { Node, mergeAttributes, textblockTypeInputRule } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';

// Helper to determine semantic tag
function getTagForBlock(blockId) {
    if (blockId.startsWith('heading-')) {
        const level = blockId.split('-')[1];
        if (level && !isNaN(level)) {
            return `h${level}`;
        }
    }
    return 'p';
}

// Helper to create a specific node extension for a given block definition
function createBlockExtension(blockId, definition, allSettings) {
    return Node.create({
        name: blockId, // e.g., 'title', 'body'
        group: 'block',
        content: 'inline*', // Text content

        // Block-level properties
        draggable: false,

        // Define how it renders to HTML
        parseHTML() {
            const tag = getTagForBlock(blockId);
            return [
                {
                    tag: tag,
                    getAttrs: node => node.classList.contains(blockId) && null,
                }
            ];
        },

        renderHTML({ HTMLAttributes }) {
            const tag = getTagForBlock(blockId);
            return [tag, mergeAttributes(HTMLAttributes, { class: blockId }), 0];
        },

        // Keyboard Shortcuts (Enter key logic)
        addKeyboardShortcuts() {
            return {
                'Enter': () => {
                    // Logic: If "following-entity" (or "following-block") is defined, switch to that block type on Enter
                    const nextBlockName = definition['following-entity'] || definition['following-block'];

                    if (nextBlockName) {
                        return this.editor.chain()
                            .splitBlock({ keepMarks: false })
                            .setNode(nextBlockName)
                            .run();
                    }

                    // Explicitly split block for default case to prevent fall-through
                    return this.editor.commands.splitBlock({ keepMarks: false });
                },
            };
        },

        addInputRules() {
            if (definition['syntax-trigger']) {
                // Escape regex special characters
                const escapedTrigger = definition['syntax-trigger'].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                return [
                    textblockTypeInputRule({
                        find: new RegExp(`^${escapedTrigger}$`),
                        type: this.type,
                    }),
                ];
            }
            return [];
        }
    });
}

// Main generator function
export function generateExtensions(settings) {
    if (!settings || !settings.blocks) return [];

    const extensions = [];

    // Create an extension for each block definition
    for (const [id, def] of Object.entries(settings.blocks)) {
        extensions.push(createBlockExtension(id, def, settings));
    }

    return extensions;
}
