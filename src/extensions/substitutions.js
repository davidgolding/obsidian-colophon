const { Extension, InputRule } = require('@tiptap/core');

const Substitutions = Extension.create({
    name: 'substitutions',

    addOptions() {
        return {
            smartQuotes: true,
            smartDashes: true,
            doubleQuoteStyle: '“|”',
            singleQuoteStyle: '‘|’',
        }
    },

    addInputRules() {
        const rules = [];

        if (this.options.smartDashes) {
            // Em-dash (--- -> —)
            rules.push(new InputRule({
                find: /---\s$/,
                handler: ({ state, range }) => {
                    return state.tr.insertText('— ', range.from, range.to);
                },
            }));
            // En-dash (-- -> –)
            rules.push(new InputRule({
                find: /--\s$/,
                handler: ({ state, range }) => {
                    return state.tr.insertText('– ', range.from, range.to);
                },
            }));
        }

        if (this.options.smartQuotes) {
            const [openDouble, closeDouble] = this.options.doubleQuoteStyle.split('|');
            const [openSingle, closeSingle] = this.options.singleQuoteStyle.split('|');

            // Double Quotes
            rules.push(new InputRule({
                find: /(?:^|[\s\{\[\(\<'"\u2018\u201C])(")$/,
                handler: ({ state, range, match }) => {
                    const matchText = match[0];
                    const prefix = matchText.substring(0, matchText.length - 1);
                    return state.tr.insertText(prefix + openDouble, range.from, range.to);
                },
            }));
            rules.push(new InputRule({
                find: /"$/,
                handler: ({ state, range }) => {
                    return state.tr.insertText(closeDouble, range.from, range.to);
                },
            }));

            // Single Quotes
            rules.push(new InputRule({
                find: /(?:^|[\s\{\[\(\<'"\u2018\u201C])(')$/,
                handler: ({ state, range, match }) => {
                    const matchText = match[0];
                    const prefix = matchText.substring(0, matchText.length - 1);
                    return state.tr.insertText(prefix + openSingle, range.from, range.to);
                },
            }));
            rules.push(new InputRule({
                find: /'$/,
                handler: ({ state, range }) => {
                    return state.tr.insertText(closeSingle, range.from, range.to);
                },
            }));
        }

        return rules;
    },
});

module.exports = Substitutions;
