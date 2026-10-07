import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/error';
import CallbackPage from './CallbackPage.vue';

const mocks = vi.hoisted(() => ({
    completeLogin: vi.fn(),
    beginLogin: vi.fn(),
    replace: vi.fn(),
    clear: vi.fn(),
    query: {} as Record<string, string>,
}));

vi.mock('@/stores/auth', () => ({
    useAuthStore: () => ({ completeLogin: mocks.completeLogin, beginLogin: mocks.beginLogin }),
}));

vi.mock('@/stores/ui', () => ({ useUiStore: () => ({}) }));

vi.mock('@tanstack/vue-query', () => ({ useQueryClient: () => ({ clear: mocks.clear }) }));

vi.mock('vue-router', () => ({
    useRoute: () => ({ query: mocks.query }),
    useRouter: () => ({ replace: mocks.replace }),
}));

describe('CallbackPage', () => {
    beforeEach(() => {
        mocks.completeLogin.mockReset().mockResolvedValue('/rbac/roles');
        mocks.beginLogin.mockReset();
        mocks.replace.mockReset();
        mocks.clear.mockReset();
        mocks.query = { code: 'abc', state: 'xyz' };
    });

    it('redeems the code and opens the page the login started from', async () => {
        // when
        mount(CallbackPage);
        await flushPromises();

        // then
        expect(mocks.completeLogin).toHaveBeenCalledWith('abc', 'xyz');
        expect(mocks.clear).toHaveBeenCalled();
        expect(mocks.replace).toHaveBeenCalledWith('/rbac/roles');
    });

    it('never follows a return path that leaves the app', async () => {
        // given
        mocks.completeLogin.mockResolvedValue('//evil.example');

        // when
        mount(CallbackPage);
        await flushPromises();

        // then
        expect(mocks.replace).toHaveBeenCalledWith('/topics');
    });

    it('shows the authorization server error and offers to sign in again', async () => {
        // given
        mocks.query = { error: 'invalid_request', error_description: 'PKCE with S256 is required' };

        // when
        const wrapper = mount(CallbackPage);
        await flushPromises();
        await wrapper.get('button').trigger('click');

        // then
        expect(wrapper.get('.error').text()).toBe('PKCE with S256 is required');
        expect(mocks.completeLogin).not.toHaveBeenCalled();
        expect(mocks.beginLogin).toHaveBeenCalledWith('/topics');
    });

    it('shows why the code could not be redeemed', async () => {
        // given
        mocks.completeLogin.mockRejectedValue(new ApiError('invalid_state', 'This sign-in was not started here. Start again.'));

        // when
        const wrapper = mount(CallbackPage);
        await flushPromises();

        // then
        expect(wrapper.get('.error').text()).toBe('This sign-in was not started here. Start again.');
        expect(mocks.replace).not.toHaveBeenCalled();
    });
});
