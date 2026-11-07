import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { useApi } from '@/api/api';
import { ApiError } from '@/api/error';
import type { OAuthClientConfigView, OAuthClientRequest } from '@/api/types';
import { keys } from '@/queries/keys';

export function useOAuthClients() {
    const api = useApi();
    return useQuery<OAuthClientConfigView[], ApiError>({
        queryKey: keys.oauthClients(),
        queryFn: () => api.listOAuthClients(),
        // A 404 means the gateway does not serve OAuth clients; retrying will not change that.
        retry: false,
    });
}

export function useUpsertOAuthClient() {
    const api = useApi();
    const client = useQueryClient();
    return useMutation<OAuthClientConfigView, ApiError, { id: string; body: OAuthClientRequest }>({
        mutationFn: ({ id, body }) => api.upsertOAuthClient(id, body),
        onSuccess: () => client.invalidateQueries({ queryKey: keys.oauthClients() }),
    });
}

export function useDeleteOAuthClient() {
    const api = useApi();
    const client = useQueryClient();
    return useMutation<void, ApiError, string>({
        mutationFn: (id) => api.deleteOAuthClient(id),
        onSuccess: () => client.invalidateQueries({ queryKey: keys.oauthClients() }),
    });
}
