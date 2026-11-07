<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppSwitch from '@/components/AppSwitch.vue';
import {
    draftFromTemplate, draftOf, emptyDraft, isUnavailable, messageOf, REDIRECT_URI_RULE, requestOf, validateDraft,
} from './lib/oauthClients';
import { OAUTH_CLIENT_TEMPLATES, type OAuthClientTemplate } from './lib/templates';
import { useOAuthClients, useUpsertOAuthClient } from './queries';

const route = useRoute();
const router = useRouter();

/// /oauth-clients/:id/edit edits an existing client; no id = create.
const idParam = computed(() => String(route.params.id ?? ''));
const isNew = computed(() => !idParam.value);

const clients = useOAuthClients();
const upsert = useUpsertOAuthClient();

const draft = ref(emptyDraft());
const errors = ref<Record<string, string>>({});
const pending = ref(false);

const existing = computed(() =>
    idParam.value ? clients.data.value?.find((client) => client.id === idParam.value) : undefined,
);
const notFound = computed(() =>
    !isNew.value && !clients.isPending.value && !!clients.data.value && !existing.value,
);

watch(existing, (client) => { if (client) draft.value = draftOf(client); }, { immediate: true });

/// Saving an edit ends tokens already issued when the client no longer accepts them as before.
const revokesTokens = computed(() => {
    const client = existing.value;
    if (!client) return false;
    return client.enabled && !draft.value.enabled;
});

/// Saving a template under an id that exists would replace that client, so such a template is not offered.
const taken = (template: OAuthClientTemplate): boolean =>
    !!clients.data.value?.some((client) => client.id === template.id);

const applyTemplate = (template: OAuthClientTemplate): void => {
    draft.value = draftFromTemplate(template);
    errors.value = {};
};

const addUri = (): void => { draft.value.redirectUris.push(''); };
const removeUri = (row: number): void => {
    draft.value.redirectUris.splice(row, 1);
    if (!draft.value.redirectUris.length) draft.value.redirectUris.push('');
    errors.value = {};
};

const submit = async (): Promise<void> => {
    const found = validateDraft(draft.value, isNew.value);
    errors.value = found;
    if (Object.keys(found).length) return;
    const id = isNew.value ? draft.value.id : idParam.value;
    pending.value = true;
    try {
        await upsert.mutateAsync({ id, body: requestOf(draft.value) });
        void router.push('/oauth-clients');
    } catch (cause) {
        errors.value = { form: messageOf(cause) };
    } finally {
        pending.value = false;
    }
};
</script>

