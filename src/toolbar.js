const { setIcon } = require('obsidian');

class Toolbar {
    constructor(containerEl) {
        this.containerEl = containerEl;
        this.editor = null;
        this.el = null;
        this.paragraphOptions = [];
        this.listOptions = [];

        // Bindings
        this.update = this.update.bind(this);
    }

    create() {
        this.el = this.containerEl.createDiv('colophon-toolbar');

        // Single Row
        const row1 = this.el.createDiv('colophon-toolbar-row');

        // Paragraph Dropdown
        this.paragraphSelect = this.createDropdown(row1, 'Paragraph', []);

        // List Dropdown
        this.listSelect = this.createDropdown(row1, 'List', []);

        // Formatting Group (Combined)
        const formatGroup = row1.createDiv('colophon-btn-group');
        this.createButton(formatGroup, null, 'Bold', () => this.toggleMark('bold'), 'isActive', 'bold', '<strong>B</strong>');
        this.createButton(formatGroup, null, 'Italic', () => this.toggleMark('italic'), 'isActive', 'italic', '<em>I</em>');
        this.createButton(formatGroup, null, 'Underline', () => this.toggleMark('underline'), 'isActive', 'underline', '<u>U</u>');
        this.createButton(formatGroup, null, 'Strikethrough', () => this.toggleMark('strike'), 'isActive', 'strike', '<s>S</s>');

        // Advanced Formatting (Superscript, Subscript, Small Caps)
        this.createButton(formatGroup, 'superscript', 'Superscript', () => this.toggleMark('superscript'), 'isActive', 'superscript');
        this.createButton(formatGroup, 'subscript', 'Subscript', () => this.toggleMark('subscript'), 'isActive', 'subscript');
        this.createButton(formatGroup, 'type', 'Small Caps', () => this.toggleMark('smallCaps'), 'isActive', 'smallCaps');
    }

