module.exports = {
    testEnvironment: 'jsdom',
    moduleFileExtensions: ['js', 'json', 'jsx', 'node'],
    transform: {}, // Use default transformation
    verbose: true,
    moduleNameMapper: {
        '^obsidian$': '<rootDir>/tests/__mocks__/obsidian.js',
    }
};
