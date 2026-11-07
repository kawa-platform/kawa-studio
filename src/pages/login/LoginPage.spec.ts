import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/error';
import LoginPage from './LoginPage.vue';

const mocks = vi.hoisted(() => ({
    submitLogin: vi.fn(),
    fetchLoginClient: vi.fn(),
    beginLogin: vi.fn(),
    renewLogin: vi.fn(),
    pendingReturnTo: vi.fn(),
    replace: vi.fn(),
    assign: vi.fn(),
    continueLogin: vi.fn(),
    refresh: vi.fn(),
    expiresSoon: vi.fn(),
    auth: { isAuthenticated: false, username: null as string | null, accessToken: null as string | null },
    query: {} as Record<string, string>,
}));

vi.mock('@/api/oauth', () => ({ CLIENT_ID: 'kawa-studio', submitLogin: mocks.submitLogin, continueLogin: mocks.continueLogin, fetchLoginClient: mocks.fetchLoginClient }));

vi.mock('@/stores/auth', () => ({
    useAuthStore: () => ({
        beginLogin: mocks.beginLogin, renewLogin: mocks.renewLogin, pendingReturnTo: mocks.pendingReturnTo,
        refresh: mocks.refresh, expiresSoon: mocks.expiresSoon,
        get isAuthenticated() { return mocks.auth.isAuthenticated; },
        get username() { return mocks.auth.username; },
        get accessToken() { return mocks.auth.accessToken; },
    }),
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
        mocks.fetchLoginClient.mockReset().mockResolvedValue(null);
        mocks.beginLogin.mockReset();
        mocks.renewLogin.mockReset().mockResolvedValue('fresh-challenge');
        mocks.replace.mockReset();
        mocks.pendingReturnTo.mockReset().mockReturnValue(null);
        mocks.assign.mockReset();
        mocks.continueLogin.mockReset().mockResolvedValue('http://localhost:7000/callback?code=tok&state=s');
        mocks.refresh.mockReset().mockResolvedValue(true);
        mocks.expiresSoon.mockReset().mockReturnValue(false);
        mocks.auth.isAuthenticated = false;
        mocks.auth.username = null;
        mocks.auth.accessToken = null;
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

    describe('consent', () => {
        const asking = { clientId: 'https://agent.example.com/client.json', clientName: 'Acme Agent', redirectHost: 'localhost', audience: 'mcp' as const, registered: true };
        const asAdmin = { ...asking, audience: 'admin' as const };

        async function open(client: unknown) {
            mocks.fetchLoginClient.mockResolvedValue(client);
            const wrapper = mount(LoginPage);
            await flushPromises();
            return wrapper;
        }

        function signedIn(username = 'alice@kawa') {
            mocks.auth.isAuthenticated = true;
            mocks.auth.username = username;
            mocks.auth.accessToken = 'access-token';
        }

        describe('for an MCP client', () => {
            it('replaces the intro with a focused MCP consent', async () => {
                // when
                const wrapper = await open(asking);

                // then
                expect(mocks.fetchLoginClient).toHaveBeenCalledWith('the-challenge');
                expect(wrapper.find('.intro').exists()).toBe(false);
                const panel = wrapper.get('[aria-label="MCP access request"]');
                expect(panel.get('.badge').text()).toBe('MCP');
                expect(panel.get('h1').text()).toBe('Authorize MCP access');
                expect(panel.text()).toContain('Acme Agent is asking to use kawa’s MCP tools on your behalf');
                expect(panel.findAll('.can li').length).toBeGreaterThan(0);
                expect(panel.text()).toContain('No access to the rest of the admin API');
                expect(panel.text()).toContain('localhost');
                expect(panel.text()).toContain('https://agent.example.com/client.json');
                expect(panel.text()).toContain('Closing this tab cancels');
            });

            it('offers only the continue action, with no deny button and no alert', async () => {
                // when
                const wrapper = await open(asking);

                // then
                expect(wrapper.get('button[type="submit"]').text()).toBe('Continue');
                expect(wrapper.findAll('button').map((button) => button.text())).toEqual(['Continue']);
                expect(wrapper.find('[role="alert"]').exists()).toBe(false);
                expect(wrapper.find('.consent').exists()).toBe(false);
            });

            it('grants the access only once Authorize is pressed after the credentials', async () => {
                // given
                const wrapper = await open(asking);
                await wrapper.get('#username').setValue('admin@kawa');
                await wrapper.get('#password').setValue('s3cret');

                // when: the credentials are submitted
                await wrapper.get('form').trigger('submit');
                await flushPromises();

                // then: nothing is sent, and the user is asked to authorize
                expect(mocks.submitLogin).not.toHaveBeenCalled();
                expect(wrapper.find('#password').exists()).toBe(false);
                expect(wrapper.get('h2').text()).toBe('Authorize access');
                expect(wrapper.findAll('button').map((button) => button.text())).toEqual(['Authorize', 'Back']);

                // when
                await wrapper.get('form').trigger('submit');
                await flushPromises();

                // then
                expect(mocks.submitLogin).toHaveBeenCalledWith('the-challenge', 'admin@kawa', 's3cret');
                expect(mocks.assign).toHaveBeenCalledWith('http://localhost:5173/admin/auth/callback?code=abc&state=xyz');
            });

            it('returns to the form with the error when the credentials turn out wrong', async () => {
                // given
                mocks.submitLogin.mockRejectedValue(new ApiError('invalid_credentials', 'Invalid username or password.'));
                const wrapper = await open(asking);
                await wrapper.get('#username').setValue('admin');
                await wrapper.get('#password').setValue('wrong');
                await wrapper.get('form').trigger('submit');

                // when
                await wrapper.get('form').trigger('submit');
                await flushPromises();

                // then
                expect(wrapper.get('[role="alert"]').text()).toBe('Invalid username or password.');
                expect(wrapper.find('#password').exists()).toBe(true);
            });
        });

        describe('for an admin client', () => {
            it('keeps the intro and shows the consent block before the credentials', async () => {
                // when
                const wrapper = await open(asAdmin);

                // then
                expect(wrapper.find('.intro').exists()).toBe(true);
                expect(wrapper.find('[aria-label="MCP access request"]').exists()).toBe(false);
                const consent = wrapper.get('.consent');
                expect(consent.text()).toContain('Acme Agent');
                expect(consent.text()).toContain('https://agent.example.com/client.json');
                expect(consent.text()).toContain('localhost');
                expect(consent.text()).toContain('full access');
                expect(consent.find('[role="alert"]').exists()).toBe(false);
                expect(wrapper.html().indexOf('class="consent"')).toBeLessThan(wrapper.html().indexOf('id="username"'));
                expect(wrapper.get('button[type="submit"]').text()).toBe('Sign in');
            });
        });

        it('shows nothing extra for studio signing itself in, or when the gateway cannot say', async () => {
            // given: studio's own client, then no answer
            const studio = await open({ ...asking, clientId: 'kawa-studio', clientName: 'kawa-studio' });
            const unknown = await open(null);

            // then
            for (const wrapper of [studio, unknown]) {
                expect(wrapper.find('.consent').exists()).toBe(false);
                expect(wrapper.find('[aria-label="MCP access request"]').exists()).toBe(false);
                expect(wrapper.find('.intro').exists()).toBe(true);
                expect(wrapper.find('form').exists()).toBe(true);
                expect(wrapper.get('button[type="submit"]').text()).toBe('Sign in');
            }
        });

        describe.each([['an MCP client', asking], ['an admin client', asAdmin]])('continue as, for %s', (_name, client) => {
            it('is not offered when nobody is signed in', async () => {
                // when
                const wrapper = await open(client);

                // then
                expect(wrapper.text()).not.toContain('Continue as');
                expect(wrapper.find('#username').exists()).toBe(true);
            });

            it('signs the signed-in user in with their token, only after an explicit click', async () => {
                // given
                signedIn();
                const wrapper = await open(client);
                expect(mocks.continueLogin).not.toHaveBeenCalled();
                expect(wrapper.find('#username').exists()).toBe(false);
                expect(wrapper.get('button.btn-primary').text()).toContain('Continue as alice@kawa');

                // when
                await wrapper.get('button.btn-primary').trigger('click');
                await flushPromises();

                // then
                expect(mocks.continueLogin).toHaveBeenCalledWith('the-challenge', 'access-token');
                expect(mocks.submitLogin).not.toHaveBeenCalled();
                expect(mocks.assign).toHaveBeenCalledWith('http://localhost:7000/callback?code=tok&state=s');
            });

            it('falls back to the password form on "Use a different account"', async () => {
                // given
                signedIn();
                const wrapper = await open(client);

                // when
                await wrapper.get('button.link').trigger('click');

                // then
                expect(wrapper.text()).not.toContain('Continue as');
                expect(wrapper.find('#username').exists()).toBe(true);
                expect(mocks.continueLogin).not.toHaveBeenCalled();
            });
        });

        it('refreshes an access token that is about to expire before continuing', async () => {
            // given
            signedIn();
            mocks.expiresSoon.mockReturnValue(true);
            const wrapper = await open(asking);

            // when
            await wrapper.get('button.btn-primary').trigger('click');
            await flushPromises();

            // then
            expect(mocks.refresh).toHaveBeenCalledTimes(1);
            expect(mocks.continueLogin).toHaveBeenCalledTimes(1);
        });

        it('shows the password form when the session cannot be refreshed', async () => {
            // given
            signedIn();
            mocks.expiresSoon.mockReturnValue(true);
            mocks.refresh.mockResolvedValue(false);
            const wrapper = await open(asking);

            // when
            await wrapper.get('button.btn-primary').trigger('click');
            await flushPromises();

            // then
            expect(mocks.continueLogin).not.toHaveBeenCalled();
            expect(wrapper.find('#username').exists()).toBe(true);
            expect(wrapper.get('.error').text()).toContain('Sign in with your password');
        });

        it('shows the password form when the gateway refuses the token', async () => {
            // given
            signedIn();
            mocks.continueLogin.mockRejectedValue(new ApiError('invalid_credentials', 'Invalid username or password.'));
            const wrapper = await open(asking);

            // when
            await wrapper.get('button.btn-primary').trigger('click');
            await flushPromises();

            // then
            expect(mocks.assign).not.toHaveBeenCalled();
            expect(wrapper.find('#username').exists()).toBe(true);
            expect(wrapper.get('.error').text()).toContain('Sign in with your password');
        });

        it('continues with a fresh challenge when the one it was opened with has expired', async () => {
            // given
            signedIn();
            mocks.continueLogin
                .mockRejectedValueOnce(new ApiError('invalid_challenge', 'This sign-in took too long. Start again.'))
                .mockResolvedValueOnce('http://localhost:7000/callback?code=2&state=s');
            const wrapper = await open(asking);

            // when
            await wrapper.get('button.btn-primary').trigger('click');
            await flushPromises();

            // then
            expect(mocks.continueLogin).toHaveBeenLastCalledWith('fresh-challenge', 'access-token');
            expect(mocks.assign).toHaveBeenCalledWith('http://localhost:7000/callback?code=2&state=s');
        });
    });
});
