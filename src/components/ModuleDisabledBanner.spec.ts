import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ModuleDisabledBanner from './ModuleDisabledBanner.vue';

const mocks = vi.hoisted(() => ({
    disabled: [] as string[],
    meta: {} as Record<string, unknown>,
}));

vi.mock('@/pages/modules/queries', async () => {
    const { computed } = await import('vue');
    return { useDisabledModules: () => computed(() => new Set(mocks.disabled)) };
});

vi.mock('vue-router', () => ({
    useRoute: () => ({ meta: mocks.meta }),
}));

function mountBanner() {
    return mount(ModuleDisabledBanner, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } });
}

describe('ModuleDisabledBanner', () => {
    beforeEach(() => {
        mocks.disabled = [];
        mocks.meta = {};
    });

    it('tells that the page belongs to a disabled module and edits have no effect', () => {
        mocks.disabled = ['governance'];
        mocks.meta = { module: 'governance' };

        const wrapper = mountBanner();

        expect(wrapper.text()).toContain('Governance is disabled.');
        expect(wrapper.text()).toContain('changes have no effect until the module is enabled');
    });

    it('stays hidden on a page of an enabled module', () => {
        mocks.disabled = ['governance'];
        mocks.meta = { module: 'rbac' };

        expect(mountBanner().find('.module-banner').exists()).toBe(false);
    });

    it('stays hidden on a page that belongs to no module', () => {
        mocks.disabled = ['governance'];

        expect(mountBanner().find('.module-banner').exists()).toBe(false);
    });
});
