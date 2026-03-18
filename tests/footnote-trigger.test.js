import { describe, it, expect } from 'vitest';

/**
 * Mirror of regex logic in src/extensions/footnote-marker.js
 */
function createTriggerRegex(trigger) {
    const escapedTrigger = trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`${escapedTrigger}$`);
}

describe('Footnote Trigger Regex Generation', () => {
    it('should correctly match the new default trigger "(("', () => {
        const re = createTriggerRegex('((');
        expect(re.test('hello ((')).toBe(true);
        expect(re.test('((')).toBe(true);
        expect(re.test('(( ')).toBe(false); // No trailing space in trigger
    });

    it('should correctly match the legacy default trigger "(( "', () => {
        const re = createTriggerRegex('(( ');
        expect(re.test('hello (( ')).toBe(true);
        expect(re.test('(( ')).toBe(true);
        expect(re.test('((')).toBe(false); // Trigger requires trailing space
    });

    it('should correctly match a custom trigger like "fn:"', () => {
        const re = createTriggerRegex('fn:');
        expect(re.test('some text fn:')).toBe(true);
        expect(re.test('fn:')).toBe(true);
        expect(re.test('fn')).toBe(false);
    });

    it('should correctly match a trigger with multiple special characters "[[#]]"', () => {
        const re = createTriggerRegex('[[#]]');
        expect(re.test('[[#]]')).toBe(true);
        expect(re.test('some content [[#]]')).toBe(true);
        expect(re.test('[[#]] ')).toBe(false);
    });

    it('should handle regex-sensitive characters safely (e.g., "$", ".", "*")', () => {
        const triggers = ['$', '...', '***'];
        triggers.forEach(trigger => {
            const re = createTriggerRegex(trigger);
            expect(re.test(`prefix ${trigger}`)).toBe(true);
            expect(re.test(trigger)).toBe(true);
            // Verify it doesn't match a variation that would work if unescaped
            if (trigger === '.') {
                expect(re.test('a')).toBe(false); // "." would match any char if unescaped
            }
        });
    });

    it('should correctly handle a single space as a trigger', () => {
        const re = createTriggerRegex(' ');
        expect(re.test('some ')).toBe(true);
        expect(re.test(' ')).toBe(true);
        expect(re.test('abc')).toBe(false);
    });

    it('should correctly handle a trigger that is a common suffix but not the whole word', () => {
        const re = createTriggerRegex('ing');
        expect(re.test('running')).toBe(true);
        expect(re.test('ing')).toBe(true);
        expect(re.test('in')).toBe(false);
    });
});
