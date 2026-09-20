import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GroupEditorPage from './GroupEditorPage.vue';

const routeParams = vi.hoisted(() => ({ value: {} as Record<string, string> }));
const routerPush = vi.hoisted(() => vi.fn());
const { groupsMock, rolesMock, authClientsMock, upsertMock, renameMock } = vi.hoisted(() => ({
    groupsMock: vi.fn(),
    rolesMock: vi.fn(),
    authClientsMock: vi.fn(),
    upsertMock: vi.fn(),
    renameMock: vi.fn(),
}));

vi.mock('vue-router', () => ({
    useRoute: () => ({ params: routeParams.value }),
    useRouter: () => ({ push: routerPush }),
}));

vi.mock('../queries', () => ({
    useRbacGroups: groupsMock,
    useRbacRoles: rolesMock,
    useRbacAuthClients: authClientsMock,
    useUpsertRbacGroup: upsertMock,
    useRenameRbacGroup: renameMock,
}));

const queryLike = (data: unknown[] | null) => ({
    data: { value: data },
    isPending: { value: false },
    error: { value: null },
});

const mutationLike = (overrides?: { mutateAsync?: ReturnType<typeof vi.fn> }) =>
    ({ isPending: { value: false }, mutateAsync: overrides?.mutateAsync ?? vi.fn() });

const RouterLinkStub = {
    name: 'RouterLink',
    props: { to: { type: [String, Object], default: '' } },
    template: '<a :href="typeof to === \'string\' ? to : \'/admin/\'"><slot /></a>',
};

function mountPage() {
    return mount(GroupEditorPage, {
        global: {
            stubs: {
                RouterLink: RouterLinkStub,
                SuggestionInput: true,
                RbacBanner: true,
                AppToast: true,
            },
        },
    });
}

describe('GroupEditorPage', () => {
    beforeEach(() => {
        routeParams.value = {};
        routerPush.mockReset();
        groupsMock.mockReturnValue(queryLike([]));
        rolesMock.mockReturnValue(queryLike([]));
        authClientsMock.mockReturnValue(queryLike([]));
        upsertMock.mockReturnValue(mutationLike());
        renameMock.mockReturnValue(mutationLike());
    });

    it('enables the name input when editing', () => {
        routeParams.value = { name: 'producers' };
        groupsMock.mockReturnValue(queryLike([{ name: 'producers', clients: [], roles: [] }]));

        const wrapper = mountPage();

        expect(wrapper.find('#group-name').attributes('disabled')).toBeUndefined();
    });

    it('renames the group when the name changes', async () => {
        routeParams.value = { name: 'producers' };
        groupsMock.mockReturnValue(queryLike([{ name: 'producers', clients: ['alice'], roles: ['admin'] }]));
        rolesMock.mockReturnValue(queryLike([{ name: 'admin', acls: [] }]));

        const renameMutation = mutationLike();
        renameMock.mockReturnValue(renameMutation);
        const upsertMutation = mutationLike();
        upsertMock.mockReturnValue(upsertMutation);

        const wrapper = mountPage();
        const input = wrapper.find('#group-name');
        await input.setValue('publishers');
        await wrapper.find('form').trigger('submit.prevent');

        expect(renameMutation.mutateAsync).toHaveBeenCalledWith({ name: 'producers', body: { name: 'publishers' } });
        expect(upsertMutation.mutateAsync).toHaveBeenCalledWith({
            name: 'publishers',
            body: { clients: ['alice'], roles: ['admin'] },
        });
    });

    it('saves without renaming when the name is unchanged', async () => {
        routeParams.value = { name: 'producers' };
        groupsMock.mockReturnValue(queryLike([{ name: 'producers', clients: ['alice'], roles: ['admin'] }]));

        const renameMutation = mutationLike();
        renameMock.mockReturnValue(renameMutation);
        const upsertMutation = mutationLike();
        upsertMock.mockReturnValue(upsertMutation);

        const wrapper = mountPage();
        await wrapper.find('form').trigger('submit.prevent');

        expect(renameMutation.mutateAsync).not.toHaveBeenCalled();
        expect(upsertMutation.mutateAsync).toHaveBeenCalledWith({
            name: 'producers',
            body: { clients: ['alice'], roles: ['admin'] },
        });
    });

    it('creates a new group without calling rename', async () => {
        routeParams.value = {};
        groupsMock.mockReturnValue(queryLike([{ name: 'producers', clients: [], roles: [] }]));

        const renameMutation = mutationLike();
        renameMock.mockReturnValue(renameMutation);
        const upsertMutation = mutationLike();
        upsertMock.mockReturnValue(upsertMutation);

        const wrapper = mountPage();
        const input = wrapper.find('#group-name');
        await input.setValue('producers');
        await wrapper.find('form').trigger('submit.prevent');

        expect(renameMutation.mutateAsync).not.toHaveBeenCalled();
        expect(upsertMutation.mutateAsync).toHaveBeenCalledWith({
            name: 'producers',
            body: { clients: [], roles: [] },
        });
    });
});