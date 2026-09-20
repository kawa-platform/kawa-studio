import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GroupDetailsPage from './GroupDetailsPage.vue';

const { groupsMock, routeMock } = vi.hoisted(() => ({
    groupsMock: vi.fn(),
    routeMock: { params: { name: 'b2c-order' } },
}));

vi.mock('vue-router', async () => ({
    ...await vi.importActual<typeof import('vue-router')>('vue-router'),
    useRoute: () => routeMock,
}));

vi.mock('../queries', () => ({
    useRbacGroups: groupsMock,
}));

const RouterLinkStub = {
    name: 'RouterLink',
    props: { to: { type: [String, Object], default: '' } },
    template: '<a :href="typeof to === \'string\' ? to : \'/admin/\'"><slot /></a>',
};

function mountPage() {
    return mount(GroupDetailsPage, {
        global: {
            stubs: { RouterLink: RouterLinkStub, RbacBanner: true },
        },
    });
}

describe('GroupDetailsPage', () => {
    beforeEach(() => {
        routeMock.params.name = 'b2c-order';
        groupsMock.mockReturnValue({
            data: { value: [{ name: 'b2c-order', clients: ['alice', 'sales eu'], roles: ['reader', 'order admin'] }] },
            error: { value: null },
            isPending: { value: false },
        });
    });

    it('shows the group and links clients and roles to read-only pages', () => {
        const wrapper = mountPage();

        expect(wrapper.get('h1').text()).toBe('b2c-order');
        expect(wrapper.get('a[href="/clients/alice"]').text()).toBe('alice');
        expect(wrapper.get('a[href="/clients/sales%20eu"]').text()).toBe('sales eu');
        expect(wrapper.find('a[href="/clients/alice/edit"]').exists()).toBe(false);
        expect(wrapper.find('a[href="/clients/sales%20eu/edit"]').exists()).toBe(false);
        expect(wrapper.get('a[href="/rbac/roles/reader"]').text()).toBe('reader');
        expect(wrapper.get('a[href="/rbac/roles/order%20admin"]').text()).toBe('order admin');
        expect(wrapper.find('a[href="/rbac/roles/reader/edit"]').exists()).toBe(false);
        expect(wrapper.find('a[href="/rbac/roles/order%20admin/edit"]').exists()).toBe(false);
    });

    it('offers an edit action for the current group', () => {
        const wrapper = mountPage();

        expect(wrapper.get('a[href="/rbac/groups/b2c-order/edit"]').text()).toContain('Edit group');
        expect(wrapper.get('a[href="/rbac/groups"]').text()).toContain('Back');
    });

    it('shows empty states without rendering editable controls', () => {
        groupsMock.mockReturnValue({
            data: { value: [{ name: 'b2c-order', clients: [], roles: [] }] },
            error: { value: null },
            isPending: { value: false },
        });

        const wrapper = mountPage();

        expect(wrapper.text()).toContain('No clients');
        expect(wrapper.text()).toContain('No roles');
        expect(wrapper.find('input').exists()).toBe(false);
        expect(wrapper.find('form').exists()).toBe(false);
    });

    it('reports a missing group after the list finishes loading', () => {
        groupsMock.mockReturnValue({
            data: { value: [] },
            error: { value: null },
            isPending: { value: false },
        });

        const wrapper = mountPage();
        expect(wrapper.text()).toContain('Group “b2c-order” does not exist.');
        expect(wrapper.find('a[href="/rbac/groups/b2c-order/edit"]').exists()).toBe(false);
    });

    it('shows an accessible loading state without offering edit', () => {
        groupsMock.mockReturnValue({
            data: { value: undefined },
            error: { value: null },
            isPending: { value: true },
        });

        const wrapper = mountPage();

        expect(wrapper.get('[role="status"]').text()).toContain('Loading group');
        expect(wrapper.find('a[href="/rbac/groups/b2c-order/edit"]').exists()).toBe(false);
    });

    it('shows the query error instead of a missing-group message', () => {
        groupsMock.mockReturnValue({
            data: { value: undefined },
            error: { value: new Error('Could not load groups.') },
            isPending: { value: false },
        });

        const text = mountPage().text();
        expect(text).toContain('Could not load groups.');
        expect(text).not.toContain('does not exist');
        expect(mountPage().find('a[href="/rbac/groups/b2c-order/edit"]').exists()).toBe(false);
    });
});
