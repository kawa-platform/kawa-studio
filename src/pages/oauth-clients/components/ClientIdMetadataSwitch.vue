<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
import AppSwitch from '@/components/AppSwitch.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import McpConnectInfo from './McpConnectInfo.vue';
import { MCP_CLIENT_REGISTRATION_URL, messageOf } from '../lib/oauthClients';
import { useModules, useUpdateModule } from '@/pages/modules/queries';

/// The gateway's `mcp-cimd` module: whether clients may sign in with an OAuth Client ID Metadata Document
/// instead of being registered. It only counts while the `mcp` module is on. A gateway that does not report the
/// module does not offer the feature, so nothing is shown.
const { data } = useModules();
const cimd = computed(() => data.value?.find((module) => module.id === 'mcp-cimd'));
const mcpOn = computed(() => data.value?.find((module) => module.id === 'mcp')?.enabled ?? true);

const update = useUpdateModule();
const confirming = ref(false);
const pending = ref(false);
const error = ref<string | null>(null);

const set = async (enabled: boolean): Promise<void> => {
    pending.value = true;
    error.value = null;
    try {
        await update.mutateAsync({ id: 'mcp-cimd', body: { enabled } });
        confirming.value = false;
    } catch (cause) {
        error.value = messageOf(cause);
    } finally {
        pending.value = false;
    }
};

/// Switching on is harmless; switching off revokes tokens, so it is confirmed first.
const ask = (): void => {
    if (!cimd.value) return;
    error.value = null;
    if (cimd.value.enabled) confirming.value = true;
    else void set(true);
};
</script>

<template>
    <section v-if="cimd" class="cimd" :class="{ 'cimd-inactive': !mcpOn }" aria-labelledby="cimd-title">
        <div class="cimd-head">
            <i class="ph-duotone ph-identification-card" />
            <h2 id="cimd-title">Client ID Metadata Documents</h2>
            <span class="tag tag-neutral">CIMD</span>
            <AppSwitch
                :model-value="cimd.enabled"
                :disabled="!mcpOn || pending"
                aria-label="Client ID metadata documents"
                @update:model-value="ask"
            />
        </div>
        <p class="cimd-text">
            Clients such as Claude and VS Code use an https URL as client ID and publish a metadata document there, so
            nothing needs registering. Their tokens only work on the MCP endpoint. Switching this off revokes them.
        </p>
        <p class="cimd-spec">
            <a :href="MCP_CLIENT_REGISTRATION_URL" target="_blank" rel="noopener noreferrer">Client ID Metadata Documents in the MCP specification</a>
        </p>
        <McpConnectInfo />
        <p v-if="!mcpOn" class="cimd-note" role="note">
            <i class="ph-duotone ph-info" />
            <span>The MCP server module is off, so this has no effect. <RouterLink to="/modules">Enable it on Modules.</RouterLink></span>
        </p>
        <p v-if="error && !confirming" class="cimd-error" role="alert">{{ error }}</p>

        <ConfirmDialog
            v-model:open="confirming"
            title="Disable sign-in without registration?"
            body="Clients that signed in with a metadata document lose access on their next request, and no new ones can sign in. Registered clients are not affected. Enabling it again lets them sign in again."
            confirm-label="Disable"
            danger
            :pending="pending"
            @confirm="set(false)"
        >
            <p v-if="error" class="cimd-error" role="alert">{{ error }}</p>
        </ConfirmDialog>
    </section>
</template>

<style scoped>
.cimd {
    max-width: 760px; margin: 0 0 24px; padding: 18px 20px;
    border: 1px solid var(--panel-line); border-radius: var(--radius-xl); background: var(--color-surface);
}
.cimd-head { display: flex; align-items: center; gap: 12px; }
.cimd-head > i { font-size: 22px; color: var(--color-accent-700); }
.cimd-head h2 { margin: 0; font-size: 16px; }
.cimd-head .tag { margin-right: auto; }
.cimd-spec { margin: 6px 0 0; font-size: 13px; }
.cimd-text { margin: 10px 0 0; font-size: 13.5px; line-height: 1.55; color: var(--muted); }
.cimd-inactive .cimd-text { opacity: 0.8; }
.cimd-note { display: flex; gap: 8px; align-items: flex-start; margin: 10px 0 0; font-size: 13px; }
.cimd-note i { flex: none; margin-top: 1px; font-size: 16px; color: var(--warning); }
.cimd-error { margin: 10px 0 0; font-size: 13px; color: var(--color-accent-2-700); }
</style>
