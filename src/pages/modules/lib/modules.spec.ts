import { describe, expect, it } from 'vitest';
import { MODULE_REFS, toModuleCards } from './modules';

describe('toModuleCards', () => {
    it('describes each reported module from its ref and takes only enabled from the gateway', () => {
        // when
        const cards = toModuleCards([
            { id: 'governance', enabled: false },
            { id: 'rbac', enabled: true },
        ]);

        // then
        expect(cards).toEqual([
            { ...MODULE_REFS.governance, id: 'governance', enabled: false },
            { ...MODULE_REFS.rbac, id: 'rbac', enabled: true },
        ]);
    });

    it('shows only the modules the gateway reports, in its order', () => {
        const cards = toModuleCards([{ id: 'rbac', enabled: true }]);

        expect(cards.map((card) => card.id)).toEqual(['rbac']);
    });

    it('links the MCP server card to the OAuth clients page', () => {
        const [card] = toModuleCards([{ id: 'mcp', enabled: false }]);

        expect(card?.pages).toEqual([{ label: 'OAuth clients', to: '/oauth-clients' }]);
    });
});
