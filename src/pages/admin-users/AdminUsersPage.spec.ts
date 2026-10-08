import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/error';
import type { AdminUser } from '@/api/types';
import AdminUsersPage from './AdminUsersPage.vue';

const mocks = vi.hoisted(() => ({
    users: [] as AdminUser[] | undefined,
    error: null as Error | null,
    refetch: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    username: null as string | null,
}));

// Real refs, like vue-query returns, so the template unwraps them.
vi.mock('./queries', async () => {
    const { ref } = await import('vue');
    return {
        useAdminUsers: () => ({
            data: ref(mocks.users),
            error: ref(mocks.error),
            isPending: ref(false),
            refetch: mocks.refetch,
        }),
        useUpdateAdminUser: () => ({ mutateAsync: mocks.update }),
        useDeleteAdminUser: () => ({ mutateAsync: mocks.remove }),
    };
});

vi.mock('@/stores/auth', () => ({
    useAuthStore: () => ({ username: mocks.username }),
}));

const user = (email: string, overrides: Partial<AdminUser> = {}): AdminUser => ({
    id: 'id-' + email,
    email,
    displayName: null,
    enabled: true,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
});

const RouterLinkStub = {
    name: 'RouterLink',
    props: { to: { type: [String, Object], default: '' } },
    template: '<a :href="to"><slot /></a>',
};

/// Renders the dialog inline while open, with its slot and a confirm button, so a test can fill
/// the form and confirm the way a user would.
const ConfirmDialogStub = {
    name: 'ConfirmDialog',
    props: ['open', 'title', 'body', 'confirmLabel', 'danger', 'pending'],
    emits: ['confirm', 'update:open'],
    template: `<div v-if="open" class="confirm-dialog">
        <p class="dialog-body">{{ body }}</p>
        <slot />
        <button class="confirm" @click="$emit('confirm')">{{ confirmLabel }}</button>
    </div>`,
};

function mountPage() {
    return mount(AdminUsersPage, {
        global: { stubs: { RouterLink: RouterLinkStub, ConfirmDialog: ConfirmDialogStub } },
    });
}

const rowOf = (wrapper: ReturnType<typeof mountPage>, email: string) =>
    wrapper.findAll('tbody tr').find((row) => row.text().includes(email))!;

const buttonIn = (row: ReturnType<typeof rowOf>, label: string) =>
    row.findAll('button').find((button) => button.text() === label);

