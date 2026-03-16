import { VIEW_TYPE_COLOPHON } from './view';
import { VIEW_TYPE_COLOPHON_SIDEBAR } from './sidebar-view';

/**
 * Manages the active state of Colophon views to support a global sidebar.
 * It tracks which Colophon document is currently focused and provides its adapter to the sidebar.
 */
export class SidebarManager {
    constructor(plugin) {
        this.plugin = plugin;
        this.app = plugin.app;
        this.activeView = null;
        this.listeners = new Set();
    }

    setup() {
        // Track active leaf changes to sync the sidebar
        this.plugin.registerEvent(
            this.app.workspace.on('active-leaf-change', (leaf) => {
                this.handleActiveLeafChange(leaf);
            })
        );

        // Also track layout changes to catch edge cases
        this.plugin.registerEvent(
            this.app.workspace.on('layout-change', () => {
                this.handleActiveLeafChange(this.app.workspace.activeLeaf);
            })
        );

        // Initial check
        this.app.workspace.onLayoutReady(() => {
            this.handleActiveLeafChange(this.app.workspace.activeLeaf);
        });
    }

    handleActiveLeafChange(leaf) {
        if (!leaf) {
            this.setActiveView(null);
            return;
        }

        const view = leaf.view;
        
        // If it's a Colophon view, make it active
        if (view.getViewType() === VIEW_TYPE_COLOPHON) {
            this.setActiveView(view);
        } 
        // If it's the Colophon Sidebar itself or some other non-file view, 
        // we usually want to keep the last active Colophon view OR clear it 
        // if the user has switched to a completely different document.
        else if (view.getViewType() === VIEW_TYPE_COLOPHON_SIDEBAR) {
            // Keep current active view when focusing the sidebar itself
            return;
        }
        else if (view.getViewType() === 'markdown' || (view.file && view.file.extension !== 'colophon')) {
            this.setActiveView(null);
        }
    }

    setActiveView(view) {
        if (this.activeView === view) return;
        
        this.activeView = view;
        this.notifyListeners();
    }

    /**
     * Data Provider Interface for ZAxisPanel
     */
    getAdapter() {
        return this.activeView ? this.activeView.adapter : null;
    }

    onUpdate(callback) {
        this.listeners.add(callback);
        // Return unsubscribe function
        return () => this.listeners.delete(callback);
    }

    notifyListeners() {
        this.listeners.forEach(callback => callback(this.activeView));
    }

    /**
     * Force an update to the sidebar (e.g., when the active document's content changes)
     */
    update() {
        this.notifyListeners();
    }

    focusMarker(id) {
        if (this.activeView && this.activeView.adapter) {
            this.activeView.adapter.focusMarker(id);
        }
    }
}
