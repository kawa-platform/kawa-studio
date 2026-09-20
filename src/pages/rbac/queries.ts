import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { useApi } from '@/api';
import { ApiError, type GroupConfig, type GroupConfigPatch, type GroupView, type RoleConfig, type RoleView } from '@/api/types';
import { keys } from '@/queries/keys';

export function useRbacRoles() {
    const api = useApi();
    return useQuery<RoleView[]>({
        queryKey: keys.rbacRoles(),
        queryFn: () => api.listRbacRoles(),
    });
}

export function useRbacGroups() {
    const api = useApi();
    return useQuery<GroupView[]>({
        queryKey: keys.rbacGroups(),
        queryFn: () => api.listRbacGroups(),
    });
}

export function useRbacAuthClients() {
    const api = useApi();
    return useQuery({
        queryKey: keys.rbacAuthClients(),
        queryFn: () => api.listAuthClients(),
    });
}

/// Only RBAC lists get invalidated: a role/group write never touches the topic tables.
function invalidateRbac(client: ReturnType<typeof useQueryClient>): Promise<unknown> {
    return Promise.all([
        client.invalidateQueries({ queryKey: keys.rbacRoles() }),
        client.invalidateQueries({ queryKey: keys.rbacGroups() }),
    ]);
}

export function useUpsertRbacRole() {
    const api = useApi();
    const client = useQueryClient();
    return useMutation<RoleView, ApiError, {name: string; body: RoleConfig}>({
        mutationFn: ({name, body}) => api.upsertRbacRole(name, body),
        onSuccess: () => invalidateRbac(client),
    });
}

export function useDeleteRbacRole() {
    const api = useApi();
    const client = useQueryClient();
    return useMutation<void, ApiError, string>({
        mutationFn: (name) => api.deleteRbacRole(name),
        onSuccess: () => invalidateRbac(client),
    });
}

export function useUpsertRbacGroup() {
    const api = useApi();
    const client = useQueryClient();
    return useMutation<GroupView, ApiError, {name: string; body: GroupConfig}>({
        mutationFn: ({name, body}) => api.upsertRbacGroup(name, body),
        onSuccess: () => invalidateRbac(client),
    });
}

export function useRenameRbacGroup() {
    const api = useApi();
    const client = useQueryClient();
    return useMutation<GroupView, ApiError, {name: string; body: GroupConfigPatch}>({
        mutationFn: ({name, body}) => api.renameRbacGroup(name, body),
        onSuccess: () => invalidateRbac(client),
    });
}

export function useDeleteRbacGroup() {
    const api = useApi();
    const client = useQueryClient();
    return useMutation<void, ApiError, string>({
        mutationFn: (name) => api.deleteRbacGroup(name),
        onSuccess: () => invalidateRbac(client),
    });
}