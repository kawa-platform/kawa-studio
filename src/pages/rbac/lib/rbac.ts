import type { GroupView, RbacAclConfig, RbacResourceConfig, RoleView } from '@/api/types';

/// The four resource kinds the UI lets users configure. CLUSTER carries no pattern; the
/// other three do. Unknown kinds only ever arrive from a malformed server response.
export const OFFERED_TYPES = ['TOPIC', 'GROUP', 'CLUSTER', 'TRANSACTIONAL_ID'] as const;

/// Operations except UNKNOWN/ANY — the concrete actions an ACL grants or denies.
export const OFFERED_OPERATIONS = [
    'ALL',
    'READ',
    'WRITE',
    'CREATE',
    'DELETE',
    'ALTER',
    'DESCRIBE',
    'CLUSTER_ACTION',
    'DESCRIBE_CONFIGS',
    'ALTER_CONFIGS',
    'IDEMPOTENT_WRITE',
] as const;

/// Mirror of the server-side config validation (ResourceConfig.java): type and operation
/// are required, a blank pattern with LITERAL (the default) is rejected, and a PREFIXED
/// empty pattern is the sanctioned match-any. DENY/ALLOW both validate the same way.
/// Accepts a partial: the editor drafts rows while fields are still empty.
export function validateAcl(acl: Partial<RbacAclConfig>): string[] {
    const errors: string[] = [];
    const kind = acl?.resource?.type;
    if (!kind || !(OFFERED_TYPES as readonly string[]).includes(kind)) {
        errors.push('Choose a resource type');
    }
    if (!acl?.operation) {
        errors.push('Choose an operation');
    }
    const pattern = acl?.resource?.pattern ?? '';
    const patternType = acl?.resource?.patternType ?? 'LITERAL';
    if (kind && kind !== 'CLUSTER' && patternType === 'LITERAL' && !pattern.trim()) {
        errors.push('A literal resource needs a name pattern');
    }
    return errors;
}

function kindLabel(kind: string): string {
    switch (kind) {
        case 'TRANSACTIONAL_ID': return 'transactional-id';
        default: return kind.toLowerCase();
    }
}

/// Human-read rendering of a single ACL: `ALLOW READ topic "orders"`.
export function describeAcl(acl: RbacAclConfig): string {
    const permission = acl.permission ?? 'ALLOW';
    return `${permission} ${acl.operation} ${describeResource(acl.resource)}`;
}

export function describeResource(resource: RbacResourceConfig): string {
    const kind = resource?.type ?? 'UNKNOWN';
    if (kind === 'CLUSTER') return 'cluster';
    const pattern = resource.pattern ?? '';
    const prefixed = (resource.patternType ?? 'LITERAL') === 'PREFIXED';
    if (prefixed && !pattern) return `any ${kindLabel(kind)}`;
    return `${kindLabel(kind)} "${pattern}"${prefixed ? '*' : ''}`;
}

export interface ResolvedAcl {
    acl: RbacAclConfig;
    role: string;
    /** Groups that bind this role for the user, in the order they were walked. */
    groups: string[];
}

/// The effective ACL surface for one user: every role attached to every group holding the
/// user as a client, deduplicated per role across groups, in group-then-role order. Roles
/// that no longer exist are skipped — their absence is reported as a warning elsewhere.
export function effectiveAclsOfUser(
    roles: RoleView[],
    groups: GroupView[],
    username: string,
): ResolvedAcl[] {
    const byName = new Map(roles.map((role) => [role.name, role]));
    const bindings: {role: RoleView; groups: string[]}[] = [];
    for (const group of groups) {
        if (!group.clients.includes(username)) continue;
        for (const roleName of group.roles) {
            const role = byName.get(roleName);
            if (!role) continue;
            const existing = bindings.find((b) => b.role.name === roleName);
            if (existing) existing.groups.push(group.name);
            else bindings.push({role, groups: [group.name]});
        }
    }
    return bindings.flatMap((b) =>
        b.role.acls.map((acl) => ({acl, role: b.role.name, groups: [...b.groups]})),
    );
}

export function groupsOfUser(groups: GroupView[], username: string): GroupView[] {
    return groups.filter((group) => group.clients.includes(username));
}

export function groupsReferencingRole(groups: GroupView[], roleName: string): string[] {
    return groups.filter((group) => group.roles.includes(roleName)).map((group) => group.name);
}

/// Roles never bound by any group grant nothing; the permissions screen flags them.
export function orphanRoles(roles: RoleView[], groups: GroupView[]): RoleView[] {
    const referenced = new Set(groups.flatMap((group) => group.roles));
    return roles.filter((role) => !referenced.has(role.name));
}

export function missingRoleRefs(
    groups: GroupView[],
    roles: RoleView[],
): {name: string; missing: string[]}[] {
    const known = new Set(roles.map((role) => role.name));
    return groups
        .map((group) => ({name: group.name, missing: group.roles.filter((r) => !known.has(r))}))
        .filter((group) => group.missing.length > 0);
}

/// The common "make everything work" starter set (mirrors the sample role in
/// docker/gateway.yaml): any topic, any group, and the whole cluster, all operations.
export function broadAccessAcls(): RbacAclConfig[] {
    return [
        {resource: {type: 'TOPIC', pattern: '', patternType: 'PREFIXED'}, operation: 'ALL', permission: 'ALLOW'},
        {resource: {type: 'GROUP', pattern: '', patternType: 'PREFIXED'}, operation: 'ALL', permission: 'ALLOW'},
        {resource: {type: 'CLUSTER'}, operation: 'ALL', permission: 'ALLOW'},
    ];
}