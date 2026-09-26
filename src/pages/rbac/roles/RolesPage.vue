<script setup lang="ts">
import { computed, ref } from 'vue';
import AppToast from '@/components/AppToast.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import type { RoleView } from '@/api/types';
import RbacBanner from '../components/RbacBanner.vue';
import { describeAcl, groupsReferencingRole } from '../lib/rbac';
import { useDeleteRbacRole, useRbacGroups, useRbacRoles } from '../queries';

const roles = useRbacRoles();
const groups = useRbacGroups();
const deleteRole = useDeleteRbacRole();

const target = ref<RoleView | null>(null);
const confirmOpen = ref(false);
const toast = ref<{ok: boolean; text: string} | null>(null);
const toastOpen = computed({
    get: () => toast.value !== null,
    set: (value: boolean) => { if (!value) toast.value = null; },
});

const bindingCount = (roleName: string): number => groupsReferencingRole(groups.data.value ?? [], roleName).length;

const openDelete = (role: RoleView): void => {
    target.value = role;
    confirmOpen.value = true;
};

const confirmDelete = async (): Promise<void> => {
    if (!target.value) return;
    try {
        await deleteRole.mutateAsync(target.value.name);
        toast.value = {ok: true, text: `Role "${target.value.name}" deleted — applying to the gateway.`};
        confirmOpen.value = false;
    } catch (cause) {
        toast.value = {
            ok: false,
            text: cause instanceof Error ? cause.message : `Could not delete "${target.value.name}".`,
        };
        confirmOpen.value = false;
    }
};

const affectedGroups = computed(() => (target.value ? groupsReferencingRole(groups.data.value ?? [], target.value.name) : []));
const dialogBody = computed(() =>
    affectedGroups.value.length
        ? `Deleting it unbinds ${affectedGroups.value.length} group${affectedGroups.value.length === 1 ? '' : 's'} that grant it: ${affectedGroups.value.join(', ')}. Members of those groups lose this role's access immediately.`
        : 'No group grants this role, so nothing loses access. The ACLs simply stop existing.',
);
</script>

<template>
    <div>
        <div class="head">
            <div>
                <h1>Roles</h1>
                <p class="lede">
                    A role is a named set of ACLs. Groups bind clients to roles; a client's effective access is the union
                    across every group they belong to.
                </p>
            </div>
            <RouterLink class="btn btn-primary" to="/rbac/roles/new">
                <i class="ph-duotone ph-plus" />New role
            </RouterLink>
        </div>

        <RbacBanner>
            Access is <strong>denied by default</strong> until an ACL grants it, and a <strong>DENY always wins</strong>
            over any matching ALLOW. Saving writes a config snapshot the gateway applies asynchronously.
        </RbacBanner>

        <p v-if="roles.error.value" class="form-error">{{ roles.error.value.message }}</p>

        <div v-else-if="roles.data.value && roles.data.value.length === 0" class="empty">
            No roles configured — every request currently hits the default-deny wall.
            <RouterLink to="/rbac/roles/new">Create the first role</RouterLink>.
        </div>

        <div v-else class="table-scroll">
            <table class="table" style="min-width: 780px">
                <thead>
                    <tr>
                        <th>Role</th>
                        <th>ACLs</th>
                        <th>Groups granting it</th>
                        <th />
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="role in roles.data.value" :key="role.name">
                        <td class="mono cell strong">
                            <RouterLink class="role-link" :to="`/rbac/roles/${encodeURIComponent(role.name)}`">{{ role.name }}</RouterLink>
                        </td>
                        <td>
                            <template v-if="role.acls.length">
                                <span class="tag tag-neutral count">{{ role.acls.length }}</span>
                                <span class="muted list-meta" :title="role.acls.map(describeAcl).join('\n')">
                                    {{ role.acls.map(describeAcl).slice(0, 2).join('; ') }}
                                    <template v-if="role.acls.length > 2">; …</template>
                                </span>
                            </template>
                            <span v-else class="faint">no ACLs — denies everything</span>
                        </td>
                        <td>
                            <template v-if="bindingCount(role.name)">
                                <span class="tag tag-neutral bound">{{ bindingCount(role.name) }} bound</span>
                            </template>
                            <span v-else class="faint">unbound</span>
                        </td>
                        <td class="actions">
                            <RouterLink class="btn btn-ghost" :to="`/rbac/roles/${encodeURIComponent(role.name)}/edit`">Edit</RouterLink>
                            <button class="btn btn-ghost btn-danger" @click="openDelete(role)">Delete</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <ConfirmDialog
            v-model:open="confirmOpen"
            title="Delete role?"
            :body="dialogBody"
            confirm-label="Delete role"
            danger
            :pending="deleteRole.isPending.value"
            @confirm="confirmDelete"
        />

        <AppToast v-model:open="toastOpen" :ok="toast?.ok ?? true" :text="toast?.text ?? ''" />
    </div>
</template>

<style scoped>
.head { display: flex; align-items: flex-end; gap: 24px; margin-bottom: 20px; }
.head > div { margin-right: auto; }
.strong { font-weight: 500; }
.role-link { color: inherit; text-decoration: none; }
.role-link:hover { text-decoration: underline; }
.count { margin-right: 6px; }
.list-meta { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 320px; display: inline-block; vertical-align: bottom; }
.bound { font-size: 10.5px; }
.actions { text-align: right; }
.actions > * + * { margin-left: 6px; }
.actions .btn { font-size: 12.5px; }
.empty { padding: 26px; text-align: center; font-size: 13px; color: var(--muted); border: 1px dashed var(--chrome-line); border-radius: var(--radius-md); }
.form-error { font-size: 13px; color: var(--color-accent-2-700); }
</style>
