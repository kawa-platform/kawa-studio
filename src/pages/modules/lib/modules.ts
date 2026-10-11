import type { ModuleView } from '@/api/types';

/// What Studio knows about a gateway module: everything except whether it is enabled, which only the
/// gateway knows (`GET /admin/modules`).
export interface ModuleRef {
    name: string;
    icon: string;
    description: string;
    /// What the module adds to the Kafka request path.
    kafka: string;
    /// The Studio pages it brings.
    pages: readonly { label: string; to: string }[];
    /// Shown on the card when switching the module off has consequences beyond its own features.
    caution?: string;
}

/// The modules this Studio version describes, keyed by the gateway's stable module identifier.
export const MODULE_REFS: Readonly<Record<string, ModuleRef>> = {
    'virtual-topics': {
        name: 'Virtual topics',
        icon: 'ph-stack',
        description: 'Virtualize topics backed by a physical topic, optionally filtering records based on CEL expressions.',
        kafka: 'Rewrites topic names and filters records on produce and fetch',
        pages: [{ label: 'Topics', to: '/topics' }],
    },
    rbac: {
        name: 'Access control',
        icon: 'ph-shield-check',
        description: 'Enabled proper manageable RBAC for Kafka by introducing clients, groups and roles.',
        kafka: 'Authorizes every client request before it reaches the cluster',
        pages: [
            { label: 'Clients', to: '/clients' },
            { label: 'Groups', to: '/rbac/groups' },
            { label: 'Roles', to: '/rbac/roles' },
        ],
        caution: 'This is the only authorization layer on the Kafka path. Switching it off changes who can reach the cluster.',
    },
    governance: {
        name: 'Governance',
        icon: 'ph-scales',
        description: 'CEL rules that every Kafka resource (topics, consumer group, etc..) must satisfy before it is created or altered.',
        kafka: 'Checks Kafka Resource create and alter requests against the rules',
        pages: [{ label: 'Governance', to: '/governance' }],
    },
};

/// A module card: the gateway's identifier and enabled state, described by its [ModuleRef].
export interface ModuleCard extends ModuleRef {
    id: string;
    enabled: boolean;
}

/// One card per module the gateway reports, in its order. Only `enabled` is taken from the gateway;
/// everything else comes from the module's [ModuleRef]. Studio and the gateway share the module set.
export function toModuleCards(modules: readonly ModuleView[]): ModuleCard[] {
    return modules.flatMap((module) => {
        const ref = MODULE_REFS[module.id];
        return ref ? [{ ...ref, id: module.id, enabled: module.enabled }] : [];
    });
}
