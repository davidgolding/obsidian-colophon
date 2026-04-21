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
        this.containerEl = document.createElement('div');
        this.containerEl.className = 'colophon-find-replace-bar';
        this.containerEl.setAttribute('style', 'display: none;');

        // Single row horizontal layout
        const mainRow = this.containerEl.createDiv({ cls: 'cfr-main-row' });

        // Left Section: Find
        const findSection = mainRow.createDiv({ cls: 'cfr-section cfr-find-section' });
        this.findInput = findSection.createEl('input', {
            type: 'text',
            placeholder: 'Find...',
            cls: 'cfr-input'
        });
        
        this.searchInfo = findSection.createDiv({ cls: 'cfr-info', text: '0 of 0' });

        const findControls = findSection.createDiv({ cls: 'cfr-button-group' });
        this.prevBtn = findControls.createEl('button', { cls: 'cfr-button', attr: { 'tabindex': '-1' } });
        setIcon(this.prevBtn, 'chevron-up');
        this.nextBtn = findControls.createEl('button', { cls: 'cfr-button', attr: { 'tabindex': '-1' } });
        setIcon(this.nextBtn, 'chevron-down');

        const optionsGroup = findSection.createDiv({ cls: 'cfr-button-group' });
        this.caseBtn = optionsGroup.createEl('button', { cls: 'cfr-button', text: 'Aa', title: 'Match Case', attr: { 'tabindex': '-1' } });
        this.regexBtn = optionsGroup.createEl('button', { cls: 'cfr-button', text: '.*', title: 'Use Regular Expression', attr: { 'tabindex': '-1' } });
        this.wordBtn = optionsGroup.createEl('button', { cls: 'cfr-button', text: '""', title: 'Match Whole Word', attr: { 'tabindex': '-1' } });

        // Middle Section: Replace
        const replaceSection = mainRow.createDiv({ cls: 'cfr-section cfr-replace-section' });
        this.replaceInput = replaceSection.createEl('input', {
            type: 'text',
            placeholder: 'Replace...',
            cls: 'cfr-input'
        });

        const replaceActions = replaceSection.createDiv({ cls: 'cfr-button-group' });
        this.replaceBtn = replaceActions.createEl('button', { cls: 'cfr-button', text: 'Replace', attr: { 'tabindex': '-1' } });
        this.replaceAllBtn = replaceActions.createEl('button', { cls: 'cfr-button', text: 'Replace All', attr: { 'tabindex': '-1' } });

        // Right Section: Close
        this.closeBtn = mainRow.createEl('button', { cls: 'cfr-button cfr-close', attr: { 'tabindex': '-1' } });
        setIcon(this.closeBtn, 'x');

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

        this.replaceInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.replace();
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
        const searchStorage = this.view.adapter.editor.storage.search;
        const count = searchStorage.results.length;
        const current = count > 0 ? searchStorage.activeIndex + 1 : 0;
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
        this.containerEl.setAttribute('style', 'display: flex;');
        this.findInput.focus();
        this.findInput.select();
        this.updateSearch();
    }

    openReplace() {
        this.isVisible = true;
        this.containerEl.setAttribute('style', 'display: flex;');
        this.replaceInput.focus();
        this.replaceInput.select();
        this.updateSearch();
    }

    close() {
        this.isVisible = false;
        this.containerEl.setAttribute('style', 'display: none;');
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
