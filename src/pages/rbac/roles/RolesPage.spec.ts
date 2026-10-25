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

    it('locks edit and delete of a role managed by the operator', () => {
        rolesMock.mockReturnValue({
            data: { value: [{ name: 'reader', acls: [], managedBy: { principal: 'kawa-operator' } }] },
            error: { value: null },
        });

        const wrapper = mountPage();

        expect(wrapper.find('a[href="/rbac/roles/reader/edit"]').exists()).toBe(false);
        for (const button of wrapper.findAll('tbody tr button')) {
            expect(button.attributes('disabled')).toBeDefined();
            expect(button.attributes('title')).toBe('Managed by kawa-operator, change it through Kubernetes');
        }
        expect(wrapper.text()).toContain('Managed by kawa-operator');
    });
});
