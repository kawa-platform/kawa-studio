<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppToast from '@/components/AppToast.vue';
import { usePatchClient, useClients } from './queries';
import {useRbacGroups} from '@/pages/rbac/queries';
import SuggestionInput from '@/pages/rbac/components/SuggestionInput.vue';

const route = useRoute();
const router = useRouter();

const MECHANISMS = ['PLAIN', 'SCRAM-SHA-256', 'SCRAM-SHA-512'];

const nameParam = computed(() => String(route.params.name ?? ''));

const clients = useClients();
const patchClient = usePatchClient();
const groups = useRbacGroups();
const groupSuggestions = computed(() => (groups.data.value ?? []).map((group) => group.name));

const draft = ref({ mechanism: 'PLAIN', groups: [] as string[] });
const errors = ref<Record<string, string>>({});
const toast = ref<{ ok: boolean; text: string } | null>(null);
const toastOpen = computed({
    get: () => toast.value !== null,
    set: (v: boolean) => { if (!v) toast.value = null; },
});

const existing = computed(() =>
    nameParam.value ? clients.data.value?.find((client) => client.username === nameParam.value) : undefined,
);
const notFound = computed(() =>
    Boolean(nameParam.value) && !clients.isPending.value && clients.data.value && !existing.value,
);

/// The draft fills in once the client list arrives; a missing client after load leaves the
/// draft untouched — the not-found view takes over.
watch(
    [clients.isPending, existing, () => groups.data.value] as const,
    ([pending, edit]) => {
        if (!pending && edit) {
            draft.value = {
                mechanism: edit.mechanism,
                groups: groups.data.value
                    ?.filter((group) => group.clients.includes(edit.username))
                    .map((group) => group.name) ?? [],
            };
        }
    },
    { immediate: true },
);

const save = async (): Promise<void> => {
    errors.value = {};
    try {
        await patchClient.mutateAsync({
            username: nameParam.value,
            body: {mechanism: draft.value.mechanism, groups: draft.value.groups},
        });
        toast.value = { ok: true, text: `Mechanism for "${nameParam.value}" updated — the gateway applies it shortly.` };
        await router.push('/clients');
    } catch (cause) {
        errors.value.form = cause instanceof Error ? cause.message : 'Could not save the client.';
    }
};
</script>

<template>
    <div>
        <div class="head">
            <div>
                <h1>Edit “{{ nameParam }}”</h1>
                <p class="lede">
                    The SASL mechanism the principal uses to authenticate. The username keys the config API, so a
                    client is identified by name for its lifetime; the password is reset separately and never exposed
                    here.
                </p>
            </div>
            <RouterLink class="btn btn-secondary" to="/clients"><i class="ph-duotone ph-arrow-left" />Back</RouterLink>
        </div>

        <p v-if="notFound" class="form-error">
            Client “{{ nameParam }}” does not exist. <RouterLink to="/clients/new">Create a new client</RouterLink>
            instead.
        </p>

        <p v-if="clients.error.value" class="form-error">{{ clients.error.value.message }}</p>

        <form v-else-if="!notFound" class="editor" @submit.prevent="save">
            <div class="field client-name">
                <label for="client-name">Client name</label>
                <input id="client-name" class="input mono" :value="nameParam" disabled>
                <p class="hint">Renaming is not supported — the name keys the config API.</p>
            </div>

            <div class="field">
                <label for="mechanism">Mechanism</label>
                <select id="mechanism" v-model="draft.mechanism" class="input">
                    <option v-for="m in MECHANISMS" :key="m" :value="m">{{ m }}</option>
                </select>
                <p class="hint">The SASL mechanism the principal uses. SCRAM variants never put the password on the
                    wire in the clear. Clients must reconnect to authenticate with the new mechanism.</p>
            </div>

            <div class="field">
                <label>Groups</label>
                <p class="hint">Choose the RBAC groups this client should belong to. Saving replaces its current group memberships.</p>
                <p v-if="groups.isPending.value" class="hint">Loading groups…</p>
                <p v-else-if="groups.error.value" class="form-error">Could not load groups: {{ groups.error.value.message }}</p>
                <SuggestionInput
                    v-else-if="groups.data.value?.length"
                    v-model="draft.groups"
                    :suggestions="groupSuggestions"
                    placeholder="Add a group — e.g. producers"
                    :allow-new="false"
                />
                <p v-else class="hint">No groups have been configured yet.</p>
            </div>

            <div class="actions">
                <RouterLink class="btn btn-secondary" to="/clients">Cancel</RouterLink>
                <button
                    type="submit"
                    class="btn btn-primary"
                    :disabled="patchClient.isPending.value || groups.isPending.value || !!groups.error.value"
                >
                    <i class="ph-duotone ph-check" />Save changes
                </button>
            </div>

            <p v-if="errors.form" class="form-error">{{ errors.form }}</p>
        </form>

        <AppToast v-model:open="toastOpen" :ok="toast?.ok ?? true" :text="toast?.text ?? ''" />
    </div>
</template>

<style scoped>
.head { display: flex; align-items: flex-end; gap: 24px; margin-bottom: 20px; }
.head > div { margin-right: auto; }

.editor { max-width: 640px; }
.client-name { max-width: 420px; margin-bottom: 24px; }
.hint { margin: 5px 0 0; }
.actions { display: flex; gap: 10px; margin-top: 26px; }

.form-error { font-size: 12.5px; color: var(--color-accent-2-700); margin-top: 6px; }
</style>
