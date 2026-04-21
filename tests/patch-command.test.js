import { describe, it, expect, vi } from 'vitest';

class MockPlugin {
    constructor() {
        this.app = {
            commands: {
                commands: {}
            },
            workspace: {
                activeEditor: {
                    editor: {},
                    file: {}
                },
                getActiveViewOfType: vi.fn(),
                getLeavesOfType: vi.fn().mockReturnValue([])
            }
        };
    }

    patchCommand(commandId, handler) {
        const command = this.app.commands.commands[commandId];
        if (!command) return;

        const originalCallback = command.callback;
        const originalCheckCallback = command.checkCallback;
        const originalEditorCallback = command.editorCallback;
        const originalEditorCheckCallback = command.editorCheckCallback;

        const checkColophon = (checking) => {
            // Simplified for test - Force fallback to simulate acting on a Markdown file
            return false;
        };

        command.checkCallback = (checking) => {
            if (checkColophon(checking)) return true;

            if (originalCheckCallback) {
                return originalCheckCallback.call(command, checking);
            }
            if (originalCallback) {
                if (!checking) originalCallback.call(command);
                return true;
            }

            if (originalEditorCallback || originalEditorCheckCallback) {
                const activeEditorInfo = this.app.workspace.activeEditor;
                if (!activeEditorInfo || !activeEditorInfo.editor) {
                    return false;
                }

                const mdEditor = activeEditorInfo.editor;
                const mdView = this.app.workspace.getLeavesOfType('markdown').find(leaf => leaf.isActive() || (activeEditorInfo.file && leaf.view?.file === activeEditorInfo.file))?.view || activeEditorInfo;

                if (originalEditorCheckCallback) {
                    return originalEditorCheckCallback.call(command, checking, mdEditor, mdView);
                }
                if (originalEditorCallback) {
                    if (!checking) originalEditorCallback.call(command, mdEditor, mdView);
                    return true;
                }
            }

            return false;
        };

        if (command.callback) command.callback = null;
    }
}

describe('patchCommand context binding', () => {
    it('should preserve the `this` context for native commands with checkCallback', () => {
        const plugin = new MockPlugin();
        let capturedContext = null;
        
        plugin.app.commands.commands['test:command'] = {
            id: 'test:command',
            checkCallback: function(checking) {
                capturedContext = this;
                return true;
            }
        };

        const command = plugin.app.commands.commands['test:command'];
        plugin.patchCommand('test:command', () => {});
        
        // Execute the patched command
        command.checkCallback(false);
        
        // The captured context must be exactly the command object, not undefined
        expect(capturedContext).toBe(command);
    });

    it('should preserve the `this` context for native commands with callback', () => {
        const plugin = new MockPlugin();
        let capturedContext = null;
        
        plugin.app.commands.commands['test:command'] = {
            id: 'test:command',
            callback: function() {
                capturedContext = this;
            }
        };

        const command = plugin.app.commands.commands['test:command'];
        plugin.patchCommand('test:command', () => {});
        
        // Execute the patched command (callback is mapped to checkCallback for uniformity)
        command.checkCallback(false);
        
        expect(capturedContext).toBe(command);
    });

    it('should preserve the `this` context for native commands with editorCheckCallback', () => {
        const plugin = new MockPlugin();
        let capturedContext = null;
        
        plugin.app.commands.commands['test:editor-command'] = {
            id: 'test:editor-command',
            editorCheckCallback: function(checking, editor, view) {
                capturedContext = this;
                return true;
            }
        };

        const command = plugin.app.commands.commands['test:editor-command'];
        plugin.patchCommand('test:editor-command', () => {});
        
        command.checkCallback(false);
        
        expect(capturedContext).toBe(command);
    });

    it('should preserve the `this` context for native commands with editorCallback', () => {
        const plugin = new MockPlugin();
        let capturedContext = null;
        
        plugin.app.commands.commands['test:editor-command'] = {
            id: 'test:editor-command',
            editorCallback: function(editor, view) {
                capturedContext = this;
                return true;
            }
        };

        const command = plugin.app.commands.commands['test:editor-command'];
        plugin.patchCommand('test:editor-command', () => {});
        
        command.checkCallback(false);
        
        expect(capturedContext).toBe(command);
    });
});
