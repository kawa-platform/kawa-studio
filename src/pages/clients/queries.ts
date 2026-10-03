import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { useApi } from '@/api/api';
import { ApiError } from '@/api/error';
import type { Client, ClientConfigPatch, CreateClientRequest } from '@/api/types';
import { keys } from '@/queries/keys';

export function useClients() {
    const api = useApi();
    return useQuery<Client[]>({
        queryKey: keys.clients(),
        queryFn: () => api.listClients(),
    });
}

/// A client write mutates both the client list and group membership on the admin
/// server: the Clients screen renders the Groups column from the RBAC group view, so
/// missing that cache leaves a freshly created/edited client showing no groups.
function invalidateClientWrite(client: ReturnType<typeof useQueryClient>): Promise<unknown> {
    return Promise.all([
        client.invalidateQueries({ queryKey: keys.clients() }),
        client.invalidateQueries({ queryKey: keys.rbacGroups() }),
        client.invalidateQueries({ queryKey: keys.rbacAuthClients() }),
    ]);
}

export function useCreateClient() {
    const api = useApi();
    const client = useQueryClient();
    return useMutation<Client, ApiError, { username: string; req: CreateClientRequest }>({
        mutationFn: ({ username, req }) => api.upsertClient(username, req),
        onSuccess: () => invalidateClientWrite(client),
    });
}

export function usePatchClient() {
    const api = useApi();
    const client = useQueryClient();
    return useMutation<Client, ApiError, { username: string; body: ClientConfigPatch }>({
        mutationFn: ({ username, body }) => api.patchClient(username, body),
        onSuccess: () => invalidateClientWrite(client),
    });
}
