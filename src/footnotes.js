import { EditorView } from "@codemirror/view";
import { Transaction, EditorState, StateField, StateEffect } from "@codemirror/state";
import { ChangeSet } from "@codemirror/state";


const SIDECAR_REGEX = /^%%colophon:data\n([\s\S]*?)\n%%$/m;
// Regex to detect a potential footnote reference being typed, e.g., `[^` or `[^1]`
const FOOTNOTE_INSERTION_REGEX = /\[\^(\w*?)\]/g;
// Regex to find existing footnote references in the document, capturing the ID
const FOOTNOTE_REFERENCE_REGEX = /\[\^([a-zA-Z0-9-]+?)\]/g;
// Regex to find existing footnote definition blocks at the end of the document
const FOOTNOTE_DEFINITION_BLOCK_REGEX = /\n+(?:\[\^([a-zA-Z0-9-]+?)\]: .*?\n*)+$/;


/**
 * Extracts the Colophon sidecar data from the document.
 * @param {EditorState} state - The editor state.
 * @returns {object | null} - The parsed JSON data or null if not found.
 */
export function getSidecarData(state) {
    const doc = state.doc.toString();
    const match = doc.match(SIDECAR_REGEX);

    if (match && match[1]) {
        try {
            return JSON.parse(match[1]);
        } catch (e) {
            console.error("Colophon: Error parsing sidecar JSON:", e);
            return null;
        }
    }
    return null;
}

/**
 * Updates or creates the Colophon sidecar data block.
 * @param {EditorView} view - The editor view.
 * @param {object} data - The data to write.
 */
export function setSidecarData(view, data) {
    const currentDoc = view.state.doc.toString();
    const serializedData = JSON.stringify(data, null, 2);
    const newSidecarBlock = `%%colophon:data\n${serializedData}\n%%`;

    const match = currentDoc.match(SIDECAR_REGEX);
    let transaction;

    if (match) {
        // Replace existing block
        const start = match.index;
        const end = match.index + match[0].length;
        transaction = view.state.update({
            changes: { from: start, to: end, insert: newSidecarBlock }
        });
    } else {
        // Append new block to the end
        transaction = view.state.update({
            changes: { from: currentDoc.length, insert: `\n\n${newSidecarBlock}` }
        });
    }

    if (transaction) {
        view.dispatch(transaction);
    }
}

/**
 * Generates a unique ID for a footnote.
 * @returns {string} Unique ID.
 */
