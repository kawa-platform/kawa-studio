import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './error';
import { authorizeUrl, fetchLoginChallenge, fetchLoginClient, pkceChallenge, submitLogin } from './oauth';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('oauth client', () => {
    it('computes the S256 PKCE challenge of RFC 7636 appendix B', async () => {
        expect(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'))
            .toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
    });

    it('builds the authorization request for kawa studio', () => {
        // when
        const url = new URL(authorizeUrl('the-challenge', 'the-state'));

        // then
        expect(url.origin + url.pathname).toBe('http://localhost:8080/oauth/authorize');
        expect(Object.fromEntries(url.searchParams)).toEqual({
            response_type: 'code',
            client_id: 'kawa-studio',
            redirect_uri: window.location.origin + '/admin/auth/callback',
            code_challenge: 'the-challenge',
            code_challenge_method: 'S256',
            state: 'the-state',
        });
    });

    it('fetches a fresh login challenge as JSON without leaving the page', async () => {
        // given
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(JSON.stringify({ login_challenge: 'fresh-challenge' }), { status: 200 }));

        // when
        const challenge = await fetchLoginChallenge('the-challenge', 'the-state');

        // then
        expect(challenge).toBe('fresh-challenge');
        expect(fetchMock).toHaveBeenCalledWith(authorizeUrl('the-challenge', 'the-state'), expect.objectContaining({
            headers: { accept: 'application/json' },
            redirect: 'manual',
        }));
    });

    it('reports an expired sign-in when the gateway does not answer with a login challenge', async () => {
        // given: a gateway without JSON support redirects instead
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 302 }));

        // when
        const failure = fetchLoginChallenge('the-challenge', 'the-state');

        // then
        await expect(failure).rejects.toEqual(new ApiError('invalid_challenge', 'This sign-in took too long. Start again.'));
    });

    it('posts the login and returns where to send the browser', async () => {
        // given
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(JSON.stringify({ redirect_to: 'http://localhost:5173/admin/auth/callback?code=abc' }), { status: 200 }));

        // when
        const redirectTo = await submitLogin('the-challenge', 'admin', 's3cret');

        // then
        expect(redirectTo).toBe('http://localhost:5173/admin/auth/callback?code=abc');
        expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/oauth/login', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ login_challenge: 'the-challenge', username: 'admin', password: 's3cret' }),
        }));
    });

    it.each([
        ['invalid_credentials', 'Invalid username or password.'],
        ['invalid_challenge', 'This sign-in took too long. Start again.'],
    ])('reports a %s login error', async (error, message) => {
        // given
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error }), { status: 400 }));

        // when
        const failure = submitLogin('the-challenge', 'admin', 'wrong');

        // then
        await expect(failure).rejects.toEqual(new ApiError(error, message));
    });
});

describe('fetchLoginClient', () => {
    const asking = { clientId: 'https://a.example/c.json', clientName: 'A', redirectHost: 'localhost', audience: 'mcp', registered: false };

    it('asks the gateway who is behind the challenge', async () => {
        // given
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => asking });
        vi.stubGlobal('fetch', fetchMock);

        // when
        const client = await fetchLoginClient('a.b/c');

        // then
        expect(client).toEqual(asking);
        expect(fetchMock.mock.calls[0]![0]).toMatch(/\/oauth\/login-challenge\?login_challenge=a\.b%2Fc$/);
    });

    it.each([
        ['an expired challenge', () => vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({}) })],
        ['no answer', () => vi.fn().mockRejectedValue(new TypeError('network'))],
    ])('resolves null for %s', async (_, makeFetch) => {
        vi.stubGlobal('fetch', makeFetch());

        expect(await fetchLoginClient('x')).toBeNull();
    });
});
