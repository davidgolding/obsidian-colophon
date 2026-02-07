import { Setting, ButtonComponent, TextComponent, DropdownComponent, ColorComponent, SliderComponent, Notice } from 'obsidian';
import { DEFAULT_SETTINGS } from '../settings-data';

export class BlockSettingsUI {
    constructor(plugin, containerEl) {
        this.plugin = plugin;
        this.containerEl = containerEl;
        this.blockSettingsContainer = null;
    }

    display() {
        this.containerEl.empty();
        this.containerEl.addClass('colophon-block-settings');

        // Header
        new Setting(this.containerEl)
            .setName('Block Definitions')
            .setHeading();

        this.blockSettingsContainer = this.containerEl.createDiv('colophon-block-list');
        this.renderBlockList();

        // Add New Block Button
        new Setting(this.containerEl)
            .setName('Add Custom Block')
            .setDesc('Create a new block type with a unique ID.')
            .addButton(btn => btn
                .setButtonText('Add Block')
                .setCta()
                .onClick(() => {
                    this.addNewBlock();
                }));
    }

    renderBlockList() {
        this.blockSettingsContainer.empty();
        const blocks = this.plugin.settings.blocks;

        // Sort: Defaults first (in order of default keys if possible, or alphabetical), then custom
        // For simplicity, let's just sort alphabetically for now, or maybe group them.
        // Let's stick to the order in the settings object for now.

        for (const [blockId, blockData] of Object.entries(blocks)) {
            this.renderBlockRow(blockId, blockData);
        }
    }

    renderBlockRow(blockId, blockData) {
        const isDefault = DEFAULT_SETTINGS.blocks.hasOwnProperty(blockId);

        const detailsEl = this.blockSettingsContainer.createEl('details', { cls: 'colophon-block-row' });
        const summaryEl = detailsEl.createEl('summary');

        // Block Header (Summary)
        const headerSetting = new Setting(summaryEl)
            .setName(blockData.name || blockId)
            .setDesc(isDefault ? 'Default Block' : 'Custom Block');

        // Delete Button (only for custom blocks)
        if (!isDefault) {
            headerSetting.addExtraButton(btn => btn
                .setIcon('trash')
                .setTooltip('Delete Block')
                .onClick(async (e) => {
                    e.stopPropagation(); // Prevent toggling details
                    if (confirm(`Are you sure you want to delete the block "${blockData.name}"?`)) {
                        delete this.plugin.settings.blocks[blockId];
                        await this.plugin.saveSettings();
                        this.renderBlockList();
                    }
                }));
        }

        // Expanded Content
        const contentEl = detailsEl.createDiv('colophon-block-content');

        // 1. Metadata: Name, Hotkey, Syntax
        new Setting(contentEl)
            .setName('Name')
            .addText(text => text
                .setValue(blockData.name || '')
                .onChange(async (value) => {
                    this.plugin.settings.blocks[blockId].name = value;
                    headerSetting.setName(value); // Update header immediately
                    await this.plugin.saveSettings();
                }));

        // Syntax Trigger
        new Setting(contentEl)
            .setName('Syntax Trigger')
            .setDesc('Text that triggers this block (e.g. "### ").')
            .addText(text => text
                .setValue(blockData['syntax-trigger'] || '')
                .onChange(async (value) => {
                    if (value) {
                        this.plugin.settings.blocks[blockId]['syntax-trigger'] = value;
                    } else {
                        delete this.plugin.settings.blocks[blockId]['syntax-trigger'];
                    }
                    await this.plugin.saveSettings();
                }));

        // Hotkey (Placeholder - requires command registration logic to be fully functional, 
        // usually handled by registering a command and letting Obsidian manage hotkeys.
        // For this UI spec, we might need a custom hotkey recorder or just a text field for now?)
        // The spec says: "The hotkey trigger uses the same settings interface as the “Hotkeys” global settings in Obsidian."
        // This usually implies we should register a command for each block and let the user set it in regular Hotkeys.
        // However, if we want it inline... Obsidian doesn't export the Hotkey recorder component easily.
        // Let's add a note or a simple text field for "Command ID" reference if we register them dynamically.
        // Actually, for a v1 implementation let's skip the complex hotkey recorder UI and rely on Obsidian's Hotkey tab 
        // IF we register commands for these blocks. 
        // Re-reading spec: "This is to provide the user with the option of assigning a hotkey... that ... will apply the corresponding block entity"
        // If we register commands like "Colophon: Apply Body", "Colophon: Apply Title", users can set hotkeys in Obsidian settings.
        // Displaying a link to that might be best. 
        // Spec: "This new feature will expose those settings... The hotkey trigger uses the same settings interface..."
        // Implementing a full hotkey recorder here is complex. I'll add a placeholder or a simple key combination text field if desired, 
        // but robustly, we should just ensure commands exist.
        // Let's leave a visual placeholder for now.


        // 2. Properties
        contentEl.createEl('h4', { text: 'Typography & Behavior' });

        const propertiesContainer = contentEl.createDiv('colophon-block-properties');

        // Add Property UI
        const addPropContainer = contentEl.createDiv('colophon-add-property');
        this.renderAddProperty(addPropContainer, blockId, propertiesContainer);

        // Render Existing Properties
        this.renderProperties(propertiesContainer, blockId);
    }

