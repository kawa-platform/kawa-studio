import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/error';
import type { AdminUser } from '@/api/types';
import AdminUserEditorPage from './AdminUserEditorPage.vue';

const mocks = vi.hoisted(() => ({
    params: {} as Record<string, string>,
    users: { value: [] as AdminUser[] },
    create: vi.fn(),
    update: vi.fn(),
    push: vi.fn(),
}));

vi.mock('./queries', () => ({
    useAdminUsers: () => ({ data: mocks.users, error: { value: null }, isPending: { value: false } }),
    useCreateAdminUser: () => ({ mutateAsync: mocks.create }),
    useUpdateAdminUser: () => ({ mutateAsync: mocks.update }),
}));

vi.mock('vue-router', () => ({
    useRoute: () => ({ params: mocks.params }),
    useRouter: () => ({ push: mocks.push }),
}));

const ops: AdminUser = {
    id: 'id-ops',
    email: 'ops@example.com',
    displayName: 'Ops',
    enabled: true,
    createdAt: '2026-01-01T00:00:00Z',
};

function mountPage() {
    return mount(AdminUserEditorPage, { global: { stubs: { RouterLink: true } } });
}

describe('AdminUserEditorPage', () => {
    beforeEach(() => {
        mocks.params = {};
        mocks.users.value = [ops];
        mocks.create.mockReset().mockResolvedValue(ops);
        mocks.update.mockReset().mockResolvedValue(ops);
        mocks.push.mockReset();
    });

    it('creates an admin user with a password', async () => {
        // given
        const wrapper = mountPage();
        await wrapper.get('#email').setValue('new@example.com');
        await wrapper.get('#display-name').setValue('New');
        await wrapper.get('#password').setValue('s3cret');
        await wrapper.get('#confirm-password').setValue('s3cret');

        // when
        await wrapper.get('button.btn-primary').trigger('click');
        await flushPromises();

        // then
        expect(mocks.create).toHaveBeenCalledWith({ email: 'new@example.com', password: 's3cret', displayName: 'New' });
        expect(mocks.push).toHaveBeenCalledWith('/admin/users');
    });

    it('leaves out an empty display name on create', async () => {
        const wrapper = mountPage();
        await wrapper.get('#email').setValue('new@example.com');
        await wrapper.get('#password').setValue('s3cret');
        await wrapper.get('#confirm-password').setValue('s3cret');

        await wrapper.get('button.btn-primary').trigger('click');
        await flushPromises();

        expect(mocks.create).toHaveBeenCalledWith({ email: 'new@example.com', password: 's3cret' });
    });

    it('shows an email conflict from the gateway on the email field', async () => {
        // given
        mocks.create.mockRejectedValue(new ApiError('409', "admin user email 'ops@example.com' is already in use"));
        const wrapper = mountPage();
        await wrapper.get('#email').setValue('ops@example.com');
        await wrapper.get('#password').setValue('s3cret');
        await wrapper.get('#confirm-password').setValue('s3cret');

        // when
        await wrapper.get('button.btn-primary').trigger('click');
        await flushPromises();

        // then
        expect(wrapper.get('#email + .field-error').text()).toContain('already in use');
        expect(mocks.push).not.toHaveBeenCalled();
        expect((wrapper.get('#password').element as HTMLInputElement).value).toBe('');
    });

    it('edits an admin user without asking for a password', async () => {
        // given
        mocks.params = { id: 'id-ops' };
        const wrapper = mountPage();

        // when
        expect(wrapper.find('#password').exists()).toBe(false);
        expect((wrapper.get('#email').element as HTMLInputElement).value).toBe('ops@example.com');
        await wrapper.get('#display-name').setValue('Operations');
        await wrapper.get('button.btn-primary').trigger('click');
        await flushPromises();

        // then
        expect(mocks.update).toHaveBeenCalledWith({ id: 'id-ops', body: { displayName: 'Operations' } });
        expect(mocks.push).toHaveBeenCalledWith('/admin/users');
    });

    it('sends nothing when an edit changes nothing', async () => {
        mocks.params = { id: 'id-ops' };
        const wrapper = mountPage();

        await wrapper.get('button.btn-primary').trigger('click');
        await flushPromises();

        expect(mocks.update).not.toHaveBeenCalled();
        expect(mocks.push).toHaveBeenCalledWith('/admin/users');
    });

    it('shows a not-found state for an unknown id', () => {
        mocks.params = { id: 'missing' };

        const wrapper = mountPage();

        expect(wrapper.text()).toContain('does not exist');
        expect(wrapper.find('#email').exists()).toBe(false);
    });
});
