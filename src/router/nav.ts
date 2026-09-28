export const enableAllPages = import.meta.env.VITE_ENABLE_ALL_PAGES === 'on';

/// Paths that are always enabled — no feature-flag needed. RBAC ships default-on because
/// access control is a core product concern; the parameterized editor routes are covered
/// separately in beforeEach (a :name in the path keeps them off the exact-match set).
export const defaultPaths = new Set([
    '/topics', '/topics/new', '/clients', '/clients/new', '/clients/access',
    '/rbac/roles', '/rbac/roles/new', '/rbac/groups', '/rbac/groups/new',
    '/governance'
]);
const isDefaultPath = (path?: string): boolean => !!path && defaultPaths.has(path);

export interface NavSection {
    title: string;
    /// Short qualifier under the section label — never an artifact name: modules are
    /// capabilities of one deployable, not separate services.
    note?: string;
    items: { label: string; icon: string; to?: string; soon?: boolean; level?: number }[];
}

const allNavSections: NavSection[] = [
    {
        title: 'Kafka', note: 'Resources', items: [
            { label: 'Topics', icon: 'ph-stack', to: '/topics' },
            { label: 'Clusters', icon: 'ph-git-fork', to: '/clusters' },
        ],
    },
    {
        title: 'Authorization', note: 'RBAC', items: [
            { label: 'Clients', icon: 'ph-users-three', to: '/clients' },
            { label: 'Groups', icon: 'ph-users', to: '/rbac/groups' },
            { label: 'Roles', icon: 'ph-shield-check', to: '/rbac/roles', level: 1 },
        ],
    },
    {
        title: 'Policies', note: 'Guardrails', items: [
            { label: 'Governance', icon: 'ph-scales', to: '/governance' },
        ],
    },
    {
        title: 'Developer tools', items: [
            { label: 'Publish', icon: 'ph-paper-plane-tilt', to: '/publish' },
            { label: 'Consume', icon: 'ph-play-circle', soon: true },
        ],
    },
    {
        title: 'Platform', items: [
            { label: 'Gateway config', icon: 'ph-sliders-horizontal', soon: true },
        ],
    },
];

export const navSections: NavSection[] = enableAllPages
    ? allNavSections
    : allNavSections.map((section) => ({
        ...section,
        items: section.items.map((item) =>
            isDefaultPath(item.to) || !item.to ? item : { ...item, to: undefined, soon: true }),
    }));