import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { useApi } from '@/api/api';
import { ApiError } from '@/api/error';
import type { AdminUser, CreateAdminUserRequest, UpdateAdminUserRequest } from '@/api/types';
import { keys } from '@/queries/keys';

export function useAdminUsers() {
    const api = useApi();
    return useQuery<AdminUser[]>({
        queryKey: keys.adminUsers(),
        queryFn: () => api.listAdminUsers(),
    });
}

export function useCreateAdminUser() {
    const api = useApi();
    const client = useQueryClient();
    return useMutation<AdminUser, ApiError, CreateAdminUserRequest>({
        mutationFn: (body) => api.createAdminUser(body),
        onSuccess: () => client.invalidateQueries({ queryKey: keys.adminUsers() }),
    });
}

export function useUpdateAdminUser() {
    const api = useApi();
    const client = useQueryClient();
    return useMutation<AdminUser, ApiError, { id: string; body: UpdateAdminUserRequest }>({
        mutationFn: ({ id, body }) => api.updateAdminUser(id, body),
        onSuccess: () => client.invalidateQueries({ queryKey: keys.adminUsers() }),
    });
}

export function useDeleteAdminUser() {
    const api = useApi();
    const client = useQueryClient();
    return useMutation<void, ApiError, string>({
        mutationFn: (id) => api.deleteAdminUser(id),
        onSuccess: () => client.invalidateQueries({ queryKey: keys.adminUsers() }),
    });
}
