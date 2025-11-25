const { setIcon } = require('obsidian');

class PopoverMenu {
    constructor(editor, containerEl) {
        this.editor = editor;
        this.containerEl = containerEl;
        this.el = null;
        this.isVisible = false;
        this.currentMode = 'default'; // Store mode

        // Bind methods
        this.handleClickOutside = this.handleClickOutside.bind(this);
    }

    create() {
        this.el = document.createElement('div');
        this.el.addClass('colophon-popover');
        this.containerEl.appendChild(this.el);

        this.sections = [];

        // Section 1: Styles (Select Menu) - Index 0
        const styleSection = this.el.createDiv('colophon-popover-section');
        this.styleSelect = this.createSelectMenu(styleSection, [
            { label: 'Supertitle', value: 'supertitle', action: () => this.editor.chain().focus().setParagraph().updateAttributes('paragraph', { class: 'supertitle' }).run() },
            { label: 'Title', value: 'title', action: () => this.editor.chain().focus().toggleHeading({ level: 1 }).updateAttributes('heading', { class: 'title' }).run() },
            { label: 'Heading 1', value: 'h1', action: () => this.editor.chain().focus().toggleHeading({ level: 1 }).updateAttributes('heading', { class: 'heading-1' }).run() },
            { label: 'Heading 2', value: 'h2', action: () => this.editor.chain().focus().toggleHeading({ level: 2 }).updateAttributes('heading', { class: 'heading-2' }).run() },
            { label: 'Heading 3', value: 'h3', action: () => this.editor.chain().focus().toggleHeading({ level: 3 }).updateAttributes('heading', { class: 'heading-3' }).run() },
            { label: 'Heading 4', value: 'h4', action: () => this.editor.chain().focus().toggleHeading({ level: 4 }).updateAttributes('heading', { class: 'heading-4' }).run() },
            { label: 'Heading 5', value: 'h5', action: () => this.editor.chain().focus().toggleHeading({ level: 5 }).updateAttributes('heading', { class: 'heading-5' }).run() },
            { label: 'Heading 6', value: 'h6', action: () => this.editor.chain().focus().toggleHeading({ level: 6 }).updateAttributes('heading', { class: 'heading-6' }).run() },
            { label: 'Body First', value: 'body-first', action: () => this.editor.chain().focus().setParagraph().updateAttributes('paragraph', { class: 'body-first' }).run() },
            { label: 'Body', value: 'paragraph', action: () => this.editor.chain().focus().setParagraph().updateAttributes('paragraph', { class: 'body' }).run() }
        ]);
        this.sections.push(styleSection);

        // Section 2: Formatting - Index 1
        const formatSection = this.el.createDiv('colophon-popover-section');
        this.createIconButton(formatSection, 'bold', () => this.editor.chain().focus().toggleBold().run(), 'isActive', 'bold');
        this.createIconButton(formatSection, 'italic', () => this.editor.chain().focus().toggleItalic().run(), 'isActive', 'italic');
        this.createIconButton(formatSection, 'underline', () => this.editor.chain().focus().toggleUnderline().run(), 'isActive', 'underline');
        this.createIconButton(formatSection, 'strikethrough', () => this.editor.chain().focus().toggleStrike().run(), 'isActive', 'strike');
        this.sections.push(formatSection);

        // Section 3: Advanced Formatting - Index 2
        const advancedSection = this.el.createDiv('colophon-popover-section');
        this.createIconButton(advancedSection, 'superscript', () => this.editor.chain().focus().toggleSuperscript().run(), 'isActive', 'superscript');
        this.createIconButton(advancedSection, 'subscript', () => this.editor.chain().focus().toggleSubscript().run(), 'isActive', 'subscript');
        // Custom Small Caps icon/button
        const smallCapsBtn = this.createIconButton(advancedSection, 'type', () => this.editor.chain().focus().toggleSmallCaps().run(), 'isActive', 'smallCaps');
        smallCapsBtn.setAttribute('aria-label', 'Small Caps');
        this.sections.push(advancedSection);
    }

