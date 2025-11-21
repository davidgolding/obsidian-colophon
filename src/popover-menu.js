const { setIcon } = require('obsidian');

class PopoverMenu {
    constructor(editor, containerEl) {
        this.editor = editor;
        this.containerEl = containerEl;
        this.el = null;
        this.isVisible = false;

        // Bind methods
        this.handleClickOutside = this.handleClickOutside.bind(this);
    }

    create() {
        this.el = document.createElement('div');
        this.el.addClass('colophon-popover');
        this.containerEl.appendChild(this.el);

        // Section 1: Styles (Headings)
        const styleSection = this.el.createDiv('colophon-popover-section');
        this.createButton(styleSection, 'Heading 1', 'h1', () => this.editor.chain().focus().toggleHeading({ level: 1 }).run());
        this.createButton(styleSection, 'Heading 2', 'h2', () => this.editor.chain().focus().toggleHeading({ level: 2 }).run());
        this.createButton(styleSection, 'Heading 3', 'h3', () => this.editor.chain().focus().toggleHeading({ level: 3 }).run());
        this.createButton(styleSection, 'Body', 'pilcrow', () => this.editor.chain().focus().setParagraph().run());

        // Section 2: Formatting
        const formatSection = this.el.createDiv('colophon-popover-section');
        this.createIconButton(formatSection, 'bold', () => this.editor.chain().focus().toggleBold().run(), 'isActive', 'bold');
        this.createIconButton(formatSection, 'italic', () => this.editor.chain().focus().toggleItalic().run(), 'isActive', 'italic');
        this.createIconButton(formatSection, 'underline', () => this.editor.chain().focus().toggleUnderline().run(), 'isActive', 'underline');
        this.createIconButton(formatSection, 'strikethrough', () => this.editor.chain().focus().toggleStrike().run(), 'isActive', 'strike');

        // Section 3: Advanced Formatting
        const advancedSection = this.el.createDiv('colophon-popover-section');
        this.createIconButton(advancedSection, 'superscript', () => this.editor.chain().focus().toggleSuperscript().run(), 'isActive', 'superscript');
        this.createIconButton(advancedSection, 'subscript', () => this.editor.chain().focus().toggleSubscript().run(), 'isActive', 'subscript');
        // Custom Small Caps icon/button
        const smallCapsBtn = this.createIconButton(advancedSection, 'type', () => this.editor.chain().focus().toggleSmallCaps().run(), 'isActive', 'smallCaps');
        smallCapsBtn.setAttribute('aria-label', 'Small Caps');

        // Footnote Button
        const footnoteBtn = this.createIconButton(advancedSection, 'footprints', () => this.editor.chain().focus().addFootnote().run());
        footnoteBtn.setAttribute('aria-label', 'Add Footnote');
    }

    createButton(parent, text, icon, action) {
        const btn = parent.createEl('button', { cls: 'colophon-popover-item' });
        if (icon) {
            const iconSpan = btn.createSpan('colophon-popover-icon');
            setIcon(iconSpan, icon);
        }
        btn.createSpan({ text: text });
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            action();
            this.hide();
        });
        return btn;
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

        // Optional: Check active state logic could go here if we were updating live, 
        // but for a context menu, it's static at open time usually.
        // However, we can check state when opening.

        return btn;
    }

    show(x, y) {
        if (!this.el) this.create();

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
