import { Node, mergeAttributes, textblockTypeInputRule } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';

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
            return [
                {
                    tag: 'p',
                    getAttrs: node => node.classList.contains(`colophon-block-${blockId}`) && null,
                },
                {
                    tag: `div[class="colophon-block-${blockId}"]`,
                }
            ];
        },

        renderHTML({ HTMLAttributes }) {
            return ['p', mergeAttributes(HTMLAttributes, { class: `colophon-block-${blockId}` }), 0];
        },

        // Keyboard Shortcuts (Enter key logic)
        addKeyboardShortcuts() {
            return {
                'Enter': () => {
                    // Logic: If "following-entity" (or "following-block") is defined, switch to that block type on Enter
                    const nextBlockName = definition['following-entity'] || definition['following-block'];

                    if (nextBlockName) {
                        return this.editor.chain()
                            .splitBlock()
                            .setNode(nextBlockName)
                            .run();
                    }
                    // Default behavior (keep same block type usually, or split)
                    return false;
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
