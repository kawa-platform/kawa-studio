import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '@/api/types';
import ClientsPage from './ClientsPage.vue';

const mocks = vi.hoisted(() => ({
    usersData: { value: [] as Client[] },
    groupsMock: vi.fn(),
    deleteClientMock: vi.fn(),
}));

vi.mock('@/api', () => ({
    useApi: () => ({
        listClients: () => Promise.resolve(mocks.usersData.value),
        deleteClient: mocks.deleteClientMock,
        resetPassword: vi.fn(),
    }),
}));

vi.mock('@tanstack/vue-query', () => ({
    useQuery: () => ({
        data: { value: mocks.usersData.value },
        error: { value: null },
        isPending: { value: false },
        refetch: vi.fn(),
    }),
}));

vi.mock('../rbac/queries', () => ({
    useRbacGroups: mocks.groupsMock,
}));

const user = (username: string): Client => ({
    username,
    mechanism: 'PLAIN',
    role: null,
    createdAt: '2026-01-01T00:00:00.000Z',
});

const groupQueryLike = (data: unknown[] | null) => ({
    data: { value: data },
    error: { value: null },
});

const RouterLinkStub = {
    name: 'RouterLink',
    props: { to: { type: [String, Object], default: '' } },
    template: '<a :href="typeof to === \'string\' ? to : \'/admin/\'"><slot /></a>',
};

const ConfirmDialogStub = {
    name: 'ConfirmDialog',
    props: ['open', 'title', 'body', 'confirmLabel', 'danger', 'pending'],
    template: '<div class="confirm-dialog" :data-title="title" :data-body="body" />',
};

function mountPage() {
    return mount(ClientsPage, {
        global: {
            stubs: {
                RouterLink: RouterLinkStub,
                ConfirmDialog: ConfirmDialogStub,
                ClientsTabs: true,
            },
        },
    });
}

const deleteButton = (wrapper: ReturnType<typeof mountPage>) =>
    wrapper.findAll('tbody tr button').find((button) => button.text() === 'Delete');

describe('ClientsPage', () => {
    beforeEach(() => {
        mocks.usersData.value = [];
        mocks.groupsMock.mockReset();
        mocks.deleteClientMock.mockReset();
    });

    it('keeps delete enabled for a client that belongs to a group', () => {
        // given
        mocks.usersData.value = [user('alice')];
        mocks.groupsMock.mockReturnValue(groupQueryLike([
            { name: 'producers', clients: ['alice'], roles: [] },
        ]));

        // when
        const wrapper = mountPage();

        // then
        expect(deleteButton(wrapper)?.attributes('disabled')).toBeUndefined();
    });

    it('lists the groups the client will be removed from in the delete dialog', async () => {
        // given
        mocks.usersData.value = [user('alice')];
        mocks.groupsMock.mockReturnValue(groupQueryLike([
            { name: 'producers', clients: ['alice'], roles: [] },
            { name: 'admins', clients: ['alice'], roles: [] },
        ]));

        // when
        const wrapper = mountPage();
        await deleteButton(wrapper)?.trigger('click');

        // then
        const dialog = wrapper.findComponent(ConfirmDialogStub);
        expect(dialog.props('body')).toContain('producers');
        expect(dialog.props('body')).toContain('admins');
    });

    it('keeps delete enabled for a client outside every group', () => {
        // given
        mocks.usersData.value = [user('alice')];
        mocks.groupsMock.mockReturnValue(groupQueryLike([
            { name: 'producers', clients: ['bob'], roles: [] },
        ]));

        // when
        const wrapper = mountPage();

        // then
        expect(deleteButton(wrapper)?.attributes('disabled')).toBeUndefined();
    });

    it('links client groups to their read-only detail pages', () => {
        mocks.usersData.value = [user('alice')];
        mocks.groupsMock.mockReturnValue(groupQueryLike([
            { name: 'groupA', clients: ['alice'], roles: [] },
        ]));

        const wrapper = mountPage();

        expect(wrapper.find('a[href="/rbac/groups/groupA"]').text()).toBe('groupA');
        expect(wrapper.find('a[href="/rbac/groups/groupA/edit"]').exists()).toBe(false);
    });

    it('links client names to their read-only detail pages', () => {
        mocks.usersData.value = [user('alice')];
        mocks.groupsMock.mockReturnValue(groupQueryLike([]));

        const wrapper = mountPage();

        expect(wrapper.find('a[href="/clients/alice"]').text()).toBe('alice');
    });
});
