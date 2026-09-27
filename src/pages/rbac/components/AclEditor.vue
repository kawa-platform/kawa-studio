<script setup lang="ts">
import type { AclOperation, Permission, RbacAclConfig, ResourceKind } from '@/api/types';
import { OFFERED_OPERATIONS, OFFERED_TYPES, describeAcl, validateAcl } from '../lib/rbac';

const acls = defineModel<RbacAclConfig[]>({ required: true });

const kinds = [...OFFERED_TYPES] as ResourceKind[];
const operations = [...OFFERED_OPERATIONS] as AclOperation[];
const patternModes = ['LITERAL', 'PREFIXED'] as const;
const permissions = ['ALLOW', 'DENY'] as Permission[];

const errorsFor = (acl: RbacAclConfig): string[] => validateAcl(acl);
const summaryFor = (acl: RbacAclConfig): string => describeAcl(acl);

const kindLabel = (kind: ResourceKind): string => {
    switch (kind) {
        case 'TRANSACTIONAL_ID': return 'Transactional ID';
        default: return kind[0] + kind.slice(1).toLowerCase();
    }
};

const operationLabel = (operation: AclOperation): string =>
    operation.toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

/// Rows are replaced whole (never mutated), so the v-for keys stay stable and every
/// field change re-renders just its own row. index is faintly nullable (Vue template
/// indexing) — every mutator bails out when the row is gone.
const setKind = (index: number, kind: ResourceKind): void => {
    const prev = acls.value[index];
    if (!prev) return;
    if (kind === 'CLUSTER') {
        acls.value[index] = {...prev, resource: {type: 'CLUSTER'}};
        return;
    }
    acls.value[index] = {
        ...prev,
        resource: {
            type: kind,
            pattern: prev.resource.pattern ?? '',
            patternType: prev.resource.patternType ?? 'LITERAL',
        },
    };
};

const setField = <K extends keyof RbacAclConfig>(
    index: number,
    key: K,
    value: NonNullable<RbacAclConfig[K]>,
): void => {
    const prev = acls.value[index];
    if (!prev) return;
    acls.value[index] = {...prev, [key]: value};
};

const setPattern = (index: number, pattern: string): void => {
    const prev = acls.value[index];
    if (!prev) return;
    acls.value[index] = {
        ...prev,
        resource: {
            ...prev.resource,
            pattern,
            patternType: prev.resource.patternType ?? 'LITERAL',
        },
    };
};

const setPatternType = (index: number, patternType: 'LITERAL' | 'PREFIXED'): void => {
    const prev = acls.value[index];
    if (!prev) return;
    acls.value[index] = {...prev, resource: {...prev.resource, pattern: prev.resource.pattern ?? '', patternType}};
};

const removeRow = (index: number): void => {
    acls.value.splice(index, 1);
};

const addRow = (): void => {
    acls.value.push({
        resource: {type: 'TOPIC', pattern: '', patternType: 'LITERAL'},
        operation: 'ALL',
        permission: 'ALLOW',
    });
};

const addCopyRow = (): void => {
    const last = acls.value[acls.value.length - 1];
    if (!last) return;
    acls.value.push({...last, resource: {...last.resource}});
};
</script>

<template>
    <div class="acl-editor">
        <div v-if="acls.length === 0" class="empty">
            No ACLs yet — every client a role grants still hits the default-deny wall. Add the
            first one below.
        </div>

        <template v-for="(acl, index) in acls" :key="index">
            <div class="acl">
                <div class="row">
                    <select class="input kind" :value="acl.resource.type" @change="setKind(index, ($event.target as HTMLSelectElement).value as ResourceKind)">
                        <option v-for="kind in kinds" :key="kind" :value="kind">{{ kindLabel(kind) }}</option>
                    </select>

                    <template v-if="acl.resource.type !== 'CLUSTER'">
                        <input
                            class="input mono pattern"
                            :value="acl.resource.pattern ?? ''"
                            placeholder="Name or prefix…"
                            @input="setPattern(index, ($event.target as HTMLInputElement).value)"
                        >
                        <div class="seg pattern-type">
                            <button
                                v-for="mode in patternModes"
                                :key="mode"
                                type="button"
                                class="seg-opt"
                                :data-state="(acl.resource.patternType ?? 'LITERAL') === mode ? 'active' : 'inactive'"
                                @click="setPatternType(index, mode)"
                            >
                                {{ mode === 'LITERAL' ? 'Exact' : 'Prefix' }}
                            </button>
                        </div>
                    </template>
                    <span v-else class="note">Cluster-wide — no pattern</span>

                    <button type="button" class="btn btn-ghost btn-icon remove" :aria-label="`Remove ACL ${index + 1}`" @click="removeRow(index)">
                        <i class="ph-duotone ph-trash" />
                    </button>
                </div>

                <div class="row verdict">
                    <select
                        class="input operation"
                        :value="acl.operation"
                        @change="setField(index, 'operation', ($event.target as HTMLSelectElement).value as AclOperation)"
                    >
                        <option v-for="operation in operations" :key="operation" :value="operation">{{ operationLabel(operation) }}</option>
                    </select>

                    <div class="seg perm">
                        <button
                            v-for="permission in permissions"
                            :key="permission"
                            type="button"
                            class="seg-opt"
                            :data-state="(acl.permission ?? 'ALLOW') === permission ? 'active' : 'inactive'"
                            @click="setField(index, 'permission', permission)"
                        >
                            {{ permission }}
                        </button>
                    </div>
                </div>

                <div class="row-meta">
                    <span v-if="errorsFor(acl).length" class="errors">
                        {{ errorsFor(acl).join(' · ') }}
                    </span>
                    <span v-else class="summary mono">{{ summaryFor(acl) }}</span>
                </div>
            </div>
        </template>

        <div class="row-actions">
            <button type="button" class="btn btn-secondary add" @click="addRow">
                <i class="ph-duotone ph-plus" />Add ACL
            </button>
            <button
                type="button"
                class="btn btn-secondary copy"
                aria-label="Copy above ACL"
                :disabled="acls.length === 0"
                @click="addCopyRow"
            >
                <i class="ph-duotone ph-copy" />Copy above
            </button>
        </div>
    </div>
</template>

<style scoped>
/* An ACL reads as one statement — resource, then verdict — but at the form's 640px measure
   that needs two lines. The first names the resource, the second settles allow/deny. */
.acl-editor { display: flex; flex-direction: column; gap: 14px; }

.empty {
    font-size: 13px;
    color: var(--muted);
    padding: 14px;
    border: 1px dashed var(--chrome-line);
    border-radius: var(--radius-md);
}

.acl { display: flex; flex-direction: column; gap: 7px; }

.row {
    display: grid;
    grid-template-columns: 148px minmax(0, 1fr) auto 36px;
    gap: 8px;
    align-items: center;
}
.verdict { grid-template-columns: minmax(0, 1fr) auto; }

.note { grid-column: 2 / 4; font-size: 12px; color: var(--faint); }
.pattern { min-width: 0; }
.kind, .operation { min-height: 32px; }
.remove { color: var(--faint); }
.remove:hover { color: var(--color-accent-2-700); }

.pattern-type .seg-opt, .perm .seg-opt { padding: 6px 8px; }

.row-meta { font-size: 11.5px; }
.summary { color: var(--muted); }
.errors { color: var(--color-accent-2-700); }

.row-actions { display: flex; gap: 8px; }
.add, .copy { font-size: 12.5px; }
</style>