    createDropdown(parent, defaultLabel, options) {
        const container = parent.createDiv({ cls: 'colophon-dropdown-wrapper', style: 'position: relative;' });

        const trigger = container.createEl('button', { cls: 'colophon-ui-btn colophon-dropdown-trigger' });
        const labelSpan = trigger.createSpan({ text: defaultLabel });
        const iconSpan = trigger.createSpan();
        setIcon(iconSpan, 'chevron-down');

        const dropdown = container.createDiv('colophon-dropdown-menu');
        dropdown.style.display = 'none';
        dropdown.style.top = '100%';
        dropdown.style.left = '0';
        dropdown.style.marginTop = '4px';

        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.closeAllDropdowns();
            dropdown.style.display = 'block';
        });

        // Close on click outside
        document.addEventListener('click', (e) => {
            if (!trigger.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });

        return { trigger, labelSpan, dropdown, options };
    }

    closeAllDropdowns() {
        this.el.querySelectorAll('.colophon-dropdown-menu').forEach(d => d.style.display = 'none');
        this.el.querySelectorAll('.colophon-context-menu').forEach(d => d.style.display = 'none');
    }

    createButton(parent, icon, label, action, checkMethod, checkArg, htmlContent) {
        const btn = parent.createEl('button', { cls: 'colophon-ui-btn colophon-icon-only' });
        btn.setAttribute('aria-label', label);

        if (htmlContent) {
            btn.innerHTML = htmlContent;
        } else if (icon) {
            const iconSpan = btn.createSpan();
            setIcon(iconSpan, icon);
        }

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.editor) {
                action();
                this.editor.commands.focus();
            }
        });

        btn._checkState = () => {
            if (this.editor && checkMethod === 'isActive' && checkArg) {
                if (this.editor.isActive(checkArg)) {
                    btn.addClass('colophon-active');
                } else {
                    btn.removeClass('colophon-active');
                }
            }
        };

        return btn;
    }

    createContextMenu(parent, triggerBtn) {
        const menu = parent.createDiv('colophon-context-menu');
        menu.style.display = 'none';
        menu.style.top = '100%';
        menu.style.left = '0'; // Or right?
        menu.style.marginTop = '4px';

        // Add items (Table, Divider, Image as per mockup)
        this.createMenuItem(menu, 'table', 'Table', () => { });
        this.createMenuItem(menu, 'minus', 'Divider', () => {
            if (this.editor) this.editor.chain().focus().setHorizontalRule().run();
        });
        this.createMenuItem(menu, 'image', 'Image', () => { });

        triggerBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isVisible = menu.style.display === 'block';
            this.closeAllDropdowns();
            if (!isVisible) {
                menu.style.display = 'block';
            }
        });
    }

    createMenuItem(parent, icon, label, action) {
        const item = parent.createDiv('colophon-menu-item');
        item.createSpan({ cls: 'colophon-drag-handle', text: '⋮⋮' });
        const iconSpan = item.createSpan({ cls: 'colophon-icon' });
        setIcon(iconSpan, icon);
        item.createSpan({ cls: 'colophon-label', text: label });

        item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            action();
            parent.style.display = 'none';
        });
    }

    setActiveEditor(editor, isFootnote = false) {
        this.editor = editor;
        this.isFootnote = isFootnote;
        this.update();
    }

    setDocType(docType) {
        this.docType = docType;
        this.update();
    }

    updateStyleOptions(paragraphOptions, listOptions) {
        this.paragraphOptions = paragraphOptions;
        this.listOptions = listOptions;
        this.rebuildDropdowns();
    }

    rebuildDropdowns() {
        // Paragraph
        this.paragraphSelect.dropdown.empty();

        // If Script Mode, use hardcoded script options
        let options = this.paragraphOptions;
        if (this.docType === 'script') {
            options = [
                { label: 'Scene Heading', value: 'script-scene', type: 'paragraph' },
                { label: 'Action', value: 'script-action', type: 'paragraph' },
                { label: 'Character', value: 'script-character', type: 'paragraph' },
                { label: 'Dialogue', value: 'script-dialogue', type: 'paragraph' },
                { label: 'Parenthetical', value: 'script-parenthetical', type: 'paragraph' },
                { label: 'Transition', value: 'script-transition', type: 'paragraph' }
            ];
        }

        options.forEach(opt => {
            const item = this.paragraphSelect.dropdown.createDiv('colophon-menu-item');
            item.createSpan({ cls: 'colophon-label', text: opt.label });
            item.addEventListener('click', () => {
                this.applyStyle(opt.value, opt.type, opt.listType);
                this.paragraphSelect.dropdown.style.display = 'none';
            });
        });

        // List
        this.listSelect.dropdown.empty();
        this.listOptions.forEach(opt => {
            const item = this.listSelect.dropdown.createDiv('colophon-menu-item');
            item.createSpan({ cls: 'colophon-label', text: opt.label });
            item.addEventListener('click', () => {
                this.applyStyle(opt.value, opt.type, opt.listType);
                this.listSelect.dropdown.style.display = 'none';
            });
        });
    }

    applyStyle(value, type, listType) {
        if (!this.editor) return;

        if (type === 'list') {
            if (value === 'none') {
                this.editor.chain().focus().liftListItem('listItem').run();
                return;
            }

            if (listType === 'ordered') {
                this.editor.chain().focus().toggleOrderedList().updateAttributes('orderedList', { class: value }).run();
            } else {
                this.editor.chain().focus().toggleBulletList().updateAttributes('bulletList', { class: value }).run();
            }
            return;
        }

        // Heading/Paragraph
        let isHeading = false;
        let level = 1;

        if (value && (value.startsWith('heading-') || value === 'title')) {
            isHeading = true;
            if (value.startsWith('heading-')) {
                level = parseInt(value.split('-')[1], 10);
            }
        }

        if (isHeading) {
            this.editor.chain().focus().toggleHeading({ level }).updateAttributes('heading', { class: value }).run();
        } else {
            // For script classes, we just update attributes on paragraph
            this.editor.chain().focus().setParagraph().updateAttributes('paragraph', { class: value }).run();
        }
    }

    toggleMark(type) {
        if (!this.editor) return;
        if (type === 'bold') this.editor.chain().focus().toggleBold().run();
        if (type === 'italic') this.editor.chain().focus().toggleItalic().run();
        if (type === 'underline') this.editor.chain().focus().toggleUnderline().run();
        if (type === 'strike') this.editor.chain().focus().toggleStrike().run();
        if (type === 'superscript') this.editor.chain().focus().toggleSuperscript().run();
        if (type === 'subscript') this.editor.chain().focus().toggleSubscript().run();
        if (type === 'smallCaps') this.editor.chain().focus().toggleSmallCaps().run();
    }

    update() {
        if (!this.el) return;

        // Update Buttons
        const btns = this.el.querySelectorAll('.colophon-ui-btn');
        btns.forEach(btn => {
            if (btn._checkState) btn._checkState();
        });

        // Update Dropdown Labels
        if (this.isFootnote) {
            if (this.paragraphSelect) {
                this.paragraphSelect.trigger.setAttribute('disabled', 'true');
                this.paragraphSelect.trigger.addClass('colophon-disabled');
                this.paragraphSelect.labelSpan.innerText = 'Footnote';
            }
            // Disable List Select too for footnotes? Usually footnotes don't have lists in this impl?
        } else {
            if (this.paragraphSelect) {
                this.paragraphSelect.trigger.removeAttribute('disabled');
                this.paragraphSelect.trigger.removeClass('colophon-disabled');
                this.updateParagraphLabel();
            }
        }

        // Handle Script Mode UI
        if (this.docType === 'script') {
            // Hide List Select
            if (this.listSelect) {
                this.listSelect.trigger.style.display = 'none';
            }
            // Rebuild dropdowns if needed? 
            // We should rebuild dropdowns when docType changes, not on every update.
            // But update() is called often.
            // Let's assume rebuildDropdowns is called when docType is set.
        } else {
            if (this.listSelect) {
                this.listSelect.trigger.style.display = '';
            }
        }

        this.updateListLabel();
    }

    updateParagraphLabel() {
        if (!this.editor || !this.paragraphSelect) return;

        let activeLabel = 'Paragraph';

        let options = this.paragraphOptions;
        if (this.docType === 'script') {
            options = [
                { label: 'Scene Heading', value: 'script-scene' },
                { label: 'Action', value: 'script-action' },
                { label: 'Character', value: 'script-character' },
                { label: 'Dialogue', value: 'script-dialogue' },
                { label: 'Parenthetical', value: 'script-parenthetical' },
                { label: 'Transition', value: 'script-transition' }
            ];
        }

        for (const opt of options) {
            const value = opt.value;
            if (!value) continue;
            let isMatch = false;
            if (value.startsWith('heading-') || value === 'title') {
                if (this.editor.isActive('heading', { class: value })) isMatch = true;
            } else {
                if (this.editor.isActive('paragraph', { class: value })) isMatch = true;
            }
            if (isMatch) {
                activeLabel = opt.label;
                break;
            }
        }
        this.paragraphSelect.labelSpan.innerText = activeLabel;
    }

    updateListLabel() {
        if (!this.editor || !this.listSelect) return;

        if (this.docType === 'script') return; // Skip for script mode

        let activeLabel = 'List';
        for (const opt of this.listOptions) {
            const value = opt.value;
            if (value === 'none') continue;
            const listType = opt.listType || 'unordered';
            const nodeType = listType === 'ordered' ? 'orderedList' : 'bulletList';
            if (this.editor.isActive(nodeType, { class: value })) {
                activeLabel = opt.label;
                break;
            }
        }
        this.listSelect.labelSpan.innerText = activeLabel;
    }

    destroy() {
        if (this.el) this.el.remove();
    }
}

module.exports = Toolbar;