    createSelectMenu(parent, options) {
        const container = parent.createDiv('colophon-select-container');

        // Trigger Button
        const trigger = container.createEl('button', { cls: 'colophon-select-trigger' });
        const labelSpan = trigger.createSpan({ cls: 'colophon-select-label', text: 'Select Style' });
        const iconSpan = trigger.createSpan({ cls: 'colophon-select-icon' });
        setIcon(iconSpan, 'chevron-down');

        // Dropdown Menu
        const dropdown = container.createDiv('colophon-select-dropdown');
        dropdown.style.display = 'none';

        // Toggle Logic
        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isHidden = dropdown.style.display === 'none';
            dropdown.style.display = isHidden ? 'block' : 'none';
        });

        // Options
        options.forEach(opt => {
            const item = dropdown.createEl('div', { cls: 'colophon-select-item' });
            item.dataset.value = opt.value;

            item.createSpan({ text: opt.label });

            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                opt.action();
                this.hide(); // Close popover on selection
            });
        });

        return { container, trigger, labelSpan, dropdown, options };
    }

    updateSelectMenu() {
        if (!this.styleSelect || !this.editor) return;

        let activeValue = 'paragraph';

        // Check attributes
        if (this.editor.isActive('heading', { level: 1 })) {
            if (this.editor.isActive({ class: 'title' })) activeValue = 'title';
            else activeValue = 'h1';
        }
        else if (this.editor.isActive('heading', { level: 2 })) activeValue = 'h2';
        else if (this.editor.isActive('heading', { level: 3 })) activeValue = 'h3';
        else if (this.editor.isActive('heading', { level: 4 })) activeValue = 'h4';
        else if (this.editor.isActive('heading', { level: 5 })) activeValue = 'h5';
        else if (this.editor.isActive('heading', { level: 6 })) activeValue = 'h6';
        else if (this.editor.isActive('paragraph')) {
            if (this.editor.isActive({ class: 'supertitle' })) activeValue = 'supertitle';
            else if (this.editor.isActive({ class: 'body-first' })) activeValue = 'body-first';
            else activeValue = 'paragraph';
        }

        // Update Label
        const activeOption = this.styleSelect.options.find(o => o.value === activeValue);
        this.styleSelect.labelSpan.innerText = activeOption ? activeOption.label : 'Select Style';

        // Update Selection State
        const items = this.styleSelect.dropdown.querySelectorAll('.colophon-select-item');
        items.forEach(item => {
            if (item.dataset.value === activeValue) {
                item.addClass('is-selected');
            } else {
                item.removeClass('is-selected');
            }
        });
    }

    setMode(mode) {
        this.currentMode = mode;
        if (!this.el) this.create();

        if (mode === 'footnote') {
            // Hide Style Section (Headings)
            if (this.sections[0]) this.sections[0].style.display = 'none';
        } else {
            // Default: Show all
            if (this.sections[0]) this.sections[0].style.display = 'flex';
        }
    }

    createIconButton(parent, icon, action, checkMethod, checkArg) {
        const btn = parent.createEl('button', { cls: 'colophon-popover-icon-btn' });
        const iconSpan = btn.createSpan();
        setIcon(iconSpan, icon);

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            action();
            this.hide();
        });

        // Store check logic for update
        btn._checkState = () => {
            if (this.editor && this.editor.isActive(checkArg)) {
                btn.addClass('is-active');
            } else {
                btn.removeClass('is-active');
            }
        };

        return btn;
    }

    updateButtonStates() {
        // Update Icon Buttons
        const btns = this.el.querySelectorAll('.colophon-popover-icon-btn');
        btns.forEach(btn => {
            if (btn._checkState) btn._checkState();
        });
    }

    show(x, y) {
        // Check if el exists and is connected to DOM
        if (!this.el || !this.el.isConnected) {
            if (this.el) this.el.remove(); // Cleanup detached element
            this.create();
            this.setMode(this.currentMode); // Re-apply mode
        }

        // Update States
        this.updateSelectMenu();
        this.updateButtonStates();

        // Position
        this.el.style.left = `${x}px`;
        this.el.style.top = `${y}px`;
        this.el.addClass('is-visible');
        this.isVisible = true;

        // Add global click listener to close
        document.addEventListener('click', this.handleClickOutside);
    }

    hide() {
        if (this.el) {
            this.el.removeClass('is-visible');
            this.isVisible = false;
            document.removeEventListener('click', this.handleClickOutside);

            // Close dropdown if open
            if (this.styleSelect && this.styleSelect.dropdown) {
                this.styleSelect.dropdown.style.display = 'none';
            }
        }
    }

    handleClickOutside(e) {
        if (this.el && !this.el.contains(e.target)) {
            this.hide();
        }
    }

    destroy() {
        if (this.el) {
            this.el.remove();
        }
        document.removeEventListener('click', this.handleClickOutside);
    }
}

module.exports = PopoverMenu;
