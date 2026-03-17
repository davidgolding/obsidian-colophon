import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

/**
 * TrailingNode extension
 * Ensures that there is always a specific node (default: 'body') at the end of the document.
 * This prevents scenarios where the only node is an atom node (like horizontalRule),
 * which would leave the user with no place to put the cursor.
 */
export const TrailingNode = Extension.create({
    name: 'trailingNode',

    addOptions() {
        return {
            node: 'body',
            notAfter: [
                'body',
                'supertitle',
                'title',
                'subtitle',
                'epigraph',
                'body-first',
                'heading-1',
                'heading-2',
                'heading-3',
                'heading-4',
            ],
        };
    },

    addProseMirrorPlugins() {
        const plugin = new PluginKey(this.name);
        const disabledNodes = Object.entries(this.editor.schema.nodes)
            .map(([, value]) => value)
            .filter(node => this.options.notAfter.includes(node.name));

        return [
            new Plugin({
                key: plugin,
                appendTransaction: (transactions, oldState, newState) => {
                    const { doc, tr, schema } = newState;
                    const lastNode = doc.lastChild;

                    // If doc is empty (shouldn't happen with our schema but safety first)
                    // or the last node is not one of our allowed textblock types
                    if (!lastNode || !disabledNodes.includes(lastNode.type)) {
                        const type = schema.nodes[this.options.node];
                        if (!type) return null;

                        // Append the trailing node
                        return tr.insert(doc.content.size, type.create());
                    }

                    return null;
                },
            }),
        ];
    },
});
