import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/error';
import LoginPage from './LoginPage.vue';

const mocks = vi.hoisted(() => ({
    submitLogin: vi.fn(),
    beginLogin: vi.fn(),
    renewLogin: vi.fn(),
    pendingReturnTo: vi.fn(),
    replace: vi.fn(),
    assign: vi.fn(),
    query: {} as Record<string, string>,
}));

vi.mock('@/api/oauth', () => ({ submitLogin: mocks.submitLogin }));

vi.mock('@/stores/auth', () => ({
    useAuthStore: () => ({ beginLogin: mocks.beginLogin, renewLogin: mocks.renewLogin, pendingReturnTo: mocks.pendingReturnTo }),
}));

vi.mock('@/stores/ui', () => ({ useUiStore: () => ({}) }));

vi.mock('vue-router', () => ({ useRoute: () => ({ query: mocks.query }), useRouter: () => ({ replace: mocks.replace }) }));

async function signIn(username: string, password: string) {
    const wrapper = mount(LoginPage);
    await wrapper.get('#username').setValue(username);
    await wrapper.get('#password').setValue(password);
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    return wrapper;
}

describe('LoginPage', () => {
    beforeEach(() => {
        mocks.submitLogin.mockReset().mockResolvedValue('http://localhost:5173/admin/auth/callback?code=abc&state=xyz');
        mocks.beginLogin.mockReset();
        mocks.renewLogin.mockReset().mockResolvedValue('fresh-challenge');
        mocks.replace.mockReset();
        mocks.pendingReturnTo.mockReset().mockReturnValue(null);
        mocks.assign.mockReset();
        mocks.query = { login_challenge: 'the-challenge' };
        vi.stubGlobal('location', { assign: mocks.assign });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('logs in for the login challenge and follows the redirect back to the client', async () => {
        // when
        await signIn(' admin ', 's3cret');

        // then
        expect(mocks.submitLogin).toHaveBeenCalledWith('the-challenge', 'admin', 's3cret');
        expect(mocks.assign).toHaveBeenCalledWith('http://localhost:5173/admin/auth/callback?code=abc&state=xyz');
    });

    it('does not renew the challenge when the credentials are rejected', async () => {
        // given
        mocks.submitLogin.mockRejectedValue(new ApiError('invalid_credentials', 'Invalid username or password.'));

        // when
        await signIn('admin', 'wrong');

        // then
        expect(mocks.renewLogin).not.toHaveBeenCalled();
        expect(mocks.submitLogin).toHaveBeenCalledTimes(1);
    });

    it('shows the gateway error and clears the password when the credentials are rejected', async () => {
        // given
        mocks.submitLogin.mockRejectedValue(new ApiError('invalid_credentials', 'Invalid username or password.'));

        // when
        const wrapper = await signIn('admin', 'wrong');

        // then
        expect(wrapper.get('.error').text()).toBe('Invalid username or password.');
        expect((wrapper.get('#password').element as HTMLInputElement).value).toBe('');
        expect(mocks.assign).not.toHaveBeenCalled();
    });

    it('signs in with a fresh challenge when the one it was opened with has expired', async () => {
        // given
        mocks.submitLogin
            .mockRejectedValueOnce(new ApiError('invalid_challenge', 'This sign-in took too long. Start again.'))
            .mockResolvedValueOnce('http://localhost:5173/admin/auth/callback?code=def&state=fresh');
        mocks.pendingReturnTo.mockReturnValue('/rbac/roles');

        // when
        const wrapper = await signIn('admin@kawa', 's3cret');

        // then
        expect(mocks.renewLogin).toHaveBeenCalledWith('/rbac/roles');
        expect(mocks.submitLogin).toHaveBeenLastCalledWith('fresh-challenge', 'admin@kawa', 's3cret');
        expect(mocks.replace).toHaveBeenCalledWith({ query: { login_challenge: 'fresh-challenge' } });
        expect(mocks.assign).toHaveBeenCalledWith('http://localhost:5173/admin/auth/callback?code=def&state=fresh');
        expect(wrapper.find('.error').exists()).toBe(false);
    });

    it('offers to start again when no fresh challenge can be fetched', async () => {
        // given
        mocks.submitLogin.mockRejectedValue(new ApiError('invalid_challenge', 'This sign-in took too long. Start again.'));
        mocks.renewLogin.mockRejectedValue(new ApiError('invalid_challenge', 'This sign-in took too long. Start again.'));
        mocks.pendingReturnTo.mockReturnValue('/rbac/roles');
        const wrapper = await signIn('admin', 's3cret');
        expect(wrapper.get('.error').text()).toBe('This sign-in took too long. Start again.');

        // when
        await wrapper.get('button.btn-secondary').trigger('click');

        // then
        expect(mocks.beginLogin).toHaveBeenCalledWith('/rbac/roles');
    });

    it('starts the login flow when opened without a login challenge', async () => {
        // given
        mocks.query = { redirect: '/clients' };

        // when
        mount(LoginPage);
        await flushPromises();

        // then
        expect(mocks.beginLogin).toHaveBeenCalledWith('/clients');
    });

    it('does not submit an incomplete form', async () => {
        // when
        const wrapper = await signIn('', '');

        // then
        expect(mocks.submitLogin).not.toHaveBeenCalled();
        expect(wrapper.findAll('.field-error').map((error) => error.text()))
            .toEqual(['Enter your username.', 'Enter your password.']);
    });
});
