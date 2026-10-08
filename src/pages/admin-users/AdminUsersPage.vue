<script setup lang="ts">
import { computed, h, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { createColumnHelper } from '@tanstack/vue-table';
import { ApiError } from '@/api/error';
import type { AdminUser } from '@/api/types';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import DataTable from '@/components/DataTable.vue';
import { useAuthStore } from '@/stores/auth';
import { errorsOf, isCurrentUser, labelOf, messageOf, validatePassword } from './lib/adminUsers';
import { useAdminUsers, useDeleteAdminUser, useUpdateAdminUser } from './queries';

const auth = useAuthStore();
const { data, error, isPending, refetch } = useAdminUsers();
const users = computed(() => data.value ?? []);
const loadError = computed(() => error.value instanceof ApiError ? error.value.message : error.value ? 'Request failed.' : null);
const update = useUpdateAdminUser();
const remove = useDeleteAdminUser();

const isSelf = (user: AdminUser): boolean => isCurrentUser(user, auth.username);

type DialogKind = 'password' | 'disable' | 'delete';

const kind = ref<DialogKind | null>(null);
const target = ref<AdminUser | null>(null);
const pending = ref(false);
const form = ref({ password: '', confirmPassword: '' });
const errors = ref<Record<string, string>>({});
/// A refusal from an action taken straight from the table (re-enabling), shown above it.
const actionError = ref<string | null>(null);

const open = computed({
    get: () => kind.value !== null,
    set: (value: boolean) => { if (!value) kind.value = null; },
});

const openDialog = (next: DialogKind, user: AdminUser): void => {
    target.value = user;
    form.value = { password: '', confirmPassword: '' };
    errors.value = {};
    actionError.value = null;
    kind.value = next;
};

const enable = async (user: AdminUser): Promise<void> => {
    actionError.value = null;
    try {
        await update.mutateAsync({ id: user.id, body: { enabled: true } });
    } catch (cause) {
        actionError.value = messageOf(cause);
    }
};

const submit = async (): Promise<void> => {
    const user = target.value;
    if (!user) return;
    if (kind.value === 'password') {
        const found = validatePassword(form.value.password, form.value.confirmPassword);
        errors.value = found;
        if (Object.keys(found).length) return;
    }
    pending.value = true;
    try {
        if (kind.value === 'password') await update.mutateAsync({ id: user.id, body: { password: form.value.password } });
        else if (kind.value === 'disable') await update.mutateAsync({ id: user.id, body: { enabled: false } });
        else if (kind.value === 'delete') await remove.mutateAsync(user.id);
        kind.value = null;
    } catch (cause) {
        // Only the password dialog has a field to point at; any other refusal is the dialog's own.
        errors.value = kind.value === 'password' ? errorsOf(cause) : { form: messageOf(cause) };
    } finally {
        // Drop the typed password either way; it is never kept around or shown again.
        form.value = { password: '', confirmPassword: '' };
        pending.value = false;
    }
};

const dialogTitle = computed(() => {
    const name = target.value?.email ?? '';
    if (kind.value === 'password') return 'Change password';
    if (kind.value === 'disable') return `Disable ${name}?`;
    return `Delete ${name}?`;
});

const dialogBody = computed(() => {
    const user = target.value;
    if (!user) return '';
    const self = isSelf(user) ? ' This is your own account: you will be signed out.' : '';
    if (kind.value === 'password') return `Set a new password for ${labelOf(user)}. Their existing sessions stay signed in.`;
    if (kind.value === 'disable') return `${labelOf(user)} can no longer sign in, and their sessions end immediately. The account is kept and can be re-enabled.${self}`;
    return `${labelOf(user)} is removed and their sessions end immediately. This cannot be undone; disable the account instead to keep it.${self}`;
});

const confirmLabel = computed(() => {
    if (kind.value === 'password') return 'Change password';
    if (kind.value === 'disable') return 'Disable admin user';
    return 'Delete admin user';
});

const asDate = (iso: string): string => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : date.toISOString().slice(0, 10);
};

const ghost = (label: string, onClick: () => void, danger = false) =>
    h('button', { class: ['btn', 'btn-ghost', { 'btn-danger': danger }], onClick }, label);

