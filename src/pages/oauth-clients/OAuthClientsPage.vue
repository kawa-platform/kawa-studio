<script setup lang="ts">
import { computed, h, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import AppSwitch from '@/components/AppSwitch.vue';
import { createColumnHelper } from '@tanstack/vue-table';
import { ApiError } from '@/api/error';
import type { OAuthClientConfigView } from '@/api/types';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import McpConnectInfo from './components/McpConnectInfo.vue';
import ClientIdMetadataSwitch from './components/ClientIdMetadataSwitch.vue';
import DataTable from '@/components/DataTable.vue';
import { isUnavailable, labelOf, MCP_CLIENT_REGISTRATION_URL, messageOf, requestWithEnabled } from './lib/oauthClients';
import { useDeleteOAuthClient, useOAuthClients, useUpsertOAuthClient } from './queries';

const router = useRouter();
const { data, error, isPending, refetch } = useOAuthClients();
const upsert = useUpsertOAuthClient();
const remove = useDeleteOAuthClient();

const unavailable = computed(() => isUnavailable(error.value));
const loadError = computed(() => {
    if (!error.value || unavailable.value) return null;
    return error.value instanceof ApiError ? error.value.message : 'Request failed.';
});

/// The switch position the admin asked for, kept until the gateway answers; a refusal drops it, which
/// puts the switch back.
const asked = ref<Record<string, boolean>>({});
const clients = computed(() =>
    (data.value ?? []).map((client) => ({ ...client, enabled: asked.value[client.id] ?? client.enabled })));

/// A refusal of a switch taken straight from the table, shown above it.
const actionError = ref<string | null>(null);

const toggle = async (client: OAuthClientConfigView, enabled: boolean): Promise<void> => {
    actionError.value = null;
    asked.value = { ...asked.value, [client.id]: enabled };
    try {
        await upsert.mutateAsync({ id: client.id, body: requestWithEnabled(client, enabled) });
    } catch (cause) {
        actionError.value = messageOf(cause);
    } finally {
        const { [client.id]: _settled, ...rest } = asked.value;
        asked.value = rest;
    }
};

const copied = ref<string | null>(null);
const copy = async (id: string): Promise<void> => {
    try {
        await navigator.clipboard.writeText(id);
        copied.value = id;
        setTimeout(() => { if (copied.value === id) copied.value = null; }, 1500);
    } catch {
        // clipboard unavailable (insecure context): the id stays selectable in the table
    }
};

const target = ref<OAuthClientConfigView | null>(null);
const pending = ref(false);
const deleteError = ref<string | null>(null);
const open = computed({
    get: () => target.value !== null,
    set: (value: boolean) => { if (!value) target.value = null; },
});

const askDelete = (client: OAuthClientConfigView): void => {
    target.value = client;
    deleteError.value = null;
};

const confirmDelete = async (): Promise<void> => {
    const client = target.value;
    if (!client) return;
    pending.value = true;
    deleteError.value = null;
    try {
        await remove.mutateAsync(client.id);
        target.value = null;
    } catch (cause) {
        deleteError.value = messageOf(cause);
    } finally {
        pending.value = false;
    }
};

const editPath = (client: OAuthClientConfigView): string => `/oauth-clients/${encodeURIComponent(client.id)}/edit`;

const column = createColumnHelper<OAuthClientConfigView>();
const columns = [
    column.accessor((row) => labelOf(row), {
        id: 'name',
        header: 'Name',
        meta: { width: '20%' },
        cell: (info) => h(RouterLink, { class: 'client-link', to: editPath(info.row.original) }, () => info.getValue()),
    }),
    column.accessor('id', {
        header: 'Client ID',
        meta: { width: '24%' },
        cell: (info) => h('span', { class: 'client-id' }, [
            h('span', { class: 'mono' }, info.getValue()),
            h('button', {
                class: 'btn btn-ghost copy',
                type: 'button',
                'aria-label': `Copy client ID ${info.getValue()}`,
                title: copied.value === info.getValue() ? 'Copied' : 'Copy client ID',
                onClick: () => void copy(info.getValue()),
            }, [h('i', { class: ['ph-duotone', copied.value === info.getValue() ? 'ph-check' : 'ph-copy'] })]),
        ]),
    }),
    column.accessor('audience', {
        header: 'Audience',
        meta: { width: '10%' },
        cell: (info) => h('span', { class: ['tag', info.getValue() === 'admin' ? 'tag-accent-2' : 'tag-accent'] }, info.getValue()),
    }),
    column.accessor((row) => row.redirectUris[0] ?? '', {
        id: 'redirectUris',
        header: 'Redirect URIs',
        enableSorting: false,
        meta: { width: '26%' },
        cell: (info) => {
            const more = info.row.original.redirectUris.length - 1;
            return h('span', { class: 'redirects' }, [
                h('span', { class: 'mono uri', title: info.getValue() }, info.getValue()),
                more > 0 ? h('span', { class: 'tag tag-neutral' }, `+${more}`) : null,
            ]);
        },
    }),
    column.accessor('enabled', {
        header: 'Enabled',
        meta: { width: '8%' },
        cell: (info) => h(AppSwitch, {
            modelValue: info.getValue(),
            'aria-label': `${info.getValue() ? 'Disable' : 'Enable'} ${labelOf(info.row.original)}`,
            'onUpdate:modelValue': (value: boolean) => void toggle(info.row.original, value),
        }),
    }),
    column.display({
        id: 'actions',
        header: '',
        enableSorting: false,
        meta: { width: '12%' },
        cell: (info) => h('div', { class: 'actions' }, [
            h(RouterLink, { class: 'btn btn-ghost', to: editPath(info.row.original) }, () => 'Edit'),
            h('button', { class: 'btn btn-ghost btn-danger', onClick: () => askDelete(info.row.original) }, 'Delete'),
        ]),
    }),
];
</script>

<template>
    <div>
        <div class="head">
            <div>
                <h1>MCP settings</h1>
                <p class="lede">
                    How MCP tools such as Claude Code or VS Code identify themselves when they sign in to
                    <span class="mono">/mcp</span>: by a published metadata document, or pre-registered here.
                </p>
            </div>
        </div>

        <ClientIdMetadataSwitch v-if="!unavailable" />

        <div v-if="unavailable" class="empty" role="status">
            <i class="ph-duotone ph-key" />
            <h2>OAuth clients are not available</h2>
            <p>
                This gateway does not serve OAuth clients. They belong to the built-in authorization server, which
                runs when the admin API uses the <span class="mono">oauth</span> authentication provider
                (<span class="mono">admin.auth.type: oauth</span>).
            </p>
        </div>
        <section v-else class="registered" aria-labelledby="registered-title">
            <div class="registered-head">
                <div>
                    <h2 id="registered-title">Pre-registered clients</h2>
                    <p class="registered-lede">
                        For tools without a Client ID Metadata Document, or to pin a client. Public PKCE clients:
                        no secret, just a client ID and redirect URIs.
                    </p>
                    <p class="registered-spec">
                        <a :href="MCP_CLIENT_REGISTRATION_URL" target="_blank" rel="noopener noreferrer">Pre-registration in the MCP specification</a>
                    </p>
                </div>
                <button class="btn btn-primary" @click="router.push('/oauth-clients/new')">
                    <i class="ph-duotone ph-plus" />New client
                </button>
            </div>

        <McpConnectInfo :clients="clients" />

        <div v-if="loadError" class="load-error" role="alert">
            <p><strong>Could not load OAuth clients.</strong> {{ loadError }}</p>
            <button class="btn btn-secondary" @click="refetch()">Retry</button>
        </div>
        <p v-else-if="isPending" class="muted">Loading…</p>

        <template v-else>
            <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
            <div v-if="!clients.length" class="empty">
                <i class="ph-duotone ph-key" />
                <h2>No OAuth clients yet</h2>
                <p>
                    An OAuth client lets a tool such as Claude Code or Cursor sign in to the gateway on an admin's
                    behalf. Use the “New client” button to register one, then paste its client ID into the tool.
                </p>
            </div>
            <DataTable v-else :columns="columns" :data="clients" min-width="920px" />
        </template>
        </section>

        <ConfirmDialog
            v-model:open="open"
            :title="`Delete ${target ? labelOf(target) : ''}?`"
            :body="'The client is removed and its tokens stop working immediately. Tools using it must be registered again. This cannot be undone.'"
            confirm-label="Delete OAuth client"
            danger
            :pending="pending"
            @confirm="confirmDelete"
        >
            <p v-if="deleteError" class="field-error" role="alert">{{ deleteError }}</p>
        </ConfirmDialog>
    </div>
</template>

<style scoped>
.head { display: flex; align-items: flex-end; gap: 24px; margin-bottom: 20px; }
.head > div { margin-right: auto; }
.registered { margin-top: 8px; padding-top: 22px; border-top: 1px solid var(--chrome-line); }
.registered-head { display: flex; align-items: flex-start; gap: 24px; margin-bottom: 16px; }
.registered-head > div { margin-right: auto; max-width: 640px; }
.registered-head h2 { margin: 0; font-size: 18px; }
.registered-spec { margin: 6px 0 0; font-size: 13px; }
.registered-lede { margin: 6px 0 0; font-size: 13.5px; line-height: 1.55; color: var(--muted); }
:deep(.client-link) { font-weight: 550; text-decoration: none; }
:deep(.client-link:hover) { text-decoration: underline; }
:deep(.client-id) { display: inline-flex; align-items: center; gap: 4px; }
:deep(.copy) { padding: 2px 6px; }
:deep(.redirects) { display: inline-flex; align-items: center; gap: 8px; max-width: 100%; }
:deep(.uri) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px; }
:deep(.actions) { text-align: right; white-space: nowrap; }
:deep(.actions > * + *) { margin-left: 6px; }
:deep(.actions .btn) { font-size: 12.5px; }
.empty {
    display: flex; flex-direction: column; align-items: flex-start; gap: 8px;
    padding: 28px; border: 1px dashed var(--panel-line); border-radius: var(--radius-xl); max-width: 640px;
}
.empty i { font-size: 28px; color: var(--color-accent-700); }
.empty h2 { margin: 0; font-size: 17px; }
.empty p { margin: 0 0 6px; color: var(--muted); font-size: 14px; line-height: 1.55; }
.field-error { font-size: 12px; color: var(--color-accent-2-700); margin-top: 8px; }
.form-error { font-size: 13px; color: var(--color-accent-2-700); }
.load-error {
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    padding: 12px 14px; border: 1px solid var(--color-accent-2-600); border-radius: var(--radius-md);
    color: var(--color-accent-2-700);
}
.load-error p { margin: 0; font-size: 13px; }
</style>
