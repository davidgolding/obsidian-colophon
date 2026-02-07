import { Extension } from '@tiptap/core';

/**
 * Helper function for handling the scroll logic.
 * Exported so the adapter can trigger it immediately on settings change.
 */
export const scrollActiveLineIntoView = (editor, options, behavior = 'smooth') => {
    if (!editor || editor.isDestroyed) return;

    const { view } = editor;
    const { selection } = view.state;

    try {
        const cursorCoords = view.coordsAtPos(selection.$head.pos);
        const scrollContainer = view.dom.closest('.colophon-scroll-container');

        if (!scrollContainer) return;

        const containerRect = scrollContainer.getBoundingClientRect();

        if (options.enabled) {
            // Typewriter Mode: Fixed position relative to bottom
            // feedPadding is % from bottom. 
            // 0% = bottom, 50% = middle, 100% = top. 
            // User uses 0-75 range where 75 is top quarter.
            const paddingPercent = options.padding ?? 40;

            const ratioFromTop = 1 - (paddingPercent / 100);
            const targetOffset = containerRect.height * ratioFromTop;

            const targetViewportY = containerRect.top + targetOffset;
            const currentCursorY = cursorCoords.bottom; // align bottom of cursor to target line
            const delta = currentCursorY - targetViewportY;

            if (Math.abs(delta) > 1) {
                scrollContainer.scrollBy({
                    top: delta,
                    behavior: behavior
                });
            }
        } else {
            // Standard Behavior: Ensure cursor is in view
            const margin = 20;

            if (cursorCoords.top < containerRect.top + margin) {
                const delta = cursorCoords.top - (containerRect.top + margin);
                scrollContainer.scrollBy({ top: delta, behavior: 'auto' });
            }
            else if (cursorCoords.bottom > containerRect.bottom - margin) {
                const delta = cursorCoords.bottom - (containerRect.bottom - margin);
                scrollContainer.scrollBy({ top: delta, behavior: 'auto' });
            }
        }
    } catch (e) {
        // view might not be ready or coords calculation failed
    }
};

export const FixedFeed = Extension.create({
    name: 'fixedFeed',

    addOptions() {
        return {
            enabled: false,
            padding: 40,
        };
    },

    onCreate() {
        this.storage.lastPos = null;
    },

    addStorage() {
        return {
            lastPos: null,
        };
    },

    // Handle focus to trigger initial jump if enabled
    onFocus() {
        requestAnimationFrame(() => {
            scrollActiveLineIntoView(this.editor, this.options, 'smooth');
        });
    },

    // onTransaction handles both content changes and selection changes
    onTransaction({ transaction }) {
        if (!transaction.docChanged && !transaction.selectionSet) return;

        requestAnimationFrame(() => {
            // Use 'auto' behavior for typing to keep it snappy and locked
            const behavior = transaction.docChanged ? 'auto' : 'smooth';
            scrollActiveLineIntoView(this.editor, this.options, behavior);
        });
    },
});