function generateFootnoteId() {
    return `fn-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
}

// StateField to store the EditorView instance
export const editorViewField = StateField.define({
    create: (state) => null, // Initial value
    update: (value, tr) => {
        for (let effect of tr.effects) {
            if (effect.is(setEditorView)) {
                return effect.value;
            }
        }
        return value;
    }
});

// A StateEffect to allow setting the EditorView
export const setEditorView = StateEffect.define();

// A StateEffect to signal that sidecar data needs to be updated
export const updateSidecarEffect = StateEffect.define();

/**
 * The main plugin responsible for re-numbering and re-rendering footnotes.
 */
export const footnotePlugin = EditorView.updateListener.of((update) => {
    // Listen for updateSidecarEffect
    for (let effect of update.transactions.flatMap(tr => tr.effects)) {
        if (effect.is(updateSidecarEffect)) {
            const view = update.view.state.field(editorViewField);
            if (view) {
                setSidecarData(view, effect.value);
            }
        }
    }

    if (update.docChanged) {
        const view = update.view;
        const state = update.state;
        const doc = state.doc.toString();
        const currentSidecar = getSidecarData(state);
        const footnotesInSidecar = currentSidecar?.footnotes || [];

        const changes = [];
        const footnoteReferencesInDoc = [];
        
        // Find all footnote references in the document
        let match;
        while ((match = FOOTNOTE_REFERENCE_REGEX.exec(doc)) !== null) {
            footnoteReferencesInDoc.push({
                id: match[1],
                from: match.index,
                to: match.index + match[0].length,
                originalText: match[0]
            });
        }

        // Create a map from ID to footnote content for easy lookup
        const footnoteMap = new Map();
        footnotesInSidecar.forEach(fn => footnoteMap.set(fn.id, fn));

        // Determine the new numbering and collect changes for in-text references
        const usedFootnoteIds = new Set();
        const newFootnoteDefinitions = []; // Ordered list of { number, content }
        let footnoteNumber = 1;

        for (const ref of footnoteReferencesInDoc) {
            if (!usedFootnoteIds.has(ref.id)) {
                usedFootnoteIds.add(ref.id);
                const fn = footnoteMap.get(ref.id);
                if (fn) {
                    // Update in-text reference to new number
                    const newRefText = `[^${footnoteNumber}]`;
                    if (ref.originalText !== newRefText) {
                        changes.push({ from: ref.from, to: ref.to, insert: newRefText });
                    }
                    newFootnoteDefinitions.push({ number: footnoteNumber, content: fn.content });
                    footnoteNumber++;
                } else {
                    // This is a reference to a non-existent footnote, consider removing or flagging
                    // For now, we'll just ignore it in the numbering and leave it as is in text
                    console.warn(`Colophon: Footnote reference [^${ref.id}] found in document but not in sidecar data.`);
                }
            }
        }

        // Construct the new footnote definition block
        let newDefinitionBlock = '';
        if (newFootnoteDefinitions.length > 0) {
            newDefinitionBlock += '\n\n'; // Add some space before the definitions
            newFootnoteDefinitions.forEach(fn => {
                newDefinitionBlock += `[^${fn.number}]: ${fn.content}\n`;
            });
        }
        
        // Find and remove/replace the old footnote definition block
        const oldDefinitionBlockMatch = doc.match(FOOTNOTE_DEFINITION_BLOCK_REGEX);
        if (oldDefinitionBlockMatch) {
            changes.push({
                from: oldDefinitionBlockMatch.index,
                to: oldDefinitionBlockMatch.index + oldDefinitionBlockMatch[0].length,
                insert: '' // Remove old block
            });
        }

        // Add the new definition block at the end of the document
        if (newDefinitionBlock) {
            changes.push({ from: doc.length, insert: newDefinitionBlock });
        }

        // Dispatch changes if any
        if (changes.length > 0) {
            const tr = state.update({ changes: ChangeSet.of(changes, state.doc.length) });
            view.dispatch(tr);
        }
    }
});

/**
 * A transaction filter to intercept and manage footnote creation.
 */
export const footnoteTransactionFilter = EditorState.transactionFilter.of((tr) => {
    if (!tr.docChanged) return tr;

    let collectedDocChanges = [];
    let sidecarUpdate = null;

    tr.changes.iterChanges((fromA, toA, fromB, toB, insertedText) => {
        // Check if the inserted text looks like a new footnote reference, e.g. `[^]`
        if (insertedText.match(/\[\^\]$/) || insertedText.match(/\[\^(\w+)\]$/)) {
            const currentSidecar = getSidecarData(tr.startState);
            const footnotes = currentSidecar?.footnotes || [];

            const newId = generateFootnoteId();
            const newFootnote = { id: newId, content: '' }; // Initial empty footnote

            footnotes.push(newFootnote);
            sidecarUpdate = { ...currentSidecar, footnotes: footnotes };

            // Replace the original `[^]` or `[^existing_id]` with our new generated ID
            const textToInsert = `[^${newId}]`;
            
            collectedDocChanges.push({ from: fromB, to: toB, insert: textToInsert });
        }
    });

    if (collectedDocChanges.length > 0) {
        let newTr = tr.startState.update(tr); // Start with a copy of the original transaction
        
        // Apply the collected changes to the document
        newTr = newTr.update({ changes: ChangeSet.of(collectedDocChanges, newTr.startState.doc.length) });

        // Add the effect to update sidecar data if needed
        if (sidecarUpdate) {
            newTr = newTr.update({ effects: updateSidecarEffect.of(sidecarUpdate) });
        }
        
        return newTr;
    }
    return tr;
});
