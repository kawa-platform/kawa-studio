import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpApi } from './http';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('auth clients', () => {
    const ADMIN = 'http://localhost:8080';

    it('creates a client through PUT /auth/clients/{name} on the admin API', async () => {
        const client = { mechanism: 'PLAIN', password: 'secret', groups: ['producers', 'admins'] };
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(JSON.stringify(client), { status: 200, headers: { 'content-type': 'application/json' } }),
        );

        const result = await httpApi.upsertClient('alice', client);

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

        await httpApi.resetPassword('alice', 'new-secret');

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

        const result = await httpApi.patchClient('alice', { mechanism: 'SCRAM-SHA-256' });

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

        await httpApi.deleteClient('alice');

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

        await httpApi.patchVirtualTopic('orders', request);

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

        await httpApi.patchVirtualTopic('orders', request);

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

        const result = await httpApi.upsertVirtualTopic('orders eu', response);

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

        await httpApi.upsertVirtualTopic('orders.eu', request);

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

        await httpApi.deleteVirtualTopic('orders.eu');

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

        const result = await httpApi.createPhysicalTopic(request);

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

        await httpApi.createPhysicalTopic({ name: 'orders' });

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

        const result = await httpApi.renameRbacGroup('producers', { name: 'publishers' });

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
