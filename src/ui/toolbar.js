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

        // Separator
        // this.createSeparator();

        // 2. Formatting Group
        const formatGroup = this.containerEl.createDiv({ cls: 'colophon-btn-group' });

        this.boldBtn = this.createButton(formatGroup, 'bold', 'Bold', () => this.view.toggleBold());
        this.italicBtn = this.createButton(formatGroup, 'italic', 'Italic', () => this.view.toggleItalic());
        this.strikeBtn = this.createButton(formatGroup, 'strikethrough', 'Strikethrough', () => this.view.toggleStrike()); // Assuming view has this method now

        // Spacer
        this.createSpacer();

        // Separator
        // this.createSeparator();

        // 3. Z-Axis Panels
        const zAxisGroup = this.containerEl.createDiv({ cls: 'colophon-btn-group' });

        this.footnoteBtn = this.createButton(zAxisGroup, 'list-ordered', 'Footnotes', () => {
            this.view.toggleFootnotes();
        });

        this.commentBtn = this.createButton(zAxisGroup, 'message-square', 'Comments', () => {
            this.view.toggleComments();
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

        this.blockSelectBtn.onclick = (e) => {
            e.stopPropagation();
            this.showBlockMenu(e);
        };
    }

    showBlockMenu(e) {
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
        if (this.view.adapter && this.view.adapter.editor) {
            // Tiptap command to set block type. 
            // Note: splitBlock might have set it, but here we want to change CURRENT block.
            // We use 'setNode' or 'updateAttributes' if it's the same node but different class?
            // Actually, we defined them as separate Node Types in universal-block.js (Node.create({ name: blockId }))

            // So we use commands.setNode(blockId)
            this.view.adapter.editor.commands.setNode(blockId);
            this.update();
        }
    }

    createButton(parent, icon, tooltip, onClick) {
        const btn = parent.createEl('button', {
            cls: 'colophon-ui-btn colophon-icon-only',
            attr: { 'aria-label': tooltip }
        });
        setIcon(btn, icon);
        btn.onclick = onClick;
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
        if (!this.view.adapter || !this.view.adapter.editor) return;

        const editor = this.view.adapter.editor;

        // Update Formatting Buttons
        this.toggleBtnState(this.boldBtn, editor.isActive('bold'));
        this.toggleBtnState(this.italicBtn, editor.isActive('italic'));
        this.toggleBtnState(this.strikeBtn, editor.isActive('strike'));

        // Update Block Selector Text
        // Find which block is active.
        // We iterate through available blocks and check isActive
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

        // Update button text (excluding icon)
        // This is a bit hacky because of the icon span inside
        this.blockSelectBtn.firstChild.textContent = activeBlockName;
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
