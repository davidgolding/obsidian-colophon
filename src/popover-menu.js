const { setIcon } = require('obsidian');

class PopoverMenu {
    constructor(editor, containerEl, paragraphOptions = [], listOptions = []) {
        this.editor = editor;
        this.containerEl = containerEl;
        this.paragraphOptions = paragraphOptions;
        this.listOptions = listOptions;
        this.el = null;
        this.isVisible = false;
        this.currentMode = 'default'; // Store mode

        // Bind methods
        this.handleClickOutside = this.handleClickOutside.bind(this);
    }

    updateStyleOptions(paragraphOptions, listOptions) {
        this.paragraphOptions = paragraphOptions;
        this.listOptions = listOptions;

        // If the menu is already created, we need to rebuild the select menus
        if (this.el && this.sections && this.sections[0]) {
            // Clear the existing select menu container
            this.sections[0].empty();

            // Re-create Paragraph Select
            this.sections[0].createDiv({ cls: 'colophon-popover-label', text: 'Paragraph Style' });
            const pOptions = (this.paragraphOptions || []).map(opt => ({
                label: opt.label,
                value: opt.value,
                action: () => this.applyStyle(opt.value, opt.type, opt.listType)
            }));
            this.paragraphSelect = this.createSelectMenu(this.sections[0], pOptions, 'Paragraph Style');

            // Re-create List Select
            this.sections[0].createDiv({ cls: 'colophon-popover-label', text: 'List Style' });
            const lOptions = (this.listOptions || []).map(opt => ({
                label: opt.label,
                value: opt.value,
                action: () => this.applyStyle(opt.value, opt.type, opt.listType)
            }));
            this.listSelect = this.createSelectMenu(this.sections[0], lOptions, 'List Style');
        }
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

        // Section 1: Styles (Select Menus) - Index 0
        const styleSection = this.el.createDiv('colophon-popover-section');
        styleSection.addClass('colophon-style-section'); // Add class for styling if needed

        // Paragraph Options
        styleSection.createDiv({ cls: 'colophon-popover-label', text: 'Paragraph Style' });
        const pOptions = (this.paragraphOptions || []).map(opt => ({
            label: opt.label,
            value: opt.value,
            action: () => this.applyStyle(opt.value, opt.type, opt.listType)
        }));
        this.paragraphSelect = this.createSelectMenu(styleSection, pOptions, 'Paragraph Style');

        // List Options
        styleSection.createDiv({ cls: 'colophon-popover-label', text: 'List Style' });
        const lOptions = (this.listOptions || []).map(opt => ({
            label: opt.label,
            value: opt.value,
            action: () => this.applyStyle(opt.value, opt.type, opt.listType)
        }));
        this.listSelect = this.createSelectMenu(styleSection, lOptions, 'List Style');

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

    createSelectMenu(parent, options, defaultLabel = 'Select Style') {
        const container = parent.createDiv('colophon-select-container');

        // Trigger Button
        const trigger = container.createEl('button', { cls: 'colophon-select-trigger' });
        const labelSpan = trigger.createSpan({ cls: 'colophon-select-label', text: defaultLabel });
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
        if (!this.editor) return;
        this.updateParagraphSelect();
        this.updateListSelect();
    }

    updateParagraphSelect() {
        if (!this.paragraphSelect) return;

        let activeValue = 'body'; // Default fallback

        for (const opt of (this.paragraphOptions || [])) {
            const value = opt.value;
            let isMatch = false;

            if (value.startsWith('heading-') || value === 'title') {
                if (this.editor.isActive('heading', { class: value })) {
                    isMatch = true;
                }
            } else {
                if (this.editor.isActive('paragraph', { class: value })) {
                    isMatch = true;
                }
            }

            if (isMatch) {
                activeValue = value;
                break;
            }
        }

        const activeOption = this.paragraphSelect.options.find(o => o.value === activeValue);
        this.paragraphSelect.labelSpan.innerText = activeOption ? activeOption.label : 'Paragraph Style';

        // Update Selection State
        const items = this.paragraphSelect.dropdown.querySelectorAll('.colophon-select-item');
        items.forEach(item => {
            if (item.dataset.value === activeValue) {
                item.addClass('is-selected');
            } else {
                item.removeClass('is-selected');
            }
        });
    }

    updateListSelect() {
        if (!this.listSelect) return;

        let activeValue = 'none';

        for (const opt of (this.listOptions || [])) {
            const value = opt.value;
            if (value === 'none') continue;

            const listType = opt.listType || 'unordered';
            const nodeType = listType === 'ordered' ? 'orderedList' : 'bulletList';

            if (this.editor.isActive(nodeType, { class: value })) {
                activeValue = value;
                break;
            }
        }

        const activeOption = this.listSelect.options.find(o => o.value === activeValue);
        this.listSelect.labelSpan.innerText = activeOption ? activeOption.label : 'List Style';

        // Update Selection State
        const items = this.listSelect.dropdown.querySelectorAll('.colophon-select-item');
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

    show(targetRect) {
        // Check if el exists and is connected to DOM
        if (!this.el || !this.el.isConnected) {
            if (this.el) this.el.remove(); // Cleanup detached element
            this.create();
            this.setMode(this.currentMode); // Re-apply mode
        }

        // Update States
        this.updateSelectMenu();
        this.updateButtonStates();

        // Ensure element is visible to measure dimensions
        this.el.addClass('is-visible');
        this.isVisible = true;

        // Measure dimensions
        const popoverWidth = this.el.offsetWidth;
        const popoverHeight = this.el.offsetHeight;
        const containerWidth = this.containerEl.offsetWidth;

        // Calculate centered position
        // Center horizontally relative to selection center
        let left = targetRect.left + (targetRect.width / 2) - (popoverWidth / 2);

        // Position above by default
        let top = targetRect.top - popoverHeight - 10; // 10px padding above

        // Boundary Checks (Inward from edges of VISIBLE viewport)
        const padding = 10; // Minimum distance from edge
        const scrollTop = this.containerEl.scrollTop;
        const scrollLeft = this.containerEl.scrollLeft;

        // Check Left/Right
        if (left < scrollLeft + padding) {
            left = scrollLeft + padding;
        } else if (left + popoverWidth > scrollLeft + containerWidth - padding) {
            left = scrollLeft + containerWidth - popoverWidth - padding;
        }

        // Check Top (If it goes off top of visible area, flip to below)
        if (top < scrollTop + padding) {
            top = targetRect.top + targetRect.height + 10;
        }

        this.el.style.left = `${left}px`;
        this.el.style.top = `${top}px`;

        // Add global click listener to close
        document.addEventListener('click', this.handleClickOutside);
    }

    hide() {
        if (this.el) {
            this.el.removeClass('is-visible');
            this.isVisible = false;
            document.removeEventListener('click', this.handleClickOutside);

            // Close dropdowns if open
            if (this.paragraphSelect && this.paragraphSelect.dropdown) {
                this.paragraphSelect.dropdown.style.display = 'none';
            }
            if (this.listSelect && this.listSelect.dropdown) {
                this.listSelect.dropdown.style.display = 'none';
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
