import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GroupsPage from './GroupsPage.vue';

const { groupsMock, deleteGroupMock } = vi.hoisted(() => ({
    groupsMock: vi.fn(),
    deleteGroupMock: vi.fn(),
}));

vi.mock('../queries', () => ({
    useRbacGroups: groupsMock,
    useDeleteRbacGroup: deleteGroupMock,
}));

const queryLike = (data: unknown[] | null) => ({
    data: { value: data },
    error: { value: null },
});

const RouterLinkStub = {
    name: 'RouterLink',
    props: { to: { type: [String, Object], default: '' } },
    template: '<a :href="typeof to === \'string\' ? to : \'/admin/\'"><slot /></a>',
};

function mountPage() {
    return mount(GroupsPage, {
        global: {
            stubs: {
                RouterLink: RouterLinkStub,
                ConfirmDialog: true,
                AppToast: true,
                RbacBanner: true,
            },
        },
    });
}

describe('GroupsPage', () => {
    beforeEach(() => {
        deleteGroupMock.mockReturnValue({ isPending: { value: false }, mutateAsync: vi.fn() });
    });

    it('shows client and role counts in the header row', () => {
        groupsMock.mockReturnValue(queryLike([
            { name: 'admin-team', clients: ['alice', 'bob', 'carol'], roles: ['admin', 'reader'] },
        ]));

        const wrapper = mountPage();
        const cells = wrapper.find('tbody tr').findAll('td');

        expect(cells[1]!.text()).toContain('3 clients');
        expect(cells[2]!.text()).toContain('2 roles');
    });

    it('links the group name to its read-only detail page', () => {
        groupsMock.mockReturnValue(queryLike([
            { name: 'b2c order', clients: ['alice'], roles: ['reader'] },
        ]));

        const wrapper = mountPage();

        expect(wrapper.find('a[href="/rbac/groups/b2c%20order/"]').text()).toBe('b2c order');
    });

    it('lists every client as a link to its read-only client page', () => {
        groupsMock.mockReturnValue(queryLike([
            { name: 'admin-team', clients: ['alice', 'bob', 'carol'], roles: ['admin'] },
        ]));

        const wrapper = mountPage();

        for (const client of ['alice', 'bob', 'carol']) {
            expect(wrapper.find(`a[href="/clients/${client}"]`).text()).toBe(client);
            expect(wrapper.find(`a[href="/clients/${client}/edit"]`).exists()).toBe(false);
        }
    });

    it('lists every role as a link to its read-only role page', () => {
        groupsMock.mockReturnValue(queryLike([
            { name: 'admin-team', clients: ['alice'], roles: ['admin', 'reader'] },
        ]));

        const wrapper = mountPage();

        expect(wrapper.find('a[href="/rbac/roles/admin"]').text()).toBe('admin');
        expect(wrapper.find('a[href="/rbac/roles/reader"]').text()).toBe('reader');
        expect(wrapper.find('a[href="/rbac/roles/admin/edit"]').exists()).toBe(false);
        expect(wrapper.find('a[href="/rbac/roles/reader/edit"]').exists()).toBe(false);
    });

    it('falls back to empty text when a group has no clients or roles', () => {
        groupsMock.mockReturnValue(queryLike([
            { name: 'empty', clients: [], roles: [] },
        ]));

        const wrapper = mountPage();

        expect(wrapper.text()).toContain('no clients');
        expect(wrapper.text()).toContain('none — grants nothing');
    });

    it('disables delete while a group still has clients', () => {
        groupsMock.mockReturnValue(queryLike([
            { name: 'admin-team', clients: ['alice'], roles: ['admin'] },
        ]));

        const wrapper = mountPage();

        const deleteButton = wrapper.find('tbody tr button');
        expect(deleteButton.attributes('disabled')).toBeDefined();
    });
});
