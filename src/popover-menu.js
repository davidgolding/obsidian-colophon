const { setIcon } = require('obsidian');

class PopoverMenu {
    constructor(editor, containerEl, styleOptions = []) {
        this.editor = editor;
        this.containerEl = containerEl;
        this.styleOptions = styleOptions;
        this.el = null;
        this.isVisible = false;
        this.currentMode = 'default'; // Store mode

        // Bind methods
        this.handleClickOutside = this.handleClickOutside.bind(this);
    }

    updateStyleOptions(newOptions) {
        this.styleOptions = newOptions;
        // If the menu is already created, we need to rebuild the select menu
        if (this.el && this.sections && this.sections[0]) {
            // Clear the existing select menu container
            this.sections[0].empty();

            // Re-create the select menu
            const options = (this.styleOptions || []).map(opt => ({
                label: opt.label,
                value: opt.value,
                action: () => this.applyStyle(opt.value)
            }));

            this.styleSelect = this.createSelectMenu(this.sections[0], options);
        }
    }

    applyStyle(value) {
        if (!this.editor) return;

        // Determine if it's a heading or paragraph based on value
        // Convention: heading-X or title -> Heading
        // Others -> Paragraph

        let isHeading = false;
        let level = 1;

        if (value.startsWith('heading-')) {
            isHeading = true;
            level = parseInt(value.split('-')[1], 10);
        } else if (value === 'title') {
            isHeading = true;
            level = 1;
        }

        if (isHeading) {
            this.editor.chain().focus().toggleHeading({ level }).updateAttributes('heading', { class: value }).run();
        } else {
            // Assume paragraph
            this.editor.chain().focus().setParagraph().updateAttributes('paragraph', { class: value }).run();
        }
    }

    create() {
        this.el = document.createElement('div');
        this.el.addClass('colophon-popover');
        this.containerEl.appendChild(this.el);

        this.sections = [];

        // Section 1: Styles (Select Menu) - Index 0
        const styleSection = this.el.createDiv('colophon-popover-section');

        // Generate options with actions
        const options = (this.styleOptions || []).map(opt => ({
            label: opt.label,
            value: opt.value,
            action: () => this.applyStyle(opt.value)
        }));

        this.styleSelect = this.createSelectMenu(styleSection, options);
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

        let activeValue = 'body'; // Default fallback

        // Iterate through options to find the active one
        // We prioritize specific classes over generic ones if any
        for (const opt of (this.styleOptions || [])) {
            const value = opt.value;
            let isMatch = false;

            if (value.startsWith('heading-') || value === 'title') {
                // It's a heading
                if (this.editor.isActive('heading', { class: value })) {
                    isMatch = true;
                }
            } else {
                // It's a paragraph
                if (this.editor.isActive('paragraph', { class: value })) {
                    isMatch = true;
                }
            }

            if (isMatch) {
                activeValue = value;
                break;
            }
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
