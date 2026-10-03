/// One place for the cache keys, so an invalidation after a write cannot miss a screen.
export const keys = {
    topics: () => ['topics'] as const,
    topic: (name: string, type: string) => ['topics', name, type] as const,
    clusters: () => ['clusters'] as const,
    clients: () => ['clients'] as const,
    acls: (principal?: string, resource?: string) => ['acls', principal ?? '', resource ?? ''] as const,
    schemas: (topic: string) => ['schemas', topic] as const,
    rbacRoles: () => ['rbac', 'roles'] as const,
    rbacGroups: () => ['rbac', 'groups'] as const,
    rbacAuthClients: () => ['rbac', 'auth-clients'] as const,
    governance: () => ['governance'] as const,
};
