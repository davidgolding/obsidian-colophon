import { Modal, Setting } from 'obsidian';

export class ExportModal extends Modal {
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
        
        new Setting(contentEl)
            .setName('Page size')
            .setDesc('Select the page size for the exported document.')
            .addDropdown(dropdown => { dropdown
                .addOption('Letter', 'Letter (8.5" x 11")')
                .addOption('Legal', 'Legal (8.5" x 14")')
                .addOption('A4', 'A4 (210mm x 297mm)')
                .setValue(this.settings.pageSize)
                .onChange(value => {
                    this.settings.pageSize = value;
                });
            });
        
        new Setting(contentEl)
            .setName('Margins')
            .setHeading();
        
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
            input.min = '0';
            input.max = '5';
        
            input.value = String(this.settings.margins?.[key] ?? 1);
        
            input.addEventListener('change', () => {
                let num = parseFloat(input.value);
                if (!isNaN(num)) {
                    // Clamp value
                    num = Math.max(0, Math.min(5, num));
                    input.value = String(num);
                    this.settings.margins[key] = num;
                }
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
