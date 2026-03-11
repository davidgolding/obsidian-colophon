import { Mark, mergeAttributes } from '@tiptap/core';

export const SmallCaps = Mark.create({
    name: 'smallCaps',

    parseHTML() {
        return [
            {
                tag: 'span',
                getAttrs: (element) => element.classList.contains('colophon-small-caps') && null,
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(HTMLAttributes, { class: 'colophon-small-caps' }), 0];
    },

    addCommands() {
        return {
            toggleSmallCaps: () => ({ commands }) => {
                return commands.toggleMark(this.name);
            },
        };
    },

    addKeyboardShortcuts() {
        return {
            'Mod-Shift-k': () => this.editor.commands.toggleSmallCaps(),
        };
    },
});
