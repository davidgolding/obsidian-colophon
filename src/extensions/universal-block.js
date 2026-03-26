import { Node, mergeAttributes, textblockTypeInputRule, Extension } from '@tiptap/core';

// Helper to generate a random 6-character string for block IDs
function generateBlockId() {
    return Math.random().toString(36).substring(2, 8);
}

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

/**
 * A central extension to handle Enter key behavior across all universal blocks.
 * This prevents multiple extensions from fighting over the same shortcut.
 */
const UniversalBlockEnter = Extension.create({
    name: 'universalBlockEnter',

    addOptions() {
        return {
            blocks: {},
        }
    },

    addKeyboardShortcuts() {
        return {
            'Enter': ({ editor }) => {
                const { state } = editor;
                const { selection } = state;
                const { $from, empty } = selection;

                if (!empty) return false;

                const blockId = $from.parent.type.name;
                const definition = this.options.blocks[blockId];

                if (!definition) return false;

                const isAtEnd = $from.parentOffset === $from.parent.content.size;
                const nextBlockName = (definition['following-entity'] || definition['following-block'])?.toLowerCase();

                // If we are at the end and a following block is defined, 
                // we want to split and then set the new type.
                if (isAtEnd && nextBlockName && state.schema.nodes[nextBlockName]) {
                    const nodeType = state.schema.nodes[nextBlockName];
                    return editor.chain()
                        .command(({ tr, dispatch }) => {
                            if (dispatch) {
                                // Split the block and set the type of the second part in one go
                                // pos: split position
                                // depth: depth of split (1 for top level blocks)
                                // typesAfter: the node type for the new block
                                tr.split($from.pos, 1, [{ type: nodeType }]);
                            }
                            return true;
                        })
                        .scrollIntoView()
                        .run();
                }

                return false; // Fall through to default Tiptap behavior
            },
        };
    },
});

// Helper to create a specific node extension for a given block definition
function createBlockExtension(blockId, definition) {
    return Node.create({
        name: blockId, // e.g., 'title', 'body'
        group: 'block',
        content: 'inline*', // Text content

        // Block-level properties
        draggable: false,

        // Attributes (metadata)
        addAttributes() {
            return {
                id: {
                    default: null,
                    keepOnSplit: false,
                    parseHTML: element => element.getAttribute('data-block-id'),
                    renderHTML: attributes => {
                        if (!attributes.id) {
                            attributes.id = generateBlockId();
                        }
                        return {
                            'data-block-id': attributes.id,
                        };
                    },
                },
            };
        },

        // Define how it renders to HTML
        parseHTML() {
            const tag = getTagForBlock(blockId);
            return [
                {
                    tag: tag,
                    getAttrs: node => node.classList.contains(blockId) && { id: node.getAttribute('data-block-id') },
                }
            ];
        },

        renderHTML({ HTMLAttributes }) {
            const tag = getTagForBlock(blockId);
            // Ensure ID is generated during initial render if not present
            if (!HTMLAttributes['data-block-id']) {
                HTMLAttributes['data-block-id'] = generateBlockId();
            }
            return [tag, mergeAttributes(HTMLAttributes, { class: blockId }), 0];
        },

        addInputRules() {
            if (definition['syntax-trigger']) {
                // Escape regex special characters
                const escapedTrigger = definition['syntax-trigger'].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                return [
                    textblockTypeInputRule({
                        find: new RegExp(`^${escapedTrigger} $`),
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

    // 1. Add the central Enter handler
    extensions.push(UniversalBlockEnter.configure({
        blocks: settings.blocks,
    }));

    // 2. Create an extension for each block definition
    for (const [id, def] of Object.entries(settings.blocks)) {
        extensions.push(createBlockExtension(id, def));
    }

    return extensions;
}
