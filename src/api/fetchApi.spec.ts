import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { fetchApi } from './fetchApi';
import { ApiError } from './error';
import { useAuthStore } from '@/stores/auth';

/// An in-memory `localStorage`: Node's own global shadows jsdom's and is unusable without a file.
function memoryStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
    const items = new Map<string, string>();
    return {
        getItem: (key) => items.get(key) ?? null,
        setItem: (key, value) => void items.set(key, value),
        removeItem: (key) => void items.delete(key),
    };
}

beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
    setActivePinia(createPinia());
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

/// A token response as the admin server's `POST /oauth/token` returns it.
function tokens(access: string, refresh: string, expiresIn = 900): Response {
    return new Response(JSON.stringify({
        access_token: access, token_type: 'Bearer', expires_in: expiresIn, refresh_token: refresh,
    }), { status: 200 });
}

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('admin session', () => {
    const ADMIN = 'http://localhost:8080';

    /// A signed-in session, as a returning user has it in storage.
    async function signIn(expiresIn = 900): Promise<void> {
        localStorage.setItem('kawa.auth', JSON.stringify({
            accessToken: 'access-1', refreshToken: 'refresh-1', accessExpiresAt: Date.now() + expiresIn * 1000, username: 'admin',
        }));
    }

    it('sends no Authorization header without a session', async () => {
        // given
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json([]));

        // when
        await fetchApi.listClients();

        // then
        const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
        expect(init.headers).not.toHaveProperty('authorization');
    });

    it('sends the access token as a bearer token', async () => {
        // given
        await signIn();
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json([]));

        // when
        await fetchApi.listClients();

        // then
        expect(fetchMock).toHaveBeenCalledWith(`${ADMIN}/auth/clients`, expect.objectContaining({
            headers: expect.objectContaining({ authorization: 'Bearer access-1' }),
        }));
    });

    it('refreshes and retries once when the gateway answers 401', async () => {
        // given
        await signIn();
        const fetchMock = vi.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(json({ error: 'unauthorized' }, 401))
            .mockResolvedValueOnce(tokens('access-2', 'refresh-2'))
            .mockResolvedValueOnce(json([]));

        // when
        const result = await fetchApi.listClients();

        // then
        expect(result).toEqual([]);
        expect(fetchMock).toHaveBeenNthCalledWith(2, `${ADMIN}/oauth/token`, expect.objectContaining({
            body: 'grant_type=refresh_token&refresh_token=refresh-1',
        }));
        expect(fetchMock).toHaveBeenNthCalledWith(3, `${ADMIN}/auth/clients`, expect.objectContaining({
            headers: expect.objectContaining({ authorization: 'Bearer access-2' }),
        }));
    });

    it('refreshes an access token that is about to expire before sending', async () => {
        // given
        await signIn(10);
        const fetchMock = vi.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(tokens('access-2', 'refresh-2'))
            .mockResolvedValueOnce(json([]));

        // when
        await fetchApi.listClients();

        // then
        expect(fetchMock).toHaveBeenNthCalledWith(1, `${ADMIN}/oauth/token`, expect.anything());
        expect(fetchMock).toHaveBeenNthCalledWith(2, `${ADMIN}/auth/clients`, expect.objectContaining({
            headers: expect.objectContaining({ authorization: 'Bearer access-2' }),
        }));
    });

    it('drops the session and asks for a login when the refresh fails', async () => {
        // given
        await signIn();
        const auth = useAuthStore();
        vi.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(json({ error: 'unauthorized' }, 401))
            .mockResolvedValueOnce(json({ error: 'invalid_grant' }, 400));

        // when
        const failure = fetchApi.listClients();

        // then
        await expect(failure).rejects.toEqual(new ApiError('401', 'Your session has expired. Sign in again.'));
        expect(auth.isAuthenticated).toBe(false);
        expect(auth.loginRequests).toBe(1);
    });

    it('asks for a login when the gateway requires one and there is no session', async () => {
        // given
        const auth = useAuthStore();
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ error: 'unauthorized' }, 401));

        // when
        const failure = fetchApi.listClients();

        // then
        await expect(failure).rejects.toBeInstanceOf(ApiError);
        expect(auth.loginRequests).toBe(1);
    });
});

describe('auth clients', () => {
    const ADMIN = 'http://localhost:8080';

    it('creates a client through PUT /auth/clients/{name} on the admin API', async () => {
        const client = { mechanism: 'PLAIN', password: 'secret', groups: ['producers', 'admins'] };
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(JSON.stringify(client), { status: 200, headers: { 'content-type': 'application/json' } }),
        );

        const result = await fetchApi.upsertClient('alice', client);

        expect(result).toEqual(client);
        expect(fetchMock).toHaveBeenCalledWith(
            `${ADMIN}/auth/clients/alice`,
            {
                method: 'PUT',
                body: JSON.stringify(client),
                headers: { 'content-type': 'application/json' },
            },
        );
    });

    it('resets a password through PATCH /auth/clients/{name} with a password-only body', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(JSON.stringify({}), { status: 200, headers: { 'content-type': 'application/json' } }),
        );

        await fetchApi.resetPassword('alice', 'new-secret');

        expect(fetchMock).toHaveBeenCalledWith(
            `${ADMIN}/auth/clients/alice`,
            {
                method: 'PATCH',
                body: JSON.stringify({ password: 'new-secret' }),
                headers: { 'content-type': 'application/json' },
            },
        );
    });

    it('patches a client mechanism through PATCH /auth/clients/{name}', async () => {
        const client = { username: 'alice', mechanism: 'SCRAM-SHA-256' };
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(JSON.stringify(client), { status: 200, headers: { 'content-type': 'application/json' } }),
        );

        const result = await fetchApi.patchClient('alice', { mechanism: 'SCRAM-SHA-256' });

        expect(result).toEqual(client);
        expect(fetchMock).toHaveBeenCalledWith(
            `${ADMIN}/auth/clients/alice`,
            {
                method: 'PATCH',
                body: JSON.stringify({ mechanism: 'SCRAM-SHA-256' }),
                headers: { 'content-type': 'application/json' },
            },
        );
    });

    it('deletes a client through DELETE /auth/clients/{name}', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));

        await fetchApi.deleteClient('alice');

        expect(fetchMock).toHaveBeenCalledWith(
            `${ADMIN}/auth/clients/alice`,
            { method: 'DELETE', headers: { 'content-type': 'application/json' } },
        );
    });
});

