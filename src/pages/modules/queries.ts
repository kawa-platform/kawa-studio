import { computed } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { useApi } from '@/api/api';
import { ApiError } from '@/api/error';
import type { ModuleView, UpdateModuleRequest } from '@/api/types';
import { keys } from '@/queries/keys';

export function useModules() {
    const api = useApi();
    return useQuery<ModuleView[]>({
        queryKey: keys.modules(),
        queryFn: () => api.listModules(),
    });
}

/// The ids of the modules the gateway reports as disabled. Empty while the list loads or when it
/// cannot be read, so no page is marked disabled by mistake.
export function useDisabledModules() {
    const { data } = useModules();
    return computed(() => new Set((data.value ?? []).filter((module) => !module.enabled).map((module) => module.id)));
}

/// Switches a module on or off. The gateway answers with the stored module, which replaces it in the
/// cached list straight away; the list is then refetched so it stays authoritative.
export function useUpdateModule() {
    const api = useApi();
    const client = useQueryClient();
    return useMutation<ModuleView, ApiError, { id: string; body: UpdateModuleRequest }>({
        mutationFn: ({ id, body }) => api.updateModule(id, body),
        onSuccess: (stored) => {
            client.setQueryData<ModuleView[]>(keys.modules(), (modules) =>
                modules?.map((module) => (module.id === stored.id ? stored : module)));
            return client.invalidateQueries({ queryKey: keys.modules() });
        },
    });
}
