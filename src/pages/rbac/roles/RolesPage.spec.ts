import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RolesPage from './RolesPage.vue';

const { rolesMock, groupsMock, deleteRoleMock } = vi.hoisted(() => ({
    rolesMock: vi.fn(),
    groupsMock: vi.fn(),
    deleteRoleMock: vi.fn(),
}));

vi.mock('../queries', () => ({
    useRbacRoles: rolesMock,
    useRbacGroups: groupsMock,
    useDeleteRbacRole: deleteRoleMock,
}));

const RouterLinkStub = {
    name: 'RouterLink',
    props: { to: { type: [String, Object], default: '' } },
    template: '<a :href="typeof to === \'string\' ? to : \'/admin/\'"><slot /></a>',
};

function mountPage() {
    return mount(RolesPage, {
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

describe('RolesPage', () => {
    beforeEach(() => {
        rolesMock.mockReturnValue({
            data: { value: [{ name: 'reader', acls: [], roles: [] }] },
            error: { value: null },
        });
        groupsMock.mockReturnValue({ data: { value: [] }, error: { value: null } });
        deleteRoleMock.mockReturnValue({ isPending: { value: false }, mutateAsync: vi.fn() });
    });

    it('links the role name to details and keeps edit as an explicit action', () => {
        const wrapper = mountPage();

        expect(wrapper.get('a[href="/rbac/roles/reader"]').text()).toBe('reader');
        expect(wrapper.get('a[href="/rbac/roles/reader/edit"]').text()).toContain('Edit');
    });
});
