import { describe, expect, it } from 'vitest';
import type { GroupView, RbacAclConfig, RbacResourceConfig, RoleView } from '@/api/types';
import {
    broadAccessAcls,
    describeAcl,
    effectiveAclsOfUser,
    groupsOfUser,
    groupsReferencingRole,
    missingRoleRefs,
    orphanRoles,
    validateAcl,
} from './rbac';

const acl = (
    resource: RbacResourceConfig,
    operation: string,
    permission?: RbacAclConfig['permission'],
): RbacAclConfig => ({resource, operation: operation as RbacAclConfig['operation'], permission});

const topic = (pattern: string, patternType: 'LITERAL' | 'PREFIXED' = 'LITERAL'): RbacResourceConfig =>
    ({type: 'TOPIC', pattern, patternType});
const cluster = (): RbacResourceConfig => ({type: 'CLUSTER'});

const role = (name: string, ...acls: RbacAclConfig[]): RoleView => ({name, acls});

const group = (name: string, clients: string[], roles: string[]): GroupView => ({name, clients, roles});

describe('validateAcl', () => {
    it('accepts a complete literal topic acl', () => {
        expect(validateAcl(acl(topic('orders'), 'READ'))).toEqual([]);
    });

    it('rejects a missing operation', () => {
        expect(validateAcl({resource: topic('orders')}).join(' ')).toContain('operation');
    });

    it('rejects an unknown resource type', () => {
        expect(validateAcl(acl({type: 'UNKNOWN'}, 'READ')).join(' ')).toContain('type');
    });

    it('rejects a blank pattern on a literal topic or group', () => {
        expect(validateAcl(acl(topic(''), 'READ')).join(' ')).toContain('pattern');
        expect(validateAcl(acl({type: 'GROUP', pattern: '  '}, 'READ')).join(' ')).toContain('pattern');
    });

    /// Mirrors the config record: PREFIXED + empty pattern is an intentional match-any.
    it('accepts an empty prefixed pattern as match-any', () => {
        expect(validateAcl(acl(topic('', 'PREFIXED'), 'ALL'))).toEqual([]);
    });

    it('accepts a cluster acl without a pattern', () => {
        expect(validateAcl(acl(cluster(), 'ALL'))).toEqual([]);
    });

    it('accepts an omitted permission (defaults to ALLOW)', () => {
        expect(validateAcl(acl(topic('orders'), 'READ'))).toEqual([]);
    });
});

describe('describeAcl', () => {
    it('renders literal, prefixed-empty, prefixed, and cluster acls', () => {
        expect(describeAcl(acl(topic('orders'), 'READ'))).toBe('ALLOW READ topic "orders"');
        expect(describeAcl(acl(topic('', 'PREFIXED'), 'ALL', 'DENY'))).toBe('DENY ALL any topic');
        expect(describeAcl(acl(topic('orders', 'PREFIXED'), 'ALL'))).toBe('ALLOW ALL topic "orders"*');
        expect(describeAcl(acl(cluster(), 'CLUSTER_ACTION'))).toBe('ALLOW CLUSTER_ACTION cluster');
    });
});

describe('effectiveAclsOfUser', () => {
    const r1 = role('reader', acl(topic('orders'), 'READ'));
    const r2 = role('writer', acl(topic('orders'), 'WRITE'));

    const groups = [
        group('payments-group', ['alice'], ['reader']),
        group('ops-group', ['alice', 'bob'], ['writer', 'reader']),
    ];

    it('returns no acls for a user outside every group', () => {
        expect(effectiveAclsOfUser([r1, r2], groups, 'carol')).toEqual([]);
    });

    it('resolves a single group binding', () => {
        const resolved = effectiveAclsOfUser([r1, r2], groups, 'bob');
        expect(resolved).toHaveLength(2);
        expect(resolved[0]).toMatchObject({role: 'writer', groups: ['ops-group']});
    });

    it('merges bindings of the same role across groups', () => {
        const resolved = effectiveAclsOfUser([r1, r2], groups, 'alice');
        const reader = resolved.flatMap((r) => (r.role === 'reader' ? r.groups : []));
        expect(reader).toHaveLength(2);
        expect([...reader].sort()).toEqual(['ops-group', 'payments-group']);
    });

    it('skips roles that no longer exist without guessing', () => {
        const resolved = effectiveAclsOfUser([r2], groups, 'alice');
        expect(resolved.map((r) => r.role)).not.toContain('reader');
    });
});

describe('graph queries', () => {
    const roles = [role('reader'), role('writer'), role('orphan')];
    const groups = [
        group('g1', ['alice'], ['reader']),
        group('g2', ['alice', 'bob'], ['writer', 'reader', 'ghost']),
    ];

    it('lists the groups a user belongs to', () => {
        expect(groupsOfUser(groups, 'alice').map((g) => g.name).sort()).toEqual(['g1', 'g2']);
        expect(groupsOfUser(groups, 'nobody')).toEqual([]);
    });

    it('finds groups referencing a role', () => {
        expect(groupsReferencingRole(groups, 'reader').sort()).toEqual(['g1', 'g2']);
        expect(groupsReferencingRole(groups, 'orphan')).toEqual([]);
    });

    it('flags roles no group binds', () => {
        expect(orphanRoles(roles, groups).map((r) => r.name)).toEqual(['orphan']);
    });

    it('surfaces role references that resolve to nothing', () => {
        expect(missingRoleRefs(groups, roles)).toEqual([{name: 'g2', missing: ['ghost']}]);
    });
});

describe('broadAccessAcls', () => {
    it('is the allow-all starter set: any topic, any group, whole cluster', () => {
        expect(broadAccessAcls().map(describeAcl)).toEqual([
            'ALLOW ALL any topic',
            'ALLOW ALL any group',
            'ALLOW ALL cluster',
        ]);
    });
});