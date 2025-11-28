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

        contentEl.createEl('h2', { text: 'Export to DOCX' });

        new Setting(contentEl)
            .setName('Page size')
            .setDesc('Select the page size for the exported document.')
            .addDropdown(dropdown => dropdown
                .addOption('Letter', 'Letter (8.5" x 11")')
                .addOption('A4', 'A4 (210mm x 297mm)')
                .addOption('Legal', 'Legal (8.5" x 14")')
                .setValue(this.settings.pageSize)
                .onChange(value => this.settings.pageSize = value));

        contentEl.createEl('h3', { text: 'Margins (inches)' });
        const marginDiv = contentEl.createDiv({ cls: 'colophon-export-margins' });
        marginDiv.style.display = 'grid';
        marginDiv.style.gridTemplateColumns = '1fr 1fr';
        marginDiv.style.gap = '10px';
        marginDiv.style.marginBottom = '20px';

        ['top', 'bottom', 'left', 'right'].forEach(side => {
            new Setting(marginDiv)
                .setName(side.charAt(0).toUpperCase() + side.slice(1))
                .addText(text => text
                    .setValue(String(this.settings.margins[side]))
                    .onChange(value => {
                        const num = parseFloat(value);
                        if (!isNaN(num)) this.settings.margins[side] = num;
                    }));
        });

        new Setting(contentEl)
            .setName('Scale (%)')
            .setDesc('Adjust the font size scale for the exported document.')
            .addSlider(slider => slider
                .setLimits(50, 200, 5)
                .setValue(this.settings.scale)
                .setDynamicTooltip()
                .onChange(value => this.settings.scale = value));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Export')
                .setCta()
                .onClick(() => {
                    this.close();
                    this.onExport(this.settings);
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

module.exports = ExportModal;
