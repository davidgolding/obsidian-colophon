import { ItemView, WorkspaceLeaf } from 'obsidian';
import { ZAxisPanel } from './ui/z-axis-panel';

export const VIEW_TYPE_COLOPHON_SIDEBAR = 'colophon-sidebar';

export class ColophonSidebarView extends ItemView {
    constructor(leaf, plugin) {
        super(leaf);
        this.plugin = plugin;
        this.zAxisPanel = null;
        this.unsubscribe = null;
    }

    getViewType() {
        return VIEW_TYPE_COLOPHON_SIDEBAR;
    }

    getDisplayText() {
        return 'Colophon Sidebar';
    }

    getIcon() {
        return 'columns';
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('colophon-sidebar-view');
        contentEl.addClass('colophon-workspace');

        // The SidebarManager acts as the provider for the ZAxisPanel
        this.zAxisPanel = new ZAxisPanel(
            this.app, 
            this.plugin, 
            {
                getAdapter: () => this.plugin.sidebarManager.getAdapter(),
                updateActiveEditor: (editor) => {
                    const activeView = this.plugin.sidebarManager.activeView;
                    if (activeView) activeView.updateActiveEditor(editor);
                },
                getActiveEditor: () => {
                    const activeView = this.plugin.sidebarManager.activeView;
                    return activeView ? activeView.activeEditor : null;
                },
                getToolbar: () => {
                    const activeView = this.plugin.sidebarManager.activeView;
                    return activeView ? activeView.toolbar : null;
                }
            },
            contentEl
        );

        // Subscribe to changes from the SidebarManager
        this.unsubscribe = this.plugin.sidebarManager.onUpdate(() => {
            this.zAxisPanel.update();
        });

        // The global sidebar is always "visible" in the sense that it should try to render 
        // if a document is active.
        this.zAxisPanel.isVisible = true;
        this.zAxisPanel.update();
    }

    async onClose() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
        if (this.zAxisPanel) {
            this.zAxisPanel.destroy();
        }
    }
}