    renderProperties(container, blockId) {
        container.empty();
        const blockData = this.plugin.settings.blocks[blockId];

        // Filter out metadata keys
        const metaKeys = ['name', 'syntax-trigger', 'hotkey'];

        const sortedKeys = Object.keys(blockData)
            .filter(k => !metaKeys.includes(k))
            .sort();

        for (const key of sortedKeys) {
            this.renderPropertyRow(container, blockId, key, blockData[key]);
        }
    }

    renderPropertyRow(container, blockId, key, value) {
        const row = container.createDiv('colophon-property-row');

        // Property Label
        const label = row.createDiv('colophon-property-label');
        label.setText(key);

        // Value Input (Dynamic based on type)
        const inputContainer = row.createDiv('colophon-property-input');
        this.renderField(inputContainer, blockId, key, value);

        // Delete Button
        const deleteBtn = new ButtonComponent(row)
            .setIcon('trash')
            .setTooltip('Remove Property')
            .onClick(async () => {
                delete this.plugin.settings.blocks[blockId][key];
                await this.plugin.saveSettings();
                this.renderProperties(container, blockId);
            });
        deleteBtn.buttonEl.addClass('colophon-property-delete');
    }

    renderAddProperty(container, blockId, listContainer) {
        container.empty();

        const allProperties = [
            'after-block', 'before-block', 'capitalization', 'color', 'first-indent',
            'following-entity', 'font-family', 'font-size', 'font-variant',
            'inline-spacing', 'left-indent', 'line-spacing', 'list-type',
            'marker', 'marker-baseline', 'marker-indent', 'marker-outdent',
            'marker-size', 'marker-suffix', 'right-indent', 'space-between-notes',
            'text-align', 'font-style', 'font-weight', 'text-transform' // Added legacy ones for safety
        ];

        const existingKeys = Object.keys(this.plugin.settings.blocks[blockId]);
        const availableOptions = allProperties.filter(p => !existingKeys.includes(p)).sort();

        if (availableOptions.length === 0) {
            container.createDiv({ text: 'All properties added.', cls: 'colophon-text-muted' });
            return;
        }

        const wrapper = container.createDiv('colophon-add-prop-wrapper');
        let selectedProp = availableOptions[0];

        new DropdownComponent(wrapper)
            .addOptions(availableOptions.reduce((acc, curr) => ({ ...acc, [curr]: curr }), {}))
            .setValue(selectedProp)
            .onChange(val => selectedProp = val);

        new ButtonComponent(wrapper)
            .setButtonText('Add Property')
            .onClick(async () => {
                // Initialize with a default value based on type?
                this.plugin.settings.blocks[blockId][selectedProp] = this.getDefaultValueFor(selectedProp);
                await this.plugin.saveSettings();
                this.renderProperties(listContainer, blockId);
                // Re-render add row to update options
                this.renderAddProperty(container, blockId, listContainer);
            });
    }

    getDefaultValueFor(key) {
        if (key.includes('color')) return '#000000';
        if (key.includes('list-type')) return 'unordered';
        if (key.includes('align')) return 'left';
        if (key.includes('capitalization')) return 'none';
        return '0pt'; // Fallback for measurements
    }

