import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Recursively find all Javascript files in a directory.
 */
function getAllFiles(dirPath, arrayOfFiles = []) {
    const files = fs.readdirSync(dirPath);

    files.forEach((file) => {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
        } else if (fullPath.endsWith('.js')) {
            arrayOfFiles.push(fullPath);
        }
    });

    return arrayOfFiles;
}

const srcDir = path.resolve(__dirname, '../src');
const srcFiles = getAllFiles(srcDir);

describe('Official Obsidian Guidelines Audit', () => {
    
    it('Policy: Avoid using global app instance (window.app)', () => {
        for (const file of srcFiles) {
            const content = fs.readFileSync(file, 'utf8');
            // This expects no occurrences of window.app
            const match = content.match(/window\.app\b/);
            expect(match, `Found window.app in ${path.basename(file)}`).toBeNull();
        }
    });

    it('Policy: Security - Avoid innerHTML, outerHTML, and insertAdjacentHTML', () => {
        for (const file of srcFiles) {
            const content = fs.readFileSync(file, 'utf8');
            const match = content.match(/\.(innerHTML|outerHTML|insertAdjacentHTML)\s*=/);
            expect(match, `Found unsafe HTML injection in ${path.basename(file)}`).toBeNull();
        }
    });

    it('Policy: Workspace - Avoid accessing workspace.activeLeaf directly', () => {
        for (const file of srcFiles) {
            const content = fs.readFileSync(file, 'utf8');
            const match = content.match(/\.workspace\.activeLeaf\b/);
            expect(match, `Found deprecated workspace.activeLeaf in ${path.basename(file)}`).toBeNull();
        }
    });

    it('Policy: Vault - Prefer the Vault API over the Adapter API natively', () => {
        for (const file of srcFiles) {
            const content = fs.readFileSync(file, 'utf8');
            
            // Allow cache manager logic reading its own purely hidden files, 
            // but restrict general purpose app.vault.adapter calls in domain logic
            if (!file.includes('metadata-manager.js')) {
                const match = content.match(/\.vault\.adapter\b/);
                expect(match, `Found .vault.adapter usage in ${path.basename(file)}. Use getAbstractFileByPath instead.`).toBeNull();
            }
        }
    });

    it('Policy: UI Text - Specific settings header standards', () => {
        for (const file of srcFiles) {
            // Check UI files specifically
            if (file.includes('settings-tab.js') || file.includes('block-settings.js')) {
                const content = fs.readFileSync(file, 'utf8');
                // Creating a top-level H2 or H3 is discouraged for standard plugins formatting
                const match = content.match(/\.createEl\(\s*['"]h[23]['"]/i);
                expect(match, `Found hardcoded HTML headers in ${path.basename(file)}. Use new Setting().setHeading().`).toBeNull();
            }
        }
    });

    it('Policy: Styling - No hardcoded Javascript inline styling', () => {
        for (const file of srcFiles) {
            const content = fs.readFileSync(file, 'utf8');
            // Check for direct style overrides (e.g. el.style.color = ) 
            // Note: Exception is layout sizing in UI widgets
            if (!file.includes('block-settings.js') && !file.includes('tiptap-adapter.js')) {
                const match = content.match(/(?<!inputEl)\.style\.(backgroundColor|color|display)\s*=/i);
                expect(match, `Found hardcoded style property assignment in ${path.basename(file)}. Use CSS classes instead.`).toBeNull();
            }
        }
    });

});
