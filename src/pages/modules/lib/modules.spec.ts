import { describe, expect, it } from 'vitest';
import { MODULE_REFS, toModuleCards } from './modules';

describe('toModuleCards', () => {
    it('describes each reported module from its ref and takes its state from the gateway', () => {
        // when
        const cards = toModuleCards([
            { id: 'governance', enabled: false, available: true },
            { id: 'mcp', enabled: true, available: false, unavailableReason: 'set admin.publicUrl' },
        ]);

        // then
        expect(cards).toEqual([
            { ...MODULE_REFS.governance, id: 'governance', enabled: false, available: true },
            { ...MODULE_REFS.mcp, id: 'mcp', enabled: true, available: false, unavailableReason: 'set admin.publicUrl' },
        ]);
    });

    it('shows only the modules the gateway reports, in its order', () => {
        const cards = toModuleCards([{ id: 'rbac', enabled: true, available: true }]);

        expect(cards.map((card) => card.id)).toEqual(['rbac']);
    });

    it('links the MCP server card to the OAuth clients page and its documentation', () => {
        const [card] = toModuleCards([{ id: 'mcp', enabled: false, available: true }]);

        expect(card?.pages).toEqual([{ label: 'OAuth clients', to: '/oauth-clients' }]);
        expect(card?.docs).toBe('https://kawa-platform.github.io/kawa-docs/docs/modules/mcp');
    });
});
