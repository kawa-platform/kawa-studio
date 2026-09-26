// The Node typings come from @types/node; Vitest runs this in Node.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const themeCss = readFileSync('src/assets/theme.css', 'utf8');

describe('primary buttons', () => {
    it('keeps anchor button text visible on hover', () => {
        expect(themeCss).toMatch(/\.btn-primary:hover\s*\{[^}]*color:\s*var\(--on-accent\)/);
    });
});

describe('hint helper text', () => {
    /// Global, not scoped: a page's scoped block cannot reach a hint rendered by a child
    /// component, which is where the code spans actually live (FilterBuilder).
    it('keeps inline code on the app mono instead of the UA monospace', () => {
        expect(themeCss).toMatch(/\.hint code\s*\{[^}]*font-family:\s*var\(--mono\)/);
    });
});
