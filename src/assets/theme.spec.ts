// The Node typings come from @types/node; Vitest runs this in Node.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const themeCss = readFileSync('src/assets/theme.css', 'utf8');

describe('primary buttons', () => {
    it('keeps anchor button text visible on hover', () => {
        expect(themeCss).toMatch(/\.btn-primary:hover\s*\{[^}]*color:\s*var\(--on-accent\)/);
    });
});