<template>
    <div class="form">
        <div class="head">
            <h1>{{ isNew ? 'New pre-registered client' : `Edit “${existing?.name || existing?.id || idParam}”` }}</h1>
            <p class="lede">
                A pre-registered public PKCE client of the built-in authorization server, such as an MCP tool. It has no
                client secret: the client ID and the redirect URIs identify it. Tools that publish a Client ID Metadata
                Document do not need this.
            </p>
        </div>

        <p v-if="clients.error.value && isUnavailable(clients.error.value)" class="error" role="alert">
            This gateway does not serve OAuth clients. <RouterLink to="/oauth-clients">Back to OAuth clients</RouterLink>
        </p>
        <p v-else-if="clients.error.value && !isNew" class="error" role="alert">
            Could not load OAuth clients: {{ clients.error.value.message }}
        </p>
        <p v-else-if="notFound" class="error">
            This OAuth client does not exist. <RouterLink to="/oauth-clients">Back to OAuth clients</RouterLink>
        </p>
        <p v-else-if="!isNew && clients.isPending.value" class="muted">Loading…</p>

        <template v-else>
            <section v-if="isNew" class="templates">
                <h2>Start from template</h2>
                <p class="hint">Prefills the form below; nothing is saved until you create the client.</p>
                <div class="template-list">
                    <button
                        v-for="template in OAUTH_CLIENT_TEMPLATES"
                        :key="template.id"
                        class="btn btn-secondary"
                        type="button"
                        :data-template="template.id"
                        :disabled="taken(template)"
                        :title="taken(template) ? `A client with the ID “${template.id}” already exists` : undefined"
                        @click="applyTemplate(template)"
                    >
                        {{ template.name }}
                        <span v-if="taken(template)" class="tag tag-neutral">already exists</span>
                    </button>
                </div>
            </section>

            <section>
                <h2>1 · Identity</h2>
                <div class="row">
                    <div class="field">
                        <label for="client-id">Client ID</label>
                        <input
                            id="client-id"
                            v-model="draft.id"
                            class="input mono"
                            :readonly="!isNew"
                            placeholder="claude-code"
                            autocomplete="off"
                            spellcheck="false"
                        >
                        <p v-if="errors.id" class="field-error">{{ errors.id }}</p>
                        <p v-else class="hint">
                            {{ isNew ? 'What the tool signs in with. Lower-case letters, digits and hyphens; cannot be changed later.' : 'Cannot be changed.' }}
                        </p>
                    </div>
                    <div class="field">
                        <label for="client-name">Name</label>
                        <input id="client-name" v-model="draft.name" class="input" placeholder="Optional" autocomplete="off">
                        <p class="hint">A label for this list. Leave empty to show the client ID.</p>
                    </div>
                </div>
                <div class="field enabled-field">
                    <label for="client-enabled">Enabled</label>
                    <AppSwitch id="client-enabled" v-model="draft.enabled" aria-label="Enabled" />
                    <p class="hint">A disabled client cannot sign in.</p>
                </div>
            </section>

            <section>
                <h2>2 · Redirect URIs</h2>
                <div v-for="(_, row) in draft.redirectUris" :key="row" class="field uri-row">
                    <div class="uri-input">
                        <input
                            v-model="draft.redirectUris[row]"
                            class="input mono"
                            :aria-label="`Redirect URI ${row + 1}`"
                            placeholder="http://localhost:*/callback"
                            autocomplete="off"
                            spellcheck="false"
                        >
                        <button
                            class="btn btn-ghost"
                            type="button"
                            :aria-label="`Remove redirect URI ${row + 1}`"
                            :disabled="draft.redirectUris.length === 1 && !draft.redirectUris[0]"
                            @click="removeUri(row)"
                        >
                            <i class="ph-duotone ph-trash" />
                        </button>
                    </div>
                    <p v-if="errors[`redirectUris.${row}`]" class="field-error">{{ errors[`redirectUris.${row}`] }}</p>
                </div>
                <p v-if="errors.redirectUris" class="field-error">{{ errors.redirectUris }}</p>
                <button class="btn btn-secondary add-uri" type="button" @click="addUri">
                    <i class="ph-duotone ph-plus" />Add redirect URI
                </button>
                <p class="hint">{{ REDIRECT_URI_RULE }}</p>
            </section>

            <p v-if="revokesTokens" class="warning" role="note">
                <i class="ph-duotone ph-warning" />
                Disabling this client stops its existing tokens
                from working immediately.
            </p>

            <div class="actions">
                <button class="btn btn-primary" :disabled="pending" @click="submit">
                    <i :class="['ph-duotone', isNew ? 'ph-plus' : 'ph-floppy-disk']" />
                    {{ pending ? 'Saving…' : isNew ? 'Create OAuth client' : 'Save changes' }}
                </button>
                <button class="btn btn-secondary" @click="router.push('/oauth-clients')">Cancel</button>
            </div>

            <p v-if="errors.form" class="error" role="alert">{{ errors.form }}</p>
        </template>
    </div>
</template>

<style scoped>
.template-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.enabled-field { display: flex; align-items: center; gap: 12px; }
.enabled-field label { margin: 0; }
.enabled-field .hint { margin: 0; }
.uri-row { margin-bottom: 8px; }
.uri-input { display: flex; align-items: center; gap: 6px; }
.uri-input .input { flex: 1; }
.add-uri { margin: 4px 0 8px; }
.warning {
    display: flex; gap: 10px; align-items: flex-start; margin: 12px 0; padding: 10px 12px;
    font-size: 13px; line-height: 1.5; border-radius: var(--radius-md);
    color: color-mix(in srgb, var(--warning) 75%, var(--color-text));
    background: color-mix(in srgb, var(--warning) 11%, transparent);
    border: 1px solid color-mix(in srgb, var(--warning) 28%, transparent);
}
.warning i { font-size: 17px; flex: none; margin-top: 1px; color: var(--warning); }
</style>