const column = createColumnHelper<AdminUser>();
const columns = [
    column.accessor('email', {
        header: 'Email',
        meta: { width: '30%' },
        cell: (info) => h('span', { class: 'email' }, [
            h(RouterLink, { class: 'mono user-link', to: `/admin/users/${encodeURIComponent(info.row.original.id)}/edit` }, () => info.getValue()),
            isSelf(info.row.original) ? h('span', { class: 'tag tag-neutral you' }, 'you') : null,
        ]),
    }),
    column.accessor((row) => row.displayName ?? '', {
        id: 'displayName',
        header: 'Display name',
        meta: { width: '20%' },
        cell: (info) => info.getValue() || h('span', { class: 'muted' }, '—'),
    }),
    column.accessor('enabled', {
        header: 'Status',
        meta: { width: '11%' },
        cell: (info) => h('span', { class: ['tag', info.getValue() ? 'tag-accent' : 'tag-accent-2'] }, info.getValue() ? 'Enabled' : 'Disabled'),
    }),
    column.accessor('createdAt', {
        header: 'Created',
        meta: { width: '11%' },
        cell: (info) => h('span', { class: 'muted date', title: info.getValue() }, asDate(info.getValue())),
    }),
    column.display({
        id: 'actions',
        header: '',
        enableSorting: false,
        meta: { width: '28%' },
        cell: (info) => {
            const user = info.row.original;
            return h('div', { class: 'actions' }, [
                h(RouterLink, { class: 'btn btn-ghost', to: `/admin/users/${encodeURIComponent(user.id)}/edit` }, () => 'Edit'),
                ghost('Change password', () => openDialog('password', user)),
                user.enabled
                    ? ghost('Disable', () => openDialog('disable', user))
                    : ghost('Enable', () => void enable(user)),
                ghost('Delete', () => openDialog('delete', user), true),
            ]);
        },
    }),
];
</script>

<template>
    <div>
        <div class="head">
            <div>
                <h1>Admin users</h1>
                <p class="lede">
                    Accounts that sign in to this admin console and the admin API. Passwords are write-only: the
                    gateway keeps a hash and never returns it.
                </p>
            </div>
            <RouterLink class="btn btn-primary" to="/admin/users/new">
                <i class="ph-duotone ph-user-plus" />New admin user
            </RouterLink>
        </div>

        <div v-if="loadError" class="load-error" role="alert">
            <p><strong>Could not load admin users.</strong> {{ loadError }}</p>
            <button class="btn btn-secondary" @click="refetch()">Retry</button>
        </div>
        <p v-else-if="isPending" class="muted">Loading…</p>

        <template v-else>
            <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
            <DataTable :columns="columns" :data="users" min-width="860px" />
        </template>

        <ConfirmDialog
            v-model:open="open"
            :title="dialogTitle"
            :body="dialogBody"
            :confirm-label="confirmLabel"
            :danger="kind !== 'password'"
            :pending="pending"
            @confirm="submit"
        >
            <template v-if="kind === 'password'">
                <div class="field">
                    <label for="password">New password</label>
                    <input id="password" v-model="form.password" class="input" type="password" autocomplete="new-password">
                    <div v-if="errors.password" class="field-error">{{ errors.password }}</div>
                </div>
                <div class="field">
                    <label for="confirm-password">Confirm password</label>
                    <input id="confirm-password" v-model="form.confirmPassword" class="input" type="password" autocomplete="new-password">
                    <div v-if="errors.confirmPassword" class="field-error">{{ errors.confirmPassword }}</div>
                </div>
            </template>

            <p v-if="errors.form" class="field-error" role="alert">{{ errors.form }}</p>
        </ConfirmDialog>
    </div>
</template>

<style scoped>
.head { display: flex; align-items: flex-end; gap: 24px; margin-bottom: 20px; }
.head > div { margin-right: auto; }
:deep(.email) { display: inline-flex; align-items: center; gap: 8px; }
:deep(.user-link) { text-decoration: none; }
:deep(.user-link:hover) { text-decoration: underline; }
:deep(.date) { font-size: 12.5px; }
:deep(.actions) { text-align: right; white-space: nowrap; }
:deep(.actions > * + *) { margin-left: 6px; }
:deep(.actions .btn) { font-size: 12.5px; }
.field + .field { margin-top: 10px; }
.field-error { font-size: 12px; color: var(--color-accent-2-700); margin-top: 4px; }
.form-error { font-size: 13px; color: var(--color-accent-2-700); }
.load-error {
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    padding: 12px 14px; border: 1px solid var(--color-accent-2-600); border-radius: var(--radius-md);
    color: var(--color-accent-2-700);
}
.load-error p { margin: 0; font-size: 13px; }
</style>
