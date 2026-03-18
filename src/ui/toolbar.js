import { setIcon, Menu } from 'obsidian';

export class ColophonToolbar {
    constructor(view, parentEl) {
        this.view = view;
        this.parentEl = parentEl;
        this.containerEl = null;
        this.blockSelectBtn = null;

        this.render();
        this.update(); // Initial update
    }

    render() {
        this.containerEl = this.parentEl.createDiv({ cls: 'colophon-toolbar' });

        // 1. Block Selector
        this.renderBlockSelector();

        // 2. Formatting Group
        const formatGroup = this.containerEl.createDiv({ cls: 'colophon-btn-group' });

        this.boldBtn = this.createButton(formatGroup, 'bold', 'Bold', () => this.view.toggleBold());
        this.italicBtn = this.createButton(formatGroup, 'italic', 'Italic', () => this.view.toggleItalic());
        this.strikeBtn = this.createButton(formatGroup, 'strikethrough', 'Strikethrough', () => this.view.toggleStrike());
        this.underlineBtn = this.createButton(formatGroup, 'underline', 'Underline', () => this.view.toggleUnderline());
        
        this.superBtn = this.createButton(formatGroup, 'superscript', 'Superscript', () => this.view.toggleSuperscript());
        this.subBtn = this.createButton(formatGroup, 'subscript', 'Subscript', () => this.view.toggleSubscript());
        this.smallCapsBtn = this.createButton(formatGroup, 'a-large-small', 'Small Caps', () => this.view.toggleSmallCaps());
        
        this.insertCommentBtn = this.createButton(formatGroup, 'message-square-plus', 'Add Comment', () => this.view.insertComment());

        // Spacer
        this.createSpacer();

        // 3. Z-Axis Panels
        this.zAxisGroup = this.containerEl.createDiv({ cls: 'colophon-btn-group' });

        this.footnoteBtn = this.createButton(this.zAxisGroup, 'list-ordered', 'Footnotes', () => {
            this.view.toggleFootnotes();
        });

        this.commentBtn = this.createButton(this.zAxisGroup, 'message-square', 'Comments', () => {
            this.view.toggleComments();
        });

        this.exportBtn = this.createButton(this.zAxisGroup, 'download', 'Export to DOCX', () => {
            this.view.plugin.app.commands.executeCommandById('colophon-writer:export-to-docx');
        });
    }

    renderBlockSelector() {
        const wrapper = this.containerEl.createDiv({ cls: 'colophon-dropdown-wrapper' });

        this.blockSelectBtn = wrapper.createEl('button', {
            cls: 'colophon-ui-btn colophon-dropdown-trigger',
            text: 'Body' // Default
        });

        const iconContainer = this.blockSelectBtn.createSpan({ cls: 'colophon-select-icon' });
        setIcon(iconContainer, 'chevron-down');

        this.blockSelectBtn.onmousedown = (e) => {
            if (this.isBlockMenuDisabled) {
                e.preventDefault();
                return;
            }
            e.stopPropagation();
            this.showBlockMenu(e);
        };
    }

    showBlockMenu(e) {
        if (this.isBlockMenuDisabled) return;
        const menu = new Menu();

        // Get available blocks from settings
        const blocks = this.view.plugin.settings.blocks;

        for (const [id, def] of Object.entries(blocks)) {
            menu.addItem((item) => {
                item
                    .setTitle(def.name)
                    .onClick(() => {
                        this.applyBlockType(id);
                    });

                // Check if active
                if (this.currentBlockType === id) {
                    item.setChecked(true);
                }
            });
        }

        menu.showAtMouseEvent(e);
    }

    applyBlockType(blockId) {
        const editor = this.view.activeEditor || (this.view.adapter ? this.view.adapter.editor : null);
        if (editor) {
            editor.commands.setNode(blockId);
            this.update();
        }
    }

    createButton(parent, icon, tooltip, onClick) {
        const btn = parent.createEl('button', {
            cls: 'colophon-ui-btn colophon-icon-only',
            attr: { 'aria-label': tooltip }
        });
        setIcon(btn, icon);
        btn.onmousedown = (e) => {
            e.preventDefault();
            onClick();
        };
        return btn;
    }

    createSeparator() {
        const sep = this.containerEl.createDiv({ cls: 'colophon-toolbar-separator' });
        sep.style.width = '1px';
        sep.style.height = '16px';
        sep.style.backgroundColor = 'var(--background-modifier-border)';
        sep.style.margin = '0 8px';
    }

    createSpacer() {
        const spacer = this.containerEl.createDiv({ cls: 'colophon-toolbar-spacer' });
        spacer.style.flex = '1';
    }

    update() {
        const editor = this.view.activeEditor || (this.view.adapter ? this.view.adapter.editor : null);
        
        // Safety check: Ensure editor is available and NOT destroyed
        if (!editor || (editor.isDestroyed)) return;

        // Tiptap v3 throws if accessing view properties on a destroyed editor
        let viewDOM = null;
        try {
            viewDOM = editor.view?.dom;
        } catch (e) {
            return; // Editor view not ready or already gone
        }

        // Update Formatting Buttons
        this.toggleBtnState(this.boldBtn, editor.isActive('bold'));
        this.toggleBtnState(this.italicBtn, editor.isActive('italic'));
        this.toggleBtnState(this.strikeBtn, editor.isActive('strike'));
        this.toggleBtnState(this.underlineBtn, editor.isActive('underline'));
        this.toggleBtnState(this.superBtn, editor.isActive('superscript'));
        this.toggleBtnState(this.subBtn, editor.isActive('subscript'));
        this.toggleBtnState(this.smallCapsBtn, editor.isActive('smallCaps'));
        
        // Disable Add Comment if no selection
        const hasSelection = !editor.state.selection.empty;
        if (hasSelection) {
            this.insertCommentBtn.removeClass('is-disabled');
        } else {
            this.insertCommentBtn.addClass('is-disabled');
        }

        // Update Block Selector Text
        const isFootnote = viewDOM?.classList?.contains('footnote');
        
        if (isFootnote) {
            this.blockSelectBtn.firstChild.textContent = 'Footnote';
            this.blockSelectBtn.addClass('is-disabled');
            this.isBlockMenuDisabled = true;
        } else {
            this.blockSelectBtn.removeClass('is-disabled');
            this.isBlockMenuDisabled = false;
            
            const blocks = this.view.plugin.settings.blocks;
            let activeBlockName = 'Body';
            this.currentBlockType = 'body';

            for (const [id, def] of Object.entries(blocks)) {
                if (editor.isActive(id)) {
                    activeBlockName = def.name;
                    this.currentBlockType = id;
                    break;
                }
            }
            this.blockSelectBtn.firstChild.textContent = activeBlockName;
        }

        // Update Panel Status Indicators
        if (this.view.plugin.settings.sidebarLocation === 'global') {
            this.zAxisGroup.hide();
        } else {
            this.zAxisGroup.show();
            if (this.view.zAxisPanel) {
                const panel = this.view.zAxisPanel;
                this.toggleBtnState(this.footnoteBtn, panel.isVisible && panel.activeTab === 'footnotes');
                this.toggleBtnState(this.commentBtn, panel.isVisible && panel.activeTab === 'comments');
            }
        }
    }

    toggleBtnState(btn, isActive) {
        if (isActive) {
            btn.addClass('colophon-active');
        } else {
            btn.removeClass('colophon-active');
        }
    }

    destroy() {
        if (this.containerEl) {
            this.containerEl.remove();
        }
    }
}
