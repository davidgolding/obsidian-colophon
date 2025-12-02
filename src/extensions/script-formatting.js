const { Extension, InputRule } = require('@tiptap/core');
const { Plugin, PluginKey } = require('@tiptap/pm/state');

// Script Element Classes
const SCENE_HEADING = 'script-scene';
const ACTION = 'script-action';
const CHARACTER = 'script-character';
const DIALOGUE = 'script-dialogue';
const PARENTHETICAL = 'script-parenthetical';
const TRANSITION = 'script-transition';

// Helper to set class on current node
const setClass = (editor, className) => {
    return editor.chain().focus().updateAttributes('paragraph', { class: className }).run();
};

const ScriptFormatting = Extension.create({
    name: 'scriptFormatting',

    addOptions() {
        return {
            types: {
                scene: SCENE_HEADING,
                action: ACTION,
                character: CHARACTER,
                dialogue: DIALOGUE,
                parenthetical: PARENTHETICAL,
                transition: TRANSITION,
            },
        };
    },

    addInputRules() {
        return [
            // Scene Heading: INT., EXT., I/E, INT/EXT
            new InputRule({
                find: /^(?:INT\.|EXT\.|I\/E|INT\/EXT)\s$/i,
                handler: ({ state, range, match }) => {
                    const { tr } = state;
                    const start = range.from;
                    const end = range.to;

                    tr.setNodeMarkup(range.from - 1, null, { class: this.options.types.scene });
                    // We don't delete the text, just format the node.
                    // Actually InputRule deletes the match by default if we don't handle it?
                    // No, handler overrides default behavior.
                    // We want to keep the text "INT. " but uppercase it?
                    // Let's just set the class. The user typed "INT. ".
                    // We might want to uppercase it.

                    // Simple version: just set class.
                    // But InputRule usually replaces text.
                    // Let's use textInputRule or just a regex that matches the start.
                    // If we return null, nothing happens?
                    // We need to execute the transaction.

                    // Let's try to uppercase the match?
                    const text = match[0].toUpperCase();
                    tr.insertText(text, start, end);
                    tr.setNodeMarkup(start - 1, null, { class: this.options.types.scene });
                },
            }),
            // Transition: TO: at end of line? InputRule is for typing.
            // Maybe we need a paste rule or transaction watcher for TO:?
            // For now, let's stick to Scene Headings via InputRule.
        ];
    },

    addKeyboardShortcuts() {
        return {
            'Tab': () => {
                const { state, dispatch } = this.editor.view;
                const { selection } = state;
                const { $from } = selection;
                const node = $from.parent;

                if (node.type.name !== 'paragraph') return false;

                const currentClass = node.attrs.class || this.options.types.action;

                // Logic Flow
                if (currentClass === this.options.types.action) {
                    // Action -> Character (if empty or at start?)
                    // Standard screenplay: Tab in Action moves to Character.
                    if (dispatch) {
                        this.editor.commands.updateAttributes('paragraph', { class: this.options.types.character });
                    }
                    return true;
                } else if (currentClass === this.options.types.character) {
                    // Character -> Transition (or back to Action?)
                    // Usually Character -> Transition isn't standard Tab.
                    // But let's say Tab toggles Character <-> Transition?
                    if (dispatch) {
                        this.editor.commands.updateAttributes('paragraph', { class: this.options.types.transition });
                    }
                    return true;
                } else if (currentClass === this.options.types.transition) {
                    // Transition -> Action
                    if (dispatch) {
                        this.editor.commands.updateAttributes('paragraph', { class: this.options.types.action });
                    }
                    return true;
                } else if (currentClass === this.options.types.dialogue) {
                    // Dialogue -> Parenthetical
                    if (dispatch) {
                        this.editor.commands.updateAttributes('paragraph', { class: this.options.types.parenthetical });
                    }
                    return true;
                } else if (currentClass === this.options.types.parenthetical) {
                    // Parenthetical -> Dialogue
                    if (dispatch) {
                        this.editor.commands.updateAttributes('paragraph', { class: this.options.types.dialogue });
                    }
                    return true;
                }

                return false;
            },
            'Enter': () => {
                const { state, dispatch } = this.editor.view;
                const { selection } = state;
                const { $from, empty } = selection;
                const node = $from.parent;

                if (node.type.name !== 'paragraph') return false;

                // If not at end of line, standard split behavior (but we need to determine next node class)
                // But Enter usually creates a new block.

                const currentClass = node.attrs.class || this.options.types.action;
                let nextClass = this.options.types.action;

                // Logic Flow for NEXT block
                if (currentClass === this.options.types.scene) {
                    nextClass = this.options.types.action;
                } else if (currentClass === this.options.types.action) {
                    nextClass = this.options.types.action;
                } else if (currentClass === this.options.types.character) {
                    nextClass = this.options.types.dialogue;
                } else if (currentClass === this.options.types.parenthetical) {
                    nextClass = this.options.types.dialogue;
                } else if (currentClass === this.options.types.dialogue) {
                    // Dialogue -> Character (standard)
                    // BUT if double enter (empty line), maybe Action?
                    // For now, default to Character.
                    // If user hits Enter on an empty Dialogue line, it should probably go to Action (or Character).
                    if (node.textContent.trim() === '') {
                        // Empty dialogue line -> Switch self to Action?
                        if (dispatch) {
                            this.editor.commands.updateAttributes('paragraph', { class: this.options.types.action });
                        }
                        return true;
                    }
                    nextClass = this.options.types.character; // Or Action?
                    // StudioBinder: Dialogue -> Character.
                    // Final Draft: Dialogue -> Character (or Action if configured).
                    // Let's go with Character for rapid dialogue.
                    // If they want Action, they can hit Enter again on the empty Character line?
                } else if (currentClass === this.options.types.transition) {
                    nextClass = this.options.types.scene;
                }

                // If at end of line, create new node with nextClass
                if (empty && $from.parentOffset === node.content.size) {
                    if (dispatch) {
                        // Split block and set class of new block
                        // We use splitBlock then updateAttributes?
                        // Or insertContent?
                        // splitBlock keeps attributes by default usually?
                        // We want to force the new block to have `nextClass`.

                        // Chain: splitBlock -> setNode('paragraph', { class: nextClass })
                        // But setNode affects current node? No, splitBlock moves cursor to new node.
                        this.editor.chain()
                            .splitBlock()
                            .updateAttributes('paragraph', { class: nextClass })
                            .run();
                    }
                    return true;
                }

                return false; // Default behavior (split block, keep attributes?)
            }
        };
    },

    // Add a plugin to handle auto-formatting on text changes (like "TO:" detection)
    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: new PluginKey('script-auto-format'),
                appendTransaction: (transactions, oldState, newState) => {
                    const tr = newState.tr;
                    let modified = false;

                    // Check for changes
                    if (!transactions.some(t => t.docChanged)) return null;

                    // Iterate over modified ranges? Or just check current block?
                    // Checking entire doc is expensive.
                    // Let's check the selection's parent block.
                    const { selection } = newState;
                    const { $from } = selection;
                    const node = $from.parent;

                    if (node.type.name !== 'paragraph') return null;

                    const text = node.textContent;
                    const currentClass = node.attrs.class;

                    // 1. Scene Heading Detection (Uppercase INT./EXT.)
                    // Regex: ^(INT\.|EXT\.|I\/E|INT\/EXT)
                    if (currentClass !== this.options.types.scene) {
                        if (/^(INT\.|EXT\.|I\/E|INT\/EXT)\s/i.test(text)) {
                            // Auto-switch to Scene Heading
                            // And uppercase the prefix?
                            tr.setNodeMarkup($from.before(), null, { class: this.options.types.scene });
                            modified = true;
                        }
                    }

                    // 2. Transition Detection (Ends with TO:)
                    if (currentClass !== this.options.types.transition) {
                        if (text.trim().endsWith('TO:') && text.trim() === text.trim().toUpperCase()) {
                            // Must be uppercase TO:
                            tr.setNodeMarkup($from.before(), null, { class: this.options.types.transition });
                            modified = true;
                        }
                    }

                    // 3. Parenthetical Detection (Starts with ( and ends with ))
                    // Only if context is Dialogue or Character?
                    // Usually Parenthetical follows Character.
                    if (currentClass === this.options.types.dialogue) {
                        if (/^\(.*\)$/.test(text.trim())) {
                            tr.setNodeMarkup($from.before(), null, { class: this.options.types.parenthetical });
                            modified = true;
                        }
                    }

                    return modified ? tr : null;
                }
            })
        ];
    }
});

module.exports = ScriptFormatting;
