import { setIcon } from 'obsidian';

export class FindReplaceBar {
    constructor(view, parentEl) {
        this.view = view;
        this.parentEl = parentEl;
        this.isVisible = false;
        this.caseSensitive = false;
        this.useRegex = false;
        this.wholeWord = false;

        this.render();
    }

    render() {
        this.containerEl = this.parentEl.createDiv({ cls: 'colophon-find-replace-bar' });
        this.containerEl.style.display = 'none';

        const topRow = this.containerEl.createDiv({ cls: 'cfr-row' });
        
        // Find Input
        this.findInput = topRow.createEl('input', {
            type: 'text',
            placeholder: 'Find...',
            cls: 'cfr-input'
        });

        // Search Info (e.g., 1 of 10)
        this.searchInfo = topRow.createDiv({ cls: 'cfr-info', text: '0 of 0' });

        // Navigation
        const navGroup = topRow.createDiv({ cls: 'cfr-button-group' });
        this.prevBtn = navGroup.createEl('button', { cls: 'cfr-button' });
        setIcon(this.prevBtn, 'chevron-up');
        this.nextBtn = navGroup.createEl('button', { cls: 'cfr-button' });
        setIcon(this.nextBtn, 'chevron-down');

        // Options
        const optionsGroup = topRow.createDiv({ cls: 'cfr-button-group' });
        this.caseBtn = optionsGroup.createEl('button', { cls: 'cfr-button', text: 'Aa', title: 'Match Case' });
        this.regexBtn = optionsGroup.createEl('button', { cls: 'cfr-button', text: '.*', title: 'Use Regular Expression' });
        this.wordBtn = optionsGroup.createEl('button', { cls: 'cfr-button', text: '""', title: 'Match Whole Word' });

        this.closeBtn = topRow.createEl('button', { cls: 'cfr-button cfr-close' });
        setIcon(this.closeBtn, 'x');

        const bottomRow = this.containerEl.createDiv({ cls: 'cfr-row' });

        // Replace Input
        this.replaceInput = bottomRow.createEl('input', {
            type: 'text',
            placeholder: 'Replace...',
            cls: 'cfr-input'
        });

        const replaceGroup = bottomRow.createDiv({ cls: 'cfr-button-group' });
        this.replaceBtn = replaceGroup.createEl('button', { cls: 'cfr-button', text: 'Replace' });
        this.replaceAllBtn = replaceGroup.createEl('button', { cls: 'cfr-button', text: 'Replace All' });

        this.setupEvents();
    }

    setupEvents() {
        this.findInput.addEventListener('input', () => this.updateSearch());
        this.findInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (e.shiftKey) this.prev();
                else this.next();
            } else if (e.key === 'Escape') {
                this.close();
            }
        });

        this.nextBtn.addEventListener('click', () => this.next());
        this.prevBtn.addEventListener('click', () => this.prev());

        this.caseBtn.addEventListener('click', () => {
            this.caseSensitive = !this.caseSensitive;
            this.caseBtn.toggleClass('is-active', this.caseSensitive);
            this.updateSearch();
        });

        this.regexBtn.addEventListener('click', () => {
            this.useRegex = !this.useRegex;
            this.regexBtn.toggleClass('is-active', this.useRegex);
            this.updateSearch();
        });

        this.wordBtn.addEventListener('click', () => {
            this.wholeWord = !this.wholeWord;
            this.wordBtn.toggleClass('is-active', this.wholeWord);
            this.updateSearch();
        });

        this.replaceBtn.addEventListener('click', () => this.replace());
        this.replaceAllBtn.addEventListener('click', () => this.replaceAll());
        this.closeBtn.addEventListener('click', () => this.close());
    }

    updateSearch() {
        const query = this.findInput.value;
        if (this.view.adapter && this.view.adapter.editor) {
            this.view.adapter.editor.commands.setSearchOptions({
                caseSensitive: this.caseSensitive,
                disableRegex: !this.useRegex,
                wholeWord: this.wholeWord
            });
            this.view.adapter.editor.commands.setSearchQuery(query);
            this.updateInfo();
        }
    }

    updateInfo() {
        if (!this.view.adapter || !this.view.adapter.editor) return;
        const storage = this.view.adapter.editor.storage.search;
        const count = storage.results.length;
        const current = count > 0 ? storage.activeIndex + 1 : 0;
        this.searchInfo.setText(`${current} of ${count}`);
    }

    next() {
        if (this.view.adapter && this.view.adapter.editor) {
            this.view.adapter.editor.commands.nextSearchResult();
            this.updateInfo();
        }
    }

    prev() {
        if (this.view.adapter && this.view.adapter.editor) {
            this.view.adapter.editor.commands.previousSearchResult();
            this.updateInfo();
        }
    }

    replace() {
        const replaceWith = this.replaceInput.value;
        if (this.view.adapter && this.view.adapter.editor) {
            this.view.adapter.editor.commands.replace(replaceWith);
            this.updateInfo();
        }
    }

    replaceAll() {
        const replaceWith = this.replaceInput.value;
        if (this.view.adapter && this.view.adapter.editor) {
            this.view.adapter.editor.commands.replaceAll(replaceWith);
            this.updateInfo();
        }
    }

    open() {
        this.isVisible = true;
        this.containerEl.style.display = 'flex';
        this.findInput.focus();
        this.findInput.select();
        this.updateSearch();
    }

    close() {
        this.isVisible = false;
        this.containerEl.style.display = 'none';
        if (this.view.adapter && this.view.adapter.editor) {
            this.view.adapter.editor.commands.setSearchQuery('');
            this.view.adapter.editor.commands.focus();
        }
    }

    toggle() {
        if (this.isVisible) this.close();
        else this.open();
    }
}
