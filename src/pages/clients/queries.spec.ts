import { describe, expect, it, vi } from 'vitest';

const { useMutationMock, useQueryClientMock } = vi.hoisted(() => ({
    useMutationMock: vi.fn(),
    useQueryClientMock: vi.fn(),
}));

vi.mock('@tanstack/vue-query', () => ({
    useMutation: useMutationMock,
    useQuery: vi.fn(),
    useQueryClient: useQueryClientMock,
}));

vi.mock('@/api', () => ({
    useApi: () => ({
        upsertClient: vi.fn(),
    }),
}));

import { keys } from '@/queries/keys';
import { useCreateClient, usePatchClient } from './queries';

describe('client write mutations', () => {
    it.each([
        ['create', useCreateClient],
        ['patch', usePatchClient],
    ])('%s invalidates client, group and auth-client queries after a successful write', async (_name, build) => {
        const invalidateQueries = vi.fn().mockResolvedValue(undefined);
        useQueryClientMock.mockReturnValue({ invalidateQueries });
        useMutationMock.mockImplementation((options) => options);

        const mutation = (build() as { onSuccess?: () => Promise<unknown> | void });
        await mutation.onSuccess?.();

        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: keys.clients() });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: keys.rbacGroups() });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: keys.rbacAuthClients() });
    });
});
