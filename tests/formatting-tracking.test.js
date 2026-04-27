import { describe, it, expect, vi, beforeEach } from 'vitest';

// Manual global mocks for browser environment
global.window = {
    electron: {
        ipcRenderer: {}
    }
};
global.activeDocument = {
    activeElement: {
        closest: () => null
    }
};
global.document = {
    activeElement: null
};

// Mock Obsidian
vi.mock('obsidian', () => ({
    Plugin: class {
        constructor() {
            this.app = {};
        }
    },
    Notice: class {},
    TFile: class {},
    TFolder: class {},
    normalizePath: (path) => path,
    MarkdownView: class {},
    Modal: class { constructor() {} }
}));

// Mock Colophon modules to avoid deep dependency chain issues in tests
vi.mock('../src/view', () => ({
    ColophonView: class {},
    VIEW_TYPE_COLOPHON: 'colophon-manuscript'
}));
vi.mock('../src/sidebar-view', () => ({
    ColophonSidebarView: class {},
    VIEW_TYPE_COLOPHON_SIDEBAR: 'colophon-sidebar'
}));
vi.mock('../src/style-manager', () => ({
    StyleManager: class { applyStyles() {} }
}));
vi.mock('../src/settings-tab', () => ({
    ColophonSettingTab: class {}
}));
vi.mock('../src/metadata-manager', () => ({
    MetadataManager: class {}
}));
vi.mock('../src/sidebar-manager', () => ({
    SidebarManager: class { destroy() {} }
}));
vi.mock('../src/markdown-bridge', () => ({
    default: class { dehydrate() {}; hydrate() {} }
}));

import ColophonPlugin from '../src/main';

describe('Formatting Tracking', () => {
    let plugin;
    let mockApp;
    let mockEditor;

    beforeEach(() => {
        mockApp = {
            commands: {
                commands: {
                    'editor:toggle-bold': { id: 'editor:toggle-bold', checkCallback: vi.fn().mockReturnValue(false) },
                    'editor:toggle-italics': { id: 'editor:toggle-italics', checkCallback: vi.fn().mockReturnValue(false) },
                    'editor:toggle-strikethrough': { id: 'editor:toggle-strikethrough', checkCallback: vi.fn().mockReturnValue(false) },
                    'editor:toggle-highlight': { id: 'editor:toggle-highlight', checkCallback: vi.fn().mockReturnValue(false) }
                }
            },
            workspace: {
                on: vi.fn(),
                onLayoutReady: vi.fn()
            }
        };

        mockEditor = {
            chain: vi.fn().mockReturnThis(),
            focus: vi.fn().mockReturnThis(),
            toggleBold: vi.fn().mockReturnThis(),
            toggleItalic: vi.fn().mockReturnThis(),
            toggleStrike: vi.fn().mockReturnThis(),
            toggleUnderline: vi.fn().mockReturnThis(),
            run: vi.fn()
        };

        plugin = new ColophonPlugin();
        plugin.app = mockApp;
    });

    it('should track the active Tiptap editor', () => {
        expect(plugin.activeTiptapEditor).toBeNull();
        plugin.setActiveEditor(mockEditor);
        expect(plugin.activeTiptapEditor).toBe(mockEditor);
    });

    it('should intercept core formatting commands', () => {
        plugin.interceptCoreCommands();
        
        const boldCmd = mockApp.commands.commands['editor:toggle-bold'];
        expect(boldCmd.originalCheckCallback).toBeDefined();
        expect(typeof boldCmd.checkCallback).toBe('function');
    });

    it('should route intercepted commands to the active editor', () => {
        plugin.setActiveEditor(mockEditor);
        plugin.interceptCoreCommands();
        
        const boldCmd = mockApp.commands.commands['editor:toggle-bold'];
        // Execute the command (checking = false)
        const result = boldCmd.checkCallback(false);
        
        expect(result).toBe(true);
        expect(mockEditor.chain).toHaveBeenCalled();
        expect(mockEditor.focus).toHaveBeenCalled();
        expect(mockEditor.toggleBold).toHaveBeenCalled();
        expect(mockEditor.run).toHaveBeenCalled();
    });

    it('should fallback to original command when no active editor is present', () => {
        plugin.interceptCoreCommands();
        const boldCmd = mockApp.commands.commands['editor:toggle-bold'];
        
        // Execute the command (checking = false)
        const result = boldCmd.checkCallback(false);
        
        expect(result).toBe(false);
        expect(boldCmd.originalCheckCallback).toHaveBeenCalledWith(false);
    });

    it('should restore original commands on onunload', () => {
        plugin.interceptCoreCommands();
        const boldCmd = mockApp.commands.commands['editor:toggle-bold'];
        const original = boldCmd.originalCheckCallback;
        
        plugin.onunload();
        
        expect(boldCmd.checkCallback).toBe(original);
        expect(boldCmd.originalCheckCallback).toBeUndefined();
    });
});
