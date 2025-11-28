const { Modal, Setting } = require('obsidian');

class ExportModal extends Modal {
    constructor(app, onExport) {
        super(app);
        this.onExport = onExport;
        this.settings = {
            pageSize: 'Letter',
            margins: { top: 1, bottom: 1, left: 1, right: 1 },
            scale: 100
        };
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        new Setting(contentEl)
            .setName('Export to Word (.docx)')
            .setHeading();
        
        const persist = () => void this.saveSettings();
        
        new Setting(contentEl)
            .setName('Page size')
            .setDesc('Select the page size for the exported document.')
            .addDropdown(dropdown => { dropdown
                .addOption('Letter', 'Letter (8.5" x 11")')
                .addOption('Legal', 'Legal (8.5" x 14")')
                .addOption('A1', 'A1 (210mm x 297mm')
                .setValue(this.settings.pageSize)
                .onChange(value => {
                    this.settings.pageSize = value;
                });
            });
        
        new Setting(contentEl)
            .setName('Margins')
            .setHeading();
        
        // Keep margins inside a standard Setting row (consistent spacing + alignment).
        const marginsSetting = new Setting(contentEl)
            .setName('Margins (inches)')
        
        marginsSetting.settingEl.addClass('colophon-export-margins');
        
        const grid = marginsSetting.controlEl.createDiv({
            cls: 'colophon-export-margins__grid',
        });
        
        const addMarginField = (label, key) => {
            const field = grid.createDiv({ cls: 'colophon-export-margins__field' });
            field.createDiv({ text: label, cls: 'colophon-export-margins__label' });
        
            const input = field.createEl('input', { type: 'number' });
            input.addClass('colophon-export-margins__input');
            input.step = '0.1';
        
            input.value = String(this.settings.margins?.[key] ?? 1);
        
            input.addEventListener('change', () => {
            const num = Number.parseFloat(input.value);
            if (!Number.isFinite(num)) return;
        
            this.settings.margins[key] = num;
            persist();
            });
        };
        
        addMarginField('Top', 'top');
        addMarginField('Right', 'right');
        addMarginField('Bottom', 'bottom');
        addMarginField('Left', 'left');
        
        new Setting(contentEl)
            .setName('Scale (%)')
            .setDesc('Adjust the font size scale for the exported document.')
            .addSlider(slider => {
            slider
                .setLimits(50, 200, 5)
                .setValue(this.settings.scale)
                .setDynamicTooltip()
                .onChange(value => {
                this.settings.scale = value;
                persist();
                });
            });
        
        new Setting(contentEl)
            .setName('Export')
            .setDesc('Generate a .docx using the settings above.')
            .addButton(btn => {
            btn
                .setButtonText('Export')
                .setCta()
                .onClick(() => {
                this.close();
                this.onExport(this.settings);
                });
            });
        }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

module.exports = ExportModal;
