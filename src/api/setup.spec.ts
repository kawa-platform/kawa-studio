import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './error';
import { fetchSetupRequired, submitSetup } from './setup';

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('fetchSetupRequired', () => {
    it('asks the public setup route, without a token', async () => {
        // given
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ required: true }));

        // when
        const required = await fetchSetupRequired();

        // then
        expect(required).toBe(true);
        expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/admin/setup');
    });

    it.each([404, 401])('needs no setup on a gateway without the route (%i)', async (status) => {
        // given
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ error: 'nope' }, status));

        // then
        await expect(fetchSetupRequired()).resolves.toBe(false);
    });

    it('fails with a network error when the gateway does not answer', async () => {
        // given
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

        // then
        await expect(fetchSetupRequired()).rejects.toMatchObject({ code: 'network' });
    });

    it('fails when the gateway answers with an error', async () => {
        // given
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ error: 'boom' }, 500));

        // then
        await expect(fetchSetupRequired()).rejects.toMatchObject({ code: '500' });
    });
});

describe('submitSetup', () => {
    const request = { token: 'tok', email: 'ops@example.com', password: 's3cret' };

    it('posts the token and credentials and resolves to the created admin user', async () => {
        // given
        const user = { id: 'u1', email: 'ops@example.com', displayName: null, enabled: true, createdAt: '2026-11-28T00:00:00Z' };
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(user, 201));

        // when
        const created = await submitSetup(request);

        // then
        expect(created).toEqual(user);
        expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/admin/setup', expect.objectContaining({
            method: 'POST', body: JSON.stringify(request),
        }));
        const headers = (fetchMock.mock.calls[0]?.[1] as RequestInit).headers;
        expect(headers).not.toHaveProperty('authorization');
    });

    it('places a wrong setup token on the token field', async () => {
        // given
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ error: 'invalid setup token' }, 401));

        // then
        await expect(submitSetup(request)).rejects.toEqual(new ApiError('401', 'That setup token is not valid.', 'token'));
    });

    it('reports that setup is no longer required', async () => {
        // given
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ error: 'setup is not required' }, 409));

        // then
        await expect(submitSetup(request)).rejects.toMatchObject({ code: '409' });
    });

    it.each([
        [{ error: 'password is too short' }],
        [{ error: { code: 'invalid', message: 'password is too short' } }],
    ])('surfaces the gateway\'s validation message from %j', async (body) => {
        // given
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(body, 400));

        // then
        await expect(submitSetup(request)).rejects.toMatchObject({ code: '400', message: 'password is too short' });
    });
});
