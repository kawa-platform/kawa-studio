<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { useApi } from '@/api/api';
import { ApiError } from '@/api/error';
import type { Client } from '@/api/types';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import { keys } from '@/queries/keys';
import { useRbacGroups } from '../rbac/queries';
import { groupsOfUser } from '../rbac/lib/rbac';
import { validatePassword } from './lib/clients';
import ClientsTabs from './ClientsTabs.vue';

const api = useApi();
const { data: usersData, error, refetch: reload } = useQuery({ queryKey: keys.clients(), queryFn: () => api.listClients() });
const users = computed(() => usersData.value ?? []);
const errorMessage = computed(() => error.value instanceof ApiError ? error.value.message : error.value ? 'Request failed.' : null);
const groups = useRbacGroups();

type DialogKind = 'reset' | 'delete';

const kind = ref<DialogKind | null>(null);
const target = ref<Client | null>(null);
const pending = ref(false);
const form = ref({ username: '', password: '' });
const errors = ref<Record<string, string>>({});

const open = computed({
    get: () => kind.value !== null,
    set: (value: boolean) => { if (!value) kind.value = null; },
});

const openReset = (user: Client): void => {
    target.value = user;
    form.value = { username: user.username, password: '' };
    errors.value = {};
    kind.value = 'reset';
};

const openDelete = (user: Client): void => {
    target.value = user;
    errors.value = {};
    kind.value = 'delete';
};

const submit = async (): Promise<void> => {
    pending.value = true;
    try {
        if (kind.value === 'reset' && target.value) {
            const passwordError = validatePassword(form.value.password);
            if (passwordError) {
                errors.value = { password: passwordError };
                return;
            }
            await api.resetPassword(target.value.username, form.value.password);
        } else if (kind.value === 'delete' && target.value) {
            await api.deleteClient(target.value.username);
        }
        kind.value = null;
        await reload();
    } catch (cause) {
        if (cause instanceof ApiError && cause.field) errors.value = { [cause.field]: cause.message };
        else errors.value = { form: cause instanceof ApiError ? cause.message : 'Request failed.' };
    } finally {
        pending.value = false;
    }
};

const dialogTitle = computed(() => {
    if (kind.value === 'reset') return 'Reset password';
    return 'Delete ' + (target.value?.username ?? '') + '?';
});

const dialogBody = computed(() => {
    if (kind.value === 'reset') return 'Set a new password for ' + (target.value?.username ?? '') + '. Existing connections keep their session until they reconnect.';
    const clientGroups = groupsOfUser(groups.data.value ?? [], target.value?.username ?? '');
    const groupNote = clientGroups.length
        ? ` and is removed from its groups: ${clientGroups.map((group) => group.name).join(', ')}`
        : '';
    return `The client loses access immediately${groupNote}. ACLs referencing the client are left in place.`;
});

const confirmLabel = computed(() =>
    kind.value === 'reset' ? 'Reset password' : 'Delete client');
</script>

<template>
    <div>
        <div class="head">
            <div>
                <h1>Clients</h1>
                <p class="lede">
                    SASL principals the gateway authenticates. Credentials are held by kawa, not by the upstream
                    cluster.
                </p>
            </div>
            <RouterLink class="btn btn-primary" to="/clients/new">
                <i class="ph-duotone ph-user-plus" />New client
            </RouterLink>
        </div>

        <ClientsTabs />

        <p v-if="errorMessage" class="form-error">{{ errorMessage }}</p>

        <div class="table-scroll">
            <table class="table" style="min-width: 660px">
                <thead>
                    <tr>
                        <th style="width: 28%">Client name</th>
                        <th style="width: 20%">Mechanism</th>
                        <th style="width: 16%">Groups</th>
<!--                        <th style="width: 14%">Created</th>-->
                        <th style="width: 22%" />
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="user in users" :key="user.username">
                        <td class="mono cell">
                            <RouterLink class="client-link" :to="`/clients/${encodeURIComponent(user.username)}`">{{ user.username }}</RouterLink>
                        </td>
                        <td><span class="tag tag-neutral">{{ user.mechanism }}</span></td>
                        <td class="groups">
                            <template v-if="groupsOfUser(groups.data.value ?? [], user.username).length">
                                <RouterLink
                                    v-for="group in groupsOfUser(groups.data.value ?? [], user.username)"
                                    :key="group.name"
                                    class="tag tag-accent group-link"
                                    :to="`/rbac/groups/${encodeURIComponent(group.name)}`"
                                >{{ group.name }}</RouterLink>
                            </template>
                            <span v-else class="muted">—</span>
                        </td>
<!--                        <td class="muted date">{{ asDate(user.createdAt) }}</td>-->
                        <td class="actions">
                            <RouterLink class="btn btn-ghost" :to="`/clients/${user.username}/edit`">Edit</RouterLink>
                            <button class="btn btn-ghost" @click="openReset(user)">Reset password</button>
                            <button class="btn btn-ghost btn-danger" @click="openDelete(user)">Delete</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <ConfirmDialog
            v-model:open="open"
            :title="dialogTitle"
            :body="dialogBody"
            :confirm-label="confirmLabel"
            :danger="kind === 'delete'"
            :pending="pending"
            @confirm="submit"
        >
            <div v-if="kind === 'reset'" class="field">
                <label for="password">New password</label>
                <input id="password" v-model="form.password" class="input" type="password">
                <div v-if="errors.password" class="field-error">{{ errors.password }}</div>
            </div>

            <p v-if="errors.form" class="field-error">{{ errors.form }}</p>
        </ConfirmDialog>
    </div>
</template>

<style scoped>
.head { display: flex; align-items: flex-end; gap: 24px; margin-bottom: 20px; }
.head > div { margin-right: auto; }
.date { font-size: 12.5px; }
.actions { text-align: right; }
.actions > * + * { margin-left: 6px; }
.actions .btn { font-size: 12.5px; }
.groups { white-space: normal; }
.group-link { display: inline-block; margin: 2px 6px 2px 0; vertical-align: middle; text-decoration: none; cursor: pointer; }
.group-link:hover { text-decoration: underline; }
.field-error { font-size: 12px; color: var(--color-accent-2-700); margin-top: 4px; }
.form-error { font-size: 13px; color: var(--color-accent-2-700); }
</style>
