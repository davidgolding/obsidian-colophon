import { describe, it, expect, beforeEach } from 'vitest';
import { performSearch, Search } from '../src/extensions/search';

// Mocking Tiptap/Prosemirror where necessary if they still fail in node
describe('Search logic', () => {
    const mockExtension = {
        storage: {
            query: '',
            results: [],
            activeIndex: -1
        },
        options: {
            caseSensitive: false,
            disableRegex: true,
            wholeWord: false
        }
    };

    const createMockState = (text) => ({
        doc: {
            descendants: (cb) => {
                cb({ isText: true, text }, 0);
            }
        }
    });

    it('should find basic matches', () => {
        const state = createMockState('The quick brown fox jumps over the lazy dog.');
        mockExtension.storage.query = 'the';
        
        const results = performSearch(state, mockExtension);
        
        expect(results).toHaveLength(2);
        expect(results[0]).toEqual({ from: 0, to: 3 });
        expect(results[1]).toEqual({ from: 31, to: 34 });
    });

    it('should handle case sensitivity', () => {
        const state = createMockState('The quick brown fox jumps over the lazy dog.');
        mockExtension.storage.query = 'The';
        mockExtension.options.caseSensitive = true;
        
        const results = performSearch(state, mockExtension);
        
        expect(results).toHaveLength(1);
        expect(results[0]).toEqual({ from: 0, to: 3 });
    });

    it('should handle regex', () => {
        const state = createMockState('The quick brown fox jumps over the lazy dog.');
        mockExtension.storage.query = 'fox|dog';
        mockExtension.options.disableRegex = false;
        
        const results = performSearch(state, mockExtension);
        
        expect(results).toHaveLength(2);
        expect(results[0].from).toBe(16); // fox
        expect(results[1].from).toBe(40); // dog
    });

    it('should handle whole word', () => {
        const state = createMockState('theater for the masses');
        mockExtension.storage.query = 'the';
        mockExtension.options.disableRegex = true;
        mockExtension.options.wholeWord = true;
        
        const results = performSearch(state, mockExtension);
        
        expect(results).toHaveLength(1);
        expect(results[0].from).toBe(12); // 'the', not 'theater'
    });
});

describe('Search Extension structure', () => {
    it('should have the correct name', () => {
        expect(Search.name).toBe('search');
    });

    it('should have the expected commands', () => {
        const commands = Search.config.addCommands.call({ storage: {}, options: {} });
        expect(commands).toHaveProperty('setSearchQuery');
        expect(commands).toHaveProperty('setSearchOptions');
        expect(commands).toHaveProperty('nextSearchResult');
        expect(commands).toHaveProperty('previousSearchResult');
        expect(commands).toHaveProperty('replace');
        expect(commands).toHaveProperty('replaceAll');
    });
});
