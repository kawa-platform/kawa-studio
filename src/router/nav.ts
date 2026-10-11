export interface NavSection {
    title: string;
    note?: string;
    items: { label: string; icon: string; to?: string; soon?: boolean; level?: number; module?: string }[];
}

export const navSections: NavSection[] = [
    {
        title: 'Kafka', note: 'Resources', items: [
            { label: 'Topics', icon: 'ph-stack', to: '/topics', module: 'virtual-topics' },
            { label: 'Clusters', icon: 'ph-git-fork', to: '/clusters', soon: true },
        ],
    },
    {
        title: 'Authorization', note: 'RBAC', items: [
            { label: 'Clients', icon: 'ph-users-three', to: '/clients', module: 'rbac' },
            { label: 'Groups', icon: 'ph-users', to: '/rbac/groups', module: 'rbac' },
            { label: 'Roles', icon: 'ph-shield-check', to: '/rbac/roles', level: 1, module: 'rbac' },
        ],
    },
    {
        title: 'Policies', note: 'Guardrails', items: [
            { label: 'Governance', icon: 'ph-scales', to: '/governance', module: 'governance' },
        ],
    },
    {
        title: 'Developer tools', items: [
            { label: 'Publish', icon: 'ph-paper-plane-tilt', to: '/publish', soon: true },
            { label: 'Consume', icon: 'ph-play-circle', soon: true },
        ],
    },
    {
        title: 'Gateway', note: 'Settings', items: [
            { label: 'Modules', icon: 'ph-sliders-horizontal', to: '/modules'},
        ],
    },
    {
        title: 'Studio', note: 'Settings', items: [
            { label: 'Studio users', icon: 'ph-user-gear', to: '/admin/users' },
        ],
    },
];