    renderField(container, blockId, key, value) {
        // --- 1. Measurement Fields (Number + Unit) ---
        if (['after-block', 'before-block', 'first-indent', 'font-size', 'inline-spacing',
            'left-indent', 'line-spacing', 'marker-baseline', 'marker-indent',
            'marker-outdent', 'right-indent', 'space-between-notes'].includes(key)) {

            this.renderMeasurementField(container, blockId, key, value);
            return;
        }

        // --- 2. Color ---
        if (key === 'color') {
            const colorPicker = new ColorComponent(container)
                .setValue(value)
                .onChange(async (val) => {
                    this.plugin.settings.blocks[blockId][key] = val;
                    await this.plugin.saveSettings();
                });
            return;
        }

        // --- 3. Select Menus ---

        // Capitalization
        if (key === 'capitalization') {
            new DropdownComponent(container)
                .addOptions({
                    'none': 'None',
                    'small-caps': 'Small Caps',
                    'all-caps': 'All Caps'
                })
                .setValue(value)
                .onChange(async (val) => {
                    this.plugin.settings.blocks[blockId][key] = val;
                    await this.plugin.saveSettings();
                });
            return;
        }

        // List Type
        if (key === 'list-type') {
            new DropdownComponent(container)
                .addOptions({
                    'none': 'None',
                    'ordered': 'Ordered',
                    'unordered': 'Unordered'
                })
                .setValue(value)
                .onChange(async (val) => {
                    this.plugin.settings.blocks[blockId][key] = val;
                    await this.plugin.saveSettings();
                });
            return;
        }

        // Align
        if (key === 'text-align') {
            new DropdownComponent(container)
                .addOptions({
                    'left': 'Left',
                    'center': 'Center',
                    'right': 'Right',
                    'justify': 'Justify'
                })
                .setValue(value)
                .onChange(async (val) => {
                    this.plugin.settings.blocks[blockId][key] = val;
                    await this.plugin.saveSettings();
                });
            return;
        }

        // Marker
        if (key === 'marker') {
            new DropdownComponent(container)
                .addOptions({
                    'disc': '• Disc',
                    'circle': '° Circle',
                    'square': '■ Square',
                    'decimal': '1, 2, 3',
                    'lower-roman': 'i, ii, iii',
                    'upper-roman': 'I, II, III',
                    'lower-latin': 'a, b, c',
                    'upper-latin': 'A, B, C',
                    'none': 'None'
                })
                .setValue(value)
                .onChange(async (val) => {
                    this.plugin.settings.blocks[blockId][key] = val;
                    await this.plugin.saveSettings();
                });
            return;
        }

        // --- 4. Default Text Input ---
        // (following-entity, font-family, font-variant, marker-suffix, marker-size (percent string))
        new TextComponent(container)
            .setValue(String(value))
            .onChange(async (val) => {
                this.plugin.settings.blocks[blockId][key] = val;
                await this.plugin.saveSettings();
            });
    }

    renderMeasurementField(container, blockId, key, value) {
        // Parse value: "12pt", "1.5", "10px"
        // Regex to separate num and unit
        const match = String(value).match(/^([\d.-]+)([a-z%]+)?$/);
        const num = match ? match[1] : value;
        const unit = match ? match[2] : ''; // Default to empty if no unit (multiplier)

        const wrapper = container.createDiv('colophon-measurement-wrapper');

        // Number Input
        const numInput = new TextComponent(wrapper)
            .setValue(num)
            .onChange(async (val) => {
                const currentUnit = unitSelect.getValue();
                const newValue = val + currentUnit;
                this.plugin.settings.blocks[blockId][key] = newValue;
                await this.plugin.saveSettings();
            });
        numInput.inputEl.style.width = '60px';

        // Unit Select
        const unitSelect = new DropdownComponent(wrapper)
            .addOptions({
                '': 'x', // Multiplier/None
                'pt': 'pt',
                'pc': 'pc',
                'in': 'in',
                'cm': 'cm',
                'mm': 'mm',
                'px': 'px',
                'em': 'em',
                'rem': 'rem',
                '%': '%'
            })
            .setValue(unit || '')
            .onChange(async (val) => {
                const currentNum = numInput.getValue();
                const newValue = currentNum + val;
                this.plugin.settings.blocks[blockId][key] = newValue;
                await this.plugin.saveSettings();
            });
    }

    addNewBlock() {
        // Simple prompt for now, could be a model
        const id = prompt('Enter a unique ID for the new block (e.g., "quote", "sidebar-note"):');
        if (id) {
            const sanitizedId = id.toLowerCase().replace(/[^a-z0-9-]/g, '-');
            if (this.plugin.settings.blocks[sanitizedId]) {
                alert('Block ID already exists.');
                return;
            }

            this.plugin.settings.blocks[sanitizedId] = {
                name: id, // Default name same as ID
                'font-family': 'inherit',
                'font-size': '11pt',
                'line-spacing': '14pt'
            };
            this.plugin.saveSettings().then(() => {
                this.renderBlockList();
            });
        }
    }
}
