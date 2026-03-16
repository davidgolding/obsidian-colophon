import { Mark, mergeAttributes } from '@tiptap/core';

export const CommentHighlight = Mark.create({
    name: 'commentHighlight',

    addAttributes() {
        return {
            threadId: {
                default: null,
                parseHTML: element => element.getAttribute('data-comment-thread-id'),
                renderHTML: attributes => {
                    if (!attributes.threadId) {
                        return {};
                    }

                    return {
                        'data-comment-thread-id': attributes.threadId,
                    };
                },
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'span[data-comment-thread-id]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(HTMLAttributes, { class: 'colophon-comment-highlight' }), 0];
    },

    addCommands() {
        return {
            setComment: (threadId) => ({ commands }) => {
                return commands.setMark(this.name, { threadId });
            },
            unsetComment: () => ({ commands }) => {
                return commands.unsetMark(this.name);
            },
        };
    },
});