describe('AdminUsersPage', () => {
    beforeEach(() => {
        mocks.users = [];
        mocks.error = null;
        mocks.username = null;
        mocks.refetch.mockReset();
        mocks.update.mockReset().mockResolvedValue(undefined);
        mocks.remove.mockReset().mockResolvedValue(undefined);
    });

    it('lists every admin user with display name and enabled state', () => {
        // given
        mocks.users = [
            user('ops@example.com', { displayName: 'Ops team' }),
            user('old@example.com', { enabled: false }),
        ];

        // when
        const wrapper = mountPage();

        // then
        const ops = rowOf(wrapper, 'ops@example.com');
        expect(ops.text()).toContain('Ops team');
        expect(ops.text()).toContain('Enabled');
        expect(ops.text()).toContain('2026-01-01');
        expect(rowOf(wrapper, 'old@example.com').text()).toContain('Disabled');
        expect(wrapper.find('a[href="/admin/users/id-ops%40example.com/edit"]').exists()).toBe(true);
    });

    it('never renders a password or hash', () => {
        // given
        mocks.users = [{ ...user('ops@example.com'), password: 'PBKDF2:secret-hash' } as AdminUser];

        // when
        const wrapper = mountPage();

        // then
        expect(wrapper.html()).not.toContain('secret-hash');
    });

    it('marks the signed-in admin', () => {
        mocks.users = [user('ops@example.com'), user('other@example.com')];
        mocks.username = 'ops@example.com';

        const wrapper = mountPage();

        expect(rowOf(wrapper, 'ops@example.com').find('.you').exists()).toBe(true);
        expect(rowOf(wrapper, 'other@example.com').find('.you').exists()).toBe(false);
    });

    it('shows an explicit error state with a retry when the list fails to load', async () => {
        // given
        mocks.users = undefined;
        mocks.error = new ApiError('500', 'config topic unavailable');

        // when
        const wrapper = mountPage();
        await wrapper.get('.load-error button').trigger('click');

        // then
        expect(wrapper.get('[role="alert"]').text()).toContain('config topic unavailable');
        expect(wrapper.find('table').exists()).toBe(false);
        expect(mocks.refetch).toHaveBeenCalled();
    });

    it('deletes a user only after confirmation', async () => {
        // given
        mocks.users = [user('ops@example.com')];
        const wrapper = mountPage();

        // when
        await buttonIn(rowOf(wrapper, 'ops@example.com'), 'Delete')!.trigger('click');

        // then
        expect(mocks.remove).not.toHaveBeenCalled();
        await wrapper.get('.confirm-dialog .confirm').trigger('click');
        await flushPromises();
        expect(mocks.remove).toHaveBeenCalledWith('id-ops@example.com');
        expect(wrapper.find('.confirm-dialog').exists()).toBe(false);
    });

    it('warns when deleting your own account', async () => {
        mocks.users = [user('ops@example.com')];
        mocks.username = 'ops@example.com';
        const wrapper = mountPage();

        await buttonIn(rowOf(wrapper, 'ops@example.com'), 'Delete')!.trigger('click');

        expect(wrapper.get('.dialog-body').text()).toContain('your own account');
    });

    it('shows a refusal from the gateway inline in the dialog', async () => {
        // given
        mocks.users = [user('ops@example.com')];
        mocks.remove.mockRejectedValue(new ApiError('409', 'cannot delete your own admin user'));
        const wrapper = mountPage();

        // when
        await buttonIn(rowOf(wrapper, 'ops@example.com'), 'Delete')!.trigger('click');
        await wrapper.get('.confirm-dialog .confirm').trigger('click');
        await flushPromises();

        // then
        expect(wrapper.get('.confirm-dialog [role="alert"]').text()).toBe('cannot delete your own admin user');
    });

    it('disables a user after confirmation, without deleting them', async () => {
        mocks.users = [user('ops@example.com')];
        const wrapper = mountPage();

        await buttonIn(rowOf(wrapper, 'ops@example.com'), 'Disable')!.trigger('click');
        await wrapper.get('.confirm-dialog .confirm').trigger('click');
        await flushPromises();

        expect(mocks.update).toHaveBeenCalledWith({ id: 'id-ops@example.com', body: { enabled: false } });
        expect(mocks.remove).not.toHaveBeenCalled();
    });

    it('re-enables a disabled user straight from the table', async () => {
        mocks.users = [user('old@example.com', { enabled: false })];
        const wrapper = mountPage();

        await buttonIn(rowOf(wrapper, 'old@example.com'), 'Enable')!.trigger('click');
        await flushPromises();

        expect(mocks.update).toHaveBeenCalledWith({ id: 'id-old@example.com', body: { enabled: true } });
    });

    it('shows a refused re-enable above the table', async () => {
        mocks.users = [user('old@example.com', { enabled: false })];
        mocks.update.mockRejectedValue(new ApiError('409', 'admin user limit reached'));
        const wrapper = mountPage();

        await buttonIn(rowOf(wrapper, 'old@example.com'), 'Enable')!.trigger('click');
        await flushPromises();

        expect(wrapper.get('.form-error').text()).toBe('admin user limit reached');
    });

    it('changes only the password, and clears it from the form afterwards', async () => {
        // given
        mocks.users = [user('ops@example.com')];
        const wrapper = mountPage();
        await buttonIn(rowOf(wrapper, 'ops@example.com'), 'Change password')!.trigger('click');

        // when
        await wrapper.get('#password').setValue('n3w-secret');
        await wrapper.get('#confirm-password').setValue('n3w-secret');
        await wrapper.get('.confirm-dialog .confirm').trigger('click');
        await flushPromises();

        // then
        expect(mocks.update).toHaveBeenCalledWith({ id: 'id-ops@example.com', body: { password: 'n3w-secret' } });
        expect(wrapper.html()).not.toContain('n3w-secret');
    });

    it('does not send a password whose confirmation differs', async () => {
        mocks.users = [user('ops@example.com')];
        const wrapper = mountPage();
        await buttonIn(rowOf(wrapper, 'ops@example.com'), 'Change password')!.trigger('click');

        await wrapper.get('#password').setValue('n3w-secret');
        await wrapper.get('#confirm-password').setValue('typo');
        await wrapper.get('.confirm-dialog .confirm').trigger('click');

        expect(mocks.update).not.toHaveBeenCalled();
        expect(wrapper.text()).toContain('Passwords do not match.');
    });
});