describe('virtual topics', () => {
    const ADMIN = 'http://localhost:8080';

    it('patches an existing virtual topic through the admin API without a type discriminator', async () => {
        const request = {
            name: 'orders-eu',
            topic: 'orders-v2',
            valueFormat: { type: 'json' as const },
            filter: { type: 'headerEquals' as const, header: 'region', value: 'eu' },
            exposePhysicalTopic: true,
        };
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(JSON.stringify(request), { status: 200 }),
        );

        await fetchApi.patchVirtualTopic('orders', request);

        expect(fetchMock).toHaveBeenCalledWith(
            `${ADMIN}/topics/orders`,
            {
                method: 'PATCH',
                // The admin deserializes PATCH bodies into VirtualTopicConfigPatch,
                // which has no `type` field — sending one would 400.
                body: JSON.stringify(request),
                headers: { 'content-type': 'application/json' },
            },
        );
    });

    it('sends filter: null to clear a virtual topic filter on patch', async () => {
        const request = { topic: 'orders-v2', filter: null, valueFormat: null };
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(JSON.stringify(request), { status: 200 }),
        );

        await fetchApi.patchVirtualTopic('orders', request);

        expect(fetchMock).toHaveBeenCalledWith(
            `${ADMIN}/topics/orders`,
            {
                method: 'PATCH',
                body: '{"topic":"orders-v2","filter":null,"valueFormat":null}',
                headers: { 'content-type': 'application/json' },
            },
        );
    });

    it('puts the virtual-topic configuration to PUT /topics/{name} on the admin API', async () => {
        const response = {
            topic: 'orders-v2',
            exposePhysicalTopic: false,
            valueFormat: { type: 'json' as const },
            filter: { type: 'headerMatches' as const, header: 'tenant', value: 'eu.*' },
        };
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(JSON.stringify(response), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            }),
        );

        const result = await fetchApi.upsertVirtualTopic('orders eu', response);

        expect(result).toEqual(response);
        expect(fetchMock).toHaveBeenCalledWith(
            `${ADMIN}/topics/orders%20eu`,
            {
                method: 'PUT',
                body: JSON.stringify({ type: 'virtual', ...response }),
                headers: { 'content-type': 'application/json' },
            },
        );
    });

    it('carries the type discriminator and omits the filter when not requested', async () => {
        const request = { topic: 'orders-v2', exposePhysicalTopic: true };
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(JSON.stringify(request), { status: 200 }),
        );

        await fetchApi.upsertVirtualTopic('orders.eu', request);

        expect(fetchMock).toHaveBeenCalledWith(
            `${ADMIN}/topics/orders.eu`,
            {
                method: 'PUT',
                body: '{"type":"virtual","topic":"orders-v2","exposePhysicalTopic":true}',
                headers: { 'content-type': 'application/json' },
            },
        );
    });

    it('deletes through DELETE /topics/{name} on the admin API', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));

        await fetchApi.deleteVirtualTopic('orders.eu');

        expect(fetchMock).toHaveBeenCalledWith(
            `${ADMIN}/topics/orders.eu`,
            { method: 'DELETE', headers: { 'content-type': 'application/json' } },
        );
    });
});

describe('physical topics', () => {
    const ADMIN = 'http://localhost:8080';

    it('creates through POST /topics on the admin API with the physical type discriminator', async () => {
        const request = {
            name: 'orders',
            partitions: 3,
            replicationFactor: 3,
            configs: { 'cleanup.policy': 'compact' },
        };
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(JSON.stringify(request), { status: 201 }),
        );

        const result = await fetchApi.createPhysicalTopic(request);

        expect(result).toEqual(request);
        expect(fetchMock).toHaveBeenCalledWith(
            `${ADMIN}/topics`,
            {
                method: 'POST',
                body: JSON.stringify({ type: 'physical', ...request }),
                headers: { 'content-type': 'application/json' },
            },
        );
    });

    it('omits partitions and replication factor from the body when not supplied', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(JSON.stringify({ name: 'orders' }), { status: 201 }),
        );

        await fetchApi.createPhysicalTopic({ name: 'orders' });

        expect(fetchMock).toHaveBeenCalledWith(
            `${ADMIN}/topics`,
            {
                method: 'POST',
                body: '{"type":"physical","name":"orders"}',
                headers: { 'content-type': 'application/json' },
            },
        );
    });
});

describe('rbac groups', () => {
    const ADMIN = 'http://localhost:8080';

    it('renames a group through PATCH /rbac/groups/{name}', async () => {
        const response = { name: 'publishers', clients: ['alice'], roles: ['admin'] };
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(JSON.stringify(response), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            }),
        );

        const result = await fetchApi.renameRbacGroup('producers', { name: 'publishers' });

        expect(result).toEqual(response);
        expect(fetchMock).toHaveBeenCalledWith(
            `${ADMIN}/rbac/groups/producers`,
            {
                method: 'PATCH',
                body: JSON.stringify({ name: 'publishers' }),
                headers: { 'content-type': 'application/json' },
            },
        );
    });
});
