import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { useApi } from '@/api/api';
import { ApiError } from '@/api/error';
import type { Clusters } from '@/api/types';
import { keys } from '@/queries/keys';

export function useClusters() {
    const api = useApi();
    return useQuery<Clusters>({
        queryKey: keys.clusters(),
        queryFn: () => api.getClusters(),
    });
}

/// Both writes invalidate the same two keys: the alias list and the topic list, because a
/// virtual topic appears on the Topics screen too.
function invalidate(client: ReturnType<typeof useQueryClient>): Promise<unknown> {
    return Promise.all([
        client.invalidateQueries({ queryKey: keys.clusters() }),
        client.invalidateQueries({ queryKey: keys.topics() }),
    ]);
}

export function useDeleteVirtualTopic() {
    const api = useApi();
    const client = useQueryClient();
    return useMutation<void, ApiError, string>({
        mutationFn: (name) => api.deleteVirtualTopic(name),
        onSuccess: () => invalidate(client),
    });
}
