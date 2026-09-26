<script setup lang="ts">
import { computed, ref } from 'vue';
import AppToast from '@/components/AppToast.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import type { GroupView } from '@/api/types';
import RbacBanner from '../components/RbacBanner.vue';
import { useDeleteRbacGroup, useRbacGroups } from '../queries';

const groups = useRbacGroups();
const deleteGroup = useDeleteRbacGroup();

const target = ref<GroupView | null>(null);
const confirmOpen = ref(false);
const toast = ref<{ok: boolean; text: string} | null>(null);
const toastOpen = computed({
    get: () => toast.value !== null,
    set: (v: boolean) => { if (!v) toast.value = null; },
});

const openDelete = (group: GroupView): void => {
    target.value = group;
    confirmOpen.value = true;
};

const confirmDelete = async (): Promise<void> => {
    if (!target.value) return;
    try {
        await deleteGroup.mutateAsync(target.value.name);
        toast.value = {ok: true, text: `Group "${target.value.name}" deleted — applying to the gateway.`};
        confirmOpen.value = false;
    } catch (cause) {
        toast.value = {
            ok: false,
            text: cause instanceof Error ? cause.message : `Could not delete "${target.value.name}".`,
        };
        confirmOpen.value = false;
    }
};
</script>

<template>
    <div>
        <div class="head">
            <div>
                <h1>Groups</h1>
                <p class="lede">
                    A group is the unit of membership: it lists SASL clients who share a set of role bindings. Access is
                    the union of the roles every group a client belongs to grants.
                </p>
            </div>
            <RouterLink class="btn btn-primary" to="/rbac/groups/new">
                <i class="ph-duotone ph-plus" />New group
            </RouterLink>
        </div>

        <RbacBanner>
            Roles only take effect through a group — a client outside every group has <strong>no access</strong>. Saving
            writes a config snapshot the gateway applies asynchronously.
        </RbacBanner>

        <p v-if="groups.error.value" class="form-error">{{ groups.error.value.message }}</p>

        <div v-else-if="groups.data.value && groups.data.value.length === 0" class="empty">
            No groups yet. Membership is what turns role ACLs into real access —
            <RouterLink to="/rbac/groups/new">create the first group</RouterLink>.
        </div>

        <div v-else class="table-scroll">
            <table class="table" style="min-width: 860px">
                <thead>
                    <tr>
                        <th>Group</th>
                        <th>Clients</th>
                        <th>Roles</th>
                        <th />
                    </tr>
                </thead>
                <tbody>
                    <template v-for="group in groups.data.value" :key="group.name">
                        <tr class="group-row">
                            <td class="mono cell strong">
                                <RouterLink class="group-link" :to="`/rbac/groups/${encodeURIComponent(group.name)}/`">{{ group.name }}</RouterLink>
                            </td>
                            <td>
                                <span class="tag tag-neutral count">{{ group.clients.length }} client{{ group.clients.length === 1 ? '' : 's' }}</span>
                            </td>
                            <td>
                                <span class="tag tag-neutral count">{{ group.roles.length }} role{{ group.roles.length === 1 ? '' : 's' }}</span>
                            </td>
                            <td class="actions">
                                <RouterLink class="btn btn-ghost" :to="`/rbac/groups/${encodeURIComponent(group.name)}/edit`">Edit</RouterLink>
                                <button
                                    class="btn btn-ghost btn-danger"
                                    :disabled="group.clients.length > 0"
                                    :title="group.clients.length > 0 ? 'Remove its clients first' : undefined"
                                    @click="openDelete(group)"
                                >Delete</button>
                            </td>
                        </tr>
                        <tr class="detail-row">
                            <td colspan="4">
                                <div>
                                    <span class="connector mono">├</span>
                                    <span class="detail-label">Clients:</span>
                                    <template v-if="group.clients.length">
                                        <RouterLink
                                            v-for="member in group.clients"
                                            :key="member"
                                            class="detail-item"
                                            :to="`/clients/${encodeURIComponent(member)}`"
                                        >{{ member }}</RouterLink>
                                    </template>
                                    <span v-else class="faint">no clients</span>
                                </div>
                                <div class="detail-roles">
                                    <span class="connector mono">└</span>
                                    <span class="detail-label">Roles:</span>
                                    <template v-if="group.roles.length">
                                        <RouterLink
                                            v-for="role in group.roles"
                                            :key="role"
                                            class="tag tag-accent detail-role"
                                            :to="`/rbac/roles/${encodeURIComponent(role)}`"
                                        >{{ role }}</RouterLink>
                                    </template>
                                    <span v-else class="faint">none — grants nothing</span>
                                </div>
                            </td>
                        </tr>
                    </template>
                </tbody>
            </table>
        </div>

        <ConfirmDialog
            v-model:open="confirmOpen"
            title="Delete group?"
            :body="`Clients of “${target?.name ?? ''}” immediately lose the roles it bound. The roles and clients themselves stay configured.`"
            confirm-label="Delete group"
            danger
            :pending="deleteGroup.isPending.value"
            @confirm="confirmDelete"
        />

        <AppToast v-model:open="toastOpen" :ok="toast?.ok ?? true" :text="toast?.text ?? ''" />
    </div>
</template>

<style scoped>
.head { display: flex; align-items: flex-end; gap: 24px; margin-bottom: 20px; }
.head > div { margin-right: auto; }
.strong { font-weight: 500; }
.group-link { color: inherit; text-decoration: none; }
.group-link:hover { text-decoration: underline; }
.count { margin-right: 6px; }
.group-row td:first-child { box-shadow: inset 2px 0 0 var(--brand); }
.group-row:hover { background: none; }
.detail-row td { white-space: normal; padding-top: 6px; padding-bottom: 28px; font-size: 12.5px; background: color-mix(in srgb, var(--color-accent) 6%, transparent); }
.detail-row:hover { background: none; }
.detail-row:hover td { background: color-mix(in srgb, var(--color-accent) 6%, transparent); }
.detail-label { color: var(--faint); margin-right: 8px; }
.detail-roles { margin-top: 4px; }
.connector { color: var(--faint); display: inline-block; width: 12px; font-size: 12.5px; }
.detail-item { margin-right: 12px; text-decoration: none; color: inherit; }
.detail-item:hover { text-decoration: underline; }
.detail-role { margin-right: 6px; text-decoration: none; cursor: pointer; }
.detail-role:hover { text-decoration: underline; }
.actions { text-align: right; }
.actions > * + * { margin-left: 6px; }
.actions .btn { font-size: 12.5px; }
.empty { padding: 26px; text-align: center; font-size: 13px; color: var(--muted); border: 1px dashed var(--chrome-line); border-radius: var(--radius-md); }
.form-error { font-size: 13px; color: var(--color-accent-2-700); }
</style>
