import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ApiError } from '@/api/error';
import { useAuthStore } from './auth';

const mocks = vi.hoisted(() => ({
    requestCodeTokens: vi.fn(),
    requestRefreshedTokens: vi.fn(),
    fetchLoginChallenge: vi.fn(),
    assign: vi.fn(),
}));

vi.mock('@/api/oauth', () => ({
    requestCodeTokens: mocks.requestCodeTokens,
    requestRefreshedTokens: mocks.requestRefreshedTokens,
    fetchLoginChallenge: mocks.fetchLoginChallenge,
    createPkce: async () => ({ verifier: 'the-verifier', challenge: 'the-challenge' }),
    randomToken: () => 'the-state',
    authorizeUrl: (challenge: string, state: string) => `http://kawa/oauth/authorize?code_challenge=${challenge}&state=${state}`,
}));

/// A JWT whose payload carries `sub` and, optionally, `preferred_username`; the signature is
/// irrelevant to the UI.
function jwt(sub: string, preferredUsername?: string): string {
    const claims = preferredUsername === undefined ? { sub } : { sub, preferred_username: preferredUsername };
    return 'header.' + btoa(JSON.stringify(claims)).replace(/=+$/, '') + '.signature';
}

function tokens(access: string, refresh: string, expiresIn = 900) {
    return { access_token: access, token_type: 'Bearer', expires_in: expiresIn, refresh_token: refresh };
}

function memoryStorage(items: Map<string, string>) {
    return {
        getItem: (key: string) => items.get(key) ?? null,
        setItem: (key: string, value: string) => void items.set(key, value),
        removeItem: (key: string) => void items.delete(key),
    };
}

describe('auth store', () => {
    let storage: Map<string, string>;
    let session: Map<string, string>;

    beforeEach(() => {
        storage = new Map();
        session = new Map();
        vi.stubGlobal('localStorage', memoryStorage(storage));
        vi.stubGlobal('sessionStorage', memoryStorage(session));
        vi.stubGlobal('location', { assign: mocks.assign, origin: 'http://localhost:5173' });
        setActivePinia(createPinia());
        mocks.requestCodeTokens.mockReset();
        mocks.requestRefreshedTokens.mockReset();
        mocks.assign.mockReset();
        mocks.fetchLoginChallenge.mockReset().mockResolvedValue('fresh-challenge');
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    /// Runs a login the way the browser does: begin (redirect away), then complete on the callback.
    async function signIn(user = 'alice', expiresIn = 900): Promise<string> {
        mocks.requestCodeTokens.mockResolvedValue(tokens(jwt(user), 'refresh-1', expiresIn));
        const auth = useAuthStore();
        await auth.beginLogin('/rbac/roles');
        return auth.completeLogin('the-code', 'the-state');
    }

    it('begins a login by sending the browser to the authorization endpoint with a PKCE challenge', async () => {
        // when
        await useAuthStore().beginLogin('/rbac/roles');

        // then
        expect(mocks.assign).toHaveBeenCalledWith('http://kawa/oauth/authorize?code_challenge=the-challenge&state=the-state');
        expect(JSON.parse(session.get('kawa.auth.pending') ?? 'null'))
            .toEqual({ verifier: 'the-verifier', state: 'the-state', returnTo: '/rbac/roles' });
    });

    it('renews a login in place with a fresh challenge and a new pending login', async () => {
        // when
        const challenge = await useAuthStore().renewLogin('/rbac/roles');

        // then
        expect(challenge).toBe('fresh-challenge');
        expect(mocks.fetchLoginChallenge).toHaveBeenCalledWith('the-challenge', 'the-state');
        expect(mocks.assign).not.toHaveBeenCalled();
        expect(JSON.parse(session.get('kawa.auth.pending') ?? 'null'))
            .toEqual({ verifier: 'the-verifier', state: 'the-state', returnTo: '/rbac/roles' });
    });

    it('shows the admin user by their email rather than the id in the token subject', async () => {
        // given
        mocks.requestCodeTokens.mockResolvedValue(
            tokens(jwt('3f2c1a9e-5b7d-4c1e-9a2b-6d8e0f1a2b3c', 'alice@mycom.com'), 'refresh-1'));
        const auth = useAuthStore();
        await auth.beginLogin('/rbac/roles');

        // when
        await auth.completeLogin('the-code', 'the-state');

        // then
        expect(auth.username).toBe('alice@mycom.com');
    });

    it('completes the login with the code and verifier, persists the session and returns where it began', async () => {
        // when
        const returnTo = await signIn('alice');

        // then
        const auth = useAuthStore();
        expect(mocks.requestCodeTokens).toHaveBeenCalledWith('the-code', 'the-verifier');
        expect(returnTo).toBe('/rbac/roles');
        expect(auth.username).toBe('alice');
        expect(session.has('kawa.auth.pending')).toBe(false);
        await Promise.resolve();
        expect(JSON.parse(storage.get('kawa.auth') ?? 'null')).toMatchObject({ refreshToken: 'refresh-1' });
    });

    it('refuses a callback whose state does not match the login started in this tab', async () => {
        // given
        const auth = useAuthStore();
        await auth.beginLogin('/topics');

        // when
        const completion = auth.completeLogin('the-code', 'forged-state');

        // then
        await expect(completion).rejects.toBeInstanceOf(ApiError);
        expect(mocks.requestCodeTokens).not.toHaveBeenCalled();
        expect(auth.isAuthenticated).toBe(false);
    });

    it('restores a persisted session', () => {
        // given
        storage.set('kawa.auth', JSON.stringify({
            accessToken: 'access-1', refreshToken: 'refresh-1', accessExpiresAt: Date.now() + 60_000, username: 'alice',
        }));

        // when
        const auth = useAuthStore();

        // then
        expect(auth.isAuthenticated).toBe(true);
        expect(auth.accessToken).toBe('access-1');
    });

    it('shares one refresh between concurrent callers and rotates the tokens', async () => {
        // given
        await signIn();
        mocks.requestRefreshedTokens.mockResolvedValue(tokens(jwt('alice'), 'refresh-2'));
        const auth = useAuthStore();

        // when
        const results = await Promise.all([auth.refresh(), auth.refresh()]);

        // then
        expect(results).toEqual([true, true]);
        expect(mocks.requestRefreshedTokens).toHaveBeenCalledTimes(1);
        expect(mocks.requestRefreshedTokens).toHaveBeenCalledWith('refresh-1');
        await auth.refresh();
        expect(mocks.requestRefreshedTokens).toHaveBeenLastCalledWith('refresh-2');
    });

    it('drops the session when the refresh is rejected', async () => {
        // given
        await signIn();
        mocks.requestRefreshedTokens.mockRejectedValue(new Error('invalid_grant'));
        const auth = useAuthStore();

        // when
        const refreshed = await auth.refresh();

        // then
        expect(refreshed).toBe(false);
        expect(auth.isAuthenticated).toBe(false);
    });

    it('reports an access token that is about to expire', async () => {
        // given
        await signIn('alice', 900);
        const auth = useAuthStore();

        // then
        expect(auth.expiresSoon()).toBe(false);
        expect(auth.expiresSoon(Date.now() + 890_000)).toBe(true);
    });

    it('logs out and forgets the persisted session', async () => {
        // given
        await signIn();
        const auth = useAuthStore();

        // when
        auth.logout();
        await Promise.resolve();

        // then
        expect(auth.isAuthenticated).toBe(false);
        expect(storage.has('kawa.auth')).toBe(false);
    });
});
