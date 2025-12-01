const { Mark, mergeAttributes } = require('@tiptap/core');

const CommentMark = Mark.create({
    name: 'comment',

    keepOnSplit: false,

    addAttributes() {
        return {
            id: {
                default: null,
                parseHTML: element => element.getAttribute('data-comment-id'),
                renderHTML: attributes => {
                    return {
                        'data-comment-id': attributes.id,
                    }
                },
            },
            class: {
                default: 'colophon-comment-highlight',
                renderHTML: attributes => {
                    return {
                        class: attributes.class,
                    }
                }
            }
        }
    },

    parseHTML() {
        return [
            {
                tag: 'span[data-comment-id]',
            },
        ]
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(HTMLAttributes), 0]
    },

    addCommands() {
        return {
            setComment: (id) => ({ commands }) => {
                return commands.setMark(this.name, { id });
            },
            unsetComment: (id) => ({ commands }) => {
                // If ID is provided, only unset if it matches? 
                // Standard unsetMark removes the mark from selection.
                return commands.unsetMark(this.name);
            },
        }
    },
});

module.exports = CommentMark;
