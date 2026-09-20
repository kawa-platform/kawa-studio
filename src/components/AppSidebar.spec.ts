import { createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { RouterLink } from 'vue-router';
import AppSidebar from './AppSidebar.vue';
import { router } from '@/router';

describe('AppSidebar', () => {
    beforeEach(() => {
        vi.stubGlobal('localStorage', {
            getItem: () => null,
            setItem: () => undefined,
        });
    });

    afterEach(async () => {
        await router.push('/topics');
        vi.unstubAllGlobals();
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
});
