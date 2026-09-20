import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RoleDetailsPage from './RoleDetailsPage.vue';

const { rolesMock, groupsMock, routeMock } = vi.hoisted(() => ({
    rolesMock: vi.fn(),
    groupsMock: vi.fn(),
    routeMock: { params: { name: 'reader' } },
}));

vi.mock('vue-router', async () => ({
    ...await vi.importActual<typeof import('vue-router')>('vue-router'),
    useRoute: () => routeMock,
}));

vi.mock('../queries', () => ({
    useRbacRoles: rolesMock,
    useRbacGroups: groupsMock,
}));

const RouterLinkStub = {
    name: 'RouterLink',
    props: { to: { type: [String, Object], default: '' } },
    template: '<a :href="typeof to === \'string\' ? to : \'/admin/\'"><slot /></a>',
};

function mountPage() {
    return mount(RoleDetailsPage, {
        global: {
            stubs: { RouterLink: RouterLinkStub, RbacBanner: true },
        },
    });
}

describe('RoleDetailsPage', () => {
    beforeEach(() => {
        routeMock.params.name = 'reader';
        rolesMock.mockReturnValue({
            data: { value: [{
                name: 'reader',
                acls: [{
                    permission: 'ALLOW',
                    operation: 'READ',
                    resource: { type: 'TOPIC', pattern: 'orders', patternType: 'LITERAL' },
                }],
            }] },
            error: { value: null },
            isPending: { value: false },
        });
        groupsMock.mockReturnValue({
            data: { value: [{ name: 'orders-team', clients: ['alice'], roles: ['reader'] }] },
            error: { value: null },
            isPending: { value: false },
        });
    });

    it('shows ACLs and groups with an explicit edit action', () => {
        const wrapper = mountPage();

        expect(wrapper.get('h1').text()).toBe('reader');
        expect(wrapper.text()).toContain('ALLOW READ topic "orders"');
        expect(wrapper.get('a[href="/rbac/groups/orders-team/"]').text()).toBe('orders-team');
        expect(wrapper.get('a[href="/rbac/roles/reader/edit"]').text()).toContain('Edit role');
        expect(wrapper.find('form').exists()).toBe(false);
        expect(wrapper.find('input').exists()).toBe(false);
        expect(wrapper.find('select').exists()).toBe(false);
    });

    it('reports a missing role without offering edit', () => {
        rolesMock.mockReturnValue({
            data: { value: [] },
            error: { value: null },
            isPending: { value: false },
        });

        const wrapper = mountPage();

        expect(wrapper.text()).toContain('Role “reader” does not exist.');
        expect(wrapper.find('a[href="/rbac/roles/reader/edit"]').exists()).toBe(false);
    });
});
