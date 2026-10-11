import { createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { RouterLink } from 'vue-router';
import AppSidebar from './AppSidebar.vue';
import { router } from '@/router';

const mocks = vi.hoisted(() => ({ disabled: [] as string[] }));

vi.mock('@/pages/modules/queries', async () => {
    const { computed } = await import('vue');
    return { useDisabledModules: () => computed(() => new Set(mocks.disabled)) };
});

describe('AppSidebar', () => {
    beforeEach(() => {
        mocks.disabled = [];
        vi.stubGlobal('localStorage', {
            getItem: () => null,
            setItem: () => undefined,
        });
    });

    afterEach(async () => {
        await router.push('/topics');
        vi.unstubAllGlobals();
    });

    it('shows the 川 brand mark with an accessible label', () => {
        const wrapper = mount(AppSidebar, {
            global: {
                plugins: [createPinia(), router],
            },
        });

        const mark = wrapper.get('.mark');

        expect(mark.text()).toBe('川');
        expect(mark.attributes('aria-label')).toBe('Kawa');
    });

    it.each([
        ['/clients/alice', '/clients'],
        ['/rbac/groups/producers', '/rbac/groups'],
        ['/rbac/roles/reader', '/rbac/roles'],
    ])('highlights the parent section on %s', async (detailPath, parentPath) => {
        await router.push(detailPath);
        const wrapper = mount(AppSidebar, {
            global: {
                plugins: [createPinia(), router],
            },
        });

        await nextTick();

        const parentLink = wrapper.findComponent(RouterLink);
        const matchingLink = wrapper.find(`a[href="/admin${parentPath}"]`);

        expect(parentLink.exists()).toBe(true);
        expect(matchingLink.classes()).toContain('nav-item-on');
    });

    it('keeps the pages of a disabled module clickable and marks them off', () => {
        // given
        mocks.disabled = ['governance'];

        // when
        const wrapper = mount(AppSidebar, { global: { plugins: [createPinia(), router] } });

        // then
        const governance = wrapper.get('a[href="/admin/governance"]');
        expect(governance.classes()).toContain('nav-item-off');
        expect(governance.find('.off').text()).toBe('off');
        expect(wrapper.get('a[href="/admin/topics"]').classes()).not.toContain('nav-item-off');
    });
});
