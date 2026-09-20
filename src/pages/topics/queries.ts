import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { useApi } from '@/api';
import { ApiError, type Acl, type CreatePhysicalTopicRequest, type CreatePhysicalTopicResult, type Topic, type VirtualTopicConfig, type VirtualTopicPatch } from '@/api/types';
import { keys } from '@/queries/keys';

export function useTopics() {
    const api = useApi();
    return useQuery<Topic[]>({
        queryKey: keys.topics(),
        queryFn: () => api.listTopics(),
    });
}

export function useAcls() {
    const api = useApi();
    return useQuery<Acl[]>({
        queryKey: keys.acls(),
        queryFn: () => api.listAcls(),
    });
}

export function usePhysicalTopics() {
    const api = useApi();
    return useQuery<Topic[]>({
        queryKey: keys.topics(),
        queryFn: () => api.listTopics(),
        select: (topics) => topics.filter((t) => t.type === 'physical'),
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

export function useUpsertVirtualTopic() {
    const api = useApi();
    const client = useQueryClient();
    return useMutation<VirtualTopicConfig, ApiError, { name: string; config: VirtualTopicConfig }>({
        mutationFn: ({ name, config }) => api.upsertVirtualTopic(name, config),
        onSuccess: () => { void invalidate(client); },
    });
}

export function usePatchVirtualTopic() {
    const api = useApi();
    const client = useQueryClient();
    return useMutation<VirtualTopicConfig, ApiError, { currentName: string; request: VirtualTopicPatch }>({
        mutationFn: ({ currentName, request }) => api.patchVirtualTopic(currentName, request),
        onSuccess: () => { void invalidate(client); },
    });
}

export function useDeleteVirtualTopic() {
    const api = useApi();
    const client = useQueryClient();
    return useMutation<void, ApiError, string>({
        mutationFn: (name) => api.deleteVirtualTopic(name),
        onSuccess: () => invalidate(client),
    });
}

export function useCreatePhysicalTopic() {
    const api = useApi();
    const client = useQueryClient();
    return useMutation<CreatePhysicalTopicResult, ApiError, CreatePhysicalTopicRequest>({
        mutationFn: (request) => api.createPhysicalTopic(request),
        onSuccess: () => { void client.invalidateQueries({ queryKey: keys.topics() }); },
    });
}
