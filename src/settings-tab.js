import { PluginSettingTab, Setting } from 'obsidian';
import { BlockSettingsUI } from './ui/block-settings';

export class ColophonSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Colophon Settings' });

        // --- Plugin Settings Group ---
        const pluginSettingsGroup = containerEl.createDiv({ cls: 'setting-group' });
        const pluginSettingsItems = pluginSettingsGroup.createDiv({ cls: 'setting-items' });

        new Setting(pluginSettingsItems)
            .setName('Global scale')
            .setDesc('Scale all typographic units (pt, in, etc.) relative to Obsidian\'s text size. 12pt = (Scale * Obsidian Text Size).')
            .addSlider(slider => slider
                .setLimits(0.5, 2.0, 0.1)
                .setValue(this.plugin.settings.globalScale || 1.0)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.globalScale = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(pluginSettingsItems)
            .setName('Text column width')
            .setDesc('Adjust the width of the writing canvas (500px - 1240px).')
            .addSlider(slider => slider
                .setLimits(500, 1240, 10)
                .setValue(this.plugin.settings.textColumnWidth)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.textColumnWidth = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(pluginSettingsItems)
            .setName('Fixed feed position')
            .setDesc('Enforce a typewriter-style fixed active line position.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.fixedFeedPosition)
                .onChange(async (value) => {
                    this.plugin.settings.fixedFeedPosition = value;
                    await this.plugin.saveSettings();
                    this.display();
                }));

        if (this.plugin.settings.fixedFeedPosition) {
            new Setting(pluginSettingsItems)
                .setName('Feed padding')
                .setDesc('Vertical position of the active line (0% = bottom, 75% = top quarter).')
                .addSlider(slider => slider
                    .setLimits(0, 75, 1)
                    .setValue(this.plugin.settings.feedPadding)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.feedPadding = value;
                        await this.plugin.saveSettings();
                    }));
        }

        // Substitution Settings
        new Setting(pluginSettingsItems)
            .setName('Smart quotes')
            .setDesc('Automatically replace straight quotes with smart quotes.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.smartQuotes)
                .onChange(async (value) => {
                    this.plugin.settings.smartQuotes = value;
                    await this.plugin.saveSettings();
                    this.display(); // Refresh to show/hide sub-options
                }));

        if (this.plugin.settings.smartQuotes) {
            new Setting(pluginSettingsItems)
                .setName('Double quote style')
                .setDesc('Choose the style for double quotes.')
                .addDropdown(dropdown => dropdown
                    .addOption('“|”', '“abc”')
                    .addOption('„|“', '„abc“')
                    .addOption('„|”', '„abc”')
                    .addOption('”|”', '”abc”')
                    .addOption('«|»', '«abc»')
                    .addOption('»|«', '»abc«')
                    .addOption('"|"', '"abc"')
                    .setValue(this.plugin.settings.doubleQuoteStyle)
                    .onChange(async (value) => {
                        this.plugin.settings.doubleQuoteStyle = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(pluginSettingsItems)
                .setName('Single quote style')
                .setDesc('Choose the style for single quotes.')
                .addDropdown(dropdown => dropdown
                    .addOption('‘|’', '‘abc’')
                    .addOption('‚|‘', '‚abc‘')
                    .addOption('‚|’', '‚abc’')
                    .addOption('’|’', '’abc’')
                    .addOption('‹|›', '‹abc›')
                    .addOption('›|‹', '›abc‹')
                    .addOption('\'|\'', '\'abc\'')
                    .setValue(this.plugin.settings.singleQuoteStyle)
                    .onChange(async (value) => {
                        this.plugin.settings.singleQuoteStyle = value;
                        await this.plugin.saveSettings();
                    }));
        }

        new Setting(pluginSettingsItems)
            .setName('Smart dashes')
            .setDesc('Replace -- with em-dash (—) and --- with en-dash (–).')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.smartDashes)
                .onChange(async (value) => {
                    this.plugin.settings.smartDashes = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(pluginSettingsItems)
            .setName('Footnote trigger')
            .setDesc('Syntax trigger to insert a footnote. Default: "(("')
            .addText(text => text
                .setPlaceholder('((')
                .setValue(this.plugin.settings.footnoteTrigger)
                .onChange(async (value) => {
                    this.plugin.settings.footnoteTrigger = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(pluginSettingsItems)
            .setName('Sidebar location')
            .setDesc('Where to show footnotes and comments: in the document or the global sidebar.')
            .addDropdown(dropdown => dropdown
                .addOption('local', 'In Document')
                .addOption('global', 'Global Sidebar')
                .setValue(this.plugin.settings.sidebarLocation || 'local')
                .onChange(async (value) => {
                    this.plugin.settings.sidebarLocation = value;
                    await this.plugin.saveSettings();
                    if (this.plugin.refreshLayout) {
                        this.plugin.refreshLayout();
                    }
                }));


        // --- Block Settings Group ---
        const blockSettingsGroup = containerEl.createDiv({ cls: 'setting-group' });
        const blockSettingsItems = blockSettingsGroup.createDiv({ cls: 'setting-items' });

        // Placeholder for future Block Settings
        // Render Block Settings UI
        const blockSettingsUI = new BlockSettingsUI(this.plugin, blockSettingsItems);
        blockSettingsUI.display();
    }
}
