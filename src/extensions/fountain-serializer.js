import { Extension } from '@tiptap/core';
import { Notice } from 'obsidian';

const electron = window.electron;
const fs = require('fs').promises;

export const FountainSerializer = Extension.create({
    name: 'fountainSerializer',

    addCommands() {
        return {
            exportToFountain: () => async ({ editor }) => {
                try {
                    new Notice('Preparing Fountain export...');

                    const fountainString = processDocument(editor.state.doc);

                    const activeView = editor.options.adapter?.view;
                    const fileName = (activeView?.file?.basename || 'Untitled') + '.fountain';
                    
                    if (!electron) {
                        new Notice('Desktop required for direct file dialog output.');
                        return false;
                    }

                    const result = await electron.remote.dialog.showSaveDialog({
                        title: 'Export to Fountain (.fountain)',
                        defaultPath: fileName,
                        filters: [{ name: 'Fountain Document', extensions: ['fountain'] }]
                    });

                    if (result.canceled || !result.filePath) {
                        new Notice('Export cancelled.');
                        return true;
                    }

                    await fs.writeFile(result.filePath, fountainString);
                    new Notice('Fountain file saved successfully!');

                    return true;
                } catch (error) {
                    console.error('Fountain Export Error:', error);
                    new Notice(`Export failed: ${error.message}`);
                    return false;
                }
            }
        };
    }
});

function processDocument(doc) {
    let fountainOutput = "";

    doc.descendants((node, pos) => {
        if (node.isText) return false;

        const isBlock = node.isBlock && node.type.name !== 'doc';
        if (isBlock) {
            let blockText = "";
            node.content.forEach((child) => {
                if (child.isText) {
                    let text = child.text || '';
                    if (child.marks) {
                        const isBold = child.marks.some(m => m.type.name === 'bold');
                        const isItalic = child.marks.some(m => m.type.name === 'italic');
                        const isUnderline = child.marks.some(m => m.type.name === 'underline');
                        
                        if (isBold) text = `**${text}**`;
                        if (isItalic) text = `*${text}*`;
                        if (isUnderline) text = `_${text}_`;
                    }
                    blockText += text;
                }
            });

            const type = node.type.name;

            if (type === 'script-scene') {
                blockText = blockText.toUpperCase();
                const standardPrefixes = ['INT.', 'EXT.', 'INT/', 'I/E', 'EST.'];
                const hasStandardPrefix = standardPrefixes.some(p => blockText.startsWith(p));
                if (!hasStandardPrefix) {
                    blockText = '.' + blockText;
                }
                fountainOutput += blockText + "\n\n";

            } else if (type === 'script-action' || type === 'body') {
                fountainOutput += blockText + "\n\n";

            } else if (type === 'script-character') {
                blockText = blockText.toUpperCase();
                // Ensure no accidental conflict with standard action via forced character symbol
                if (!blockText.startsWith('@')) {
                    blockText = '@' + blockText;
                }
                fountainOutput += blockText + "\n";

            } else if (type === 'script-parenthetical') {
                if (!blockText.startsWith('(')) blockText = '(' + blockText;
                if (!blockText.endsWith(')')) blockText = blockText + ')';
                fountainOutput += blockText + "\n";

            } else if (type === 'script-dialogue') {
                fountainOutput += blockText + "\n\n";

            } else if (type === 'script-transition') {
                blockText = blockText.toUpperCase();
                if (!blockText.startsWith('>')) {
                    blockText = '> ' + blockText;
                }
                fountainOutput += blockText + "\n\n";
            } else {
                if (blockText.trim().length > 0) {
                    fountainOutput += blockText + "\n\n";
                }
            }

            return false;
        }
        return true;
    });

    return fountainOutput.trim();
}
