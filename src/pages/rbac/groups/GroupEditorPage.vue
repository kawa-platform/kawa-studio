<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { GroupView } from '@/api/types';
import AppToast from '@/components/AppToast.vue';
import RbacBanner from '../components/RbacBanner.vue';
import SuggestionInput from '../components/SuggestionInput.vue';
import { useRbacAuthClients, useRbacGroups, useRbacRoles, useRenameRbacGroup, useUpsertRbacGroup } from '../queries';

const route = useRoute();
const router = useRouter();

const nameParam = computed(() => String(route.params.name ?? ''));
const isNew = computed(() => !nameParam.value);

const groups = useRbacGroups();
const roles = useRbacRoles();
const authClients = useRbacAuthClients();
const upsert = useUpsertRbacGroup();
const rename = useRenameRbacGroup();

const draft = ref<GroupView>({name: '', clients: [], roles: []});
const errors = ref<Record<string, string>>({});
const toast = ref<{ok: boolean; text: string} | null>(null);
const toastOpen = computed({
    get: () => toast.value !== null,
    set: (v: boolean) => { if (!v) toast.value = null; },
});

const existing = computed(() =>
    nameParam.value ? groups.data.value?.find((group) => group.name === nameParam.value) : undefined,
);
const notFound = computed(() =>
    Boolean(nameParam.value) && !groups.isPending.value && groups.data.value && !existing.value,
);

const userSuggestions = computed(() => (authClients.data.value ?? []).map((user) => user.username));
const roleSuggestions = computed(() => (roles.data.value ?? []).map((role) => role.name));

const knownRoles = computed(() => new Set(roleSuggestions.value));
const danglingRoles = computed(() => draft.value.roles.filter((role) => !knownRoles.value.has(role)));
const missingClients = computed(() =>
    draft.value.clients.filter((client) => !userSuggestions.value.includes(client)),
);

watch(
    () => [isNew.value, existing.value] as const,
    () => {
        if (isNew.value) draft.value = {name: '', clients: [], roles: []};
        else if (existing.value) draft.value = {
            name: existing.value.name,
            clients: [...existing.value.clients],
            roles: [...existing.value.roles],
        };
    },
    {immediate: true},
);

const save = async (): Promise<void> => {
    errors.value = {};
    const name = draft.value.name.trim();
    if (!name) {
        errors.value.name = 'Give the group a name.';
        return;
    }
    try {
        if (!isNew.value && name !== nameParam.value) {
            await rename.mutateAsync({ name: nameParam.value, body: { name } });
        }
        await upsert.mutateAsync({
            name,
            body: {clients: [...draft.value.clients], roles: [...draft.value.roles]},
        });
        toast.value = {ok: true, text: `Group "${name}" persisted — the gateway applies it shortly.`};
        await router.push('/rbac/groups');
    } catch (cause) {
        errors.value.form = cause instanceof Error ? cause.message : 'Could not save the group.';
    }
};
</script>

<template>
    <div>
        <div class="head">
            <div>
                <h1>{{ isNew ? 'New group' : `Edit “${nameParam}”` }}</h1>
                <p class="lede">
                    Clients are SASL principals the gateway authenticates; roles are the ACL bundles defined on the
                    Roles screen. A client in several groups inherits the union of their roles.
                </p>
            </div>
            <RouterLink class="btn btn-secondary" to="/rbac/groups"><i class="ph-duotone ph-arrow-left" />Back</RouterLink>
        </div>

        <RbacBanner>
            Membership alone grants nothing — a group only matters through the roles it binds. A client outside every
            group keeps hitting the <strong>default-deny</strong> wall.
        </RbacBanner>

        <p v-if="notFound" class="form-error">
            Group “{{ nameParam }}” does not exist. <RouterLink to="/rbac/groups/new">Create a new group</RouterLink> instead.
        </p>

        <p v-if="groups.error.value" class="form-error">{{ groups.error.value.message }}</p>

        <form v-else-if="!notFound" class="editor" @submit.prevent="save">
            <div class="field group-name">
                <label for="group-name">Group name</label>
                <input
                    id="group-name"
                    v-model="draft.name"
                    class="input mono"
                    placeholder="e.g. payments-platform"
                    @input="errors.name = ''"
                >
                <p v-if="!isNew" class="hint">Renaming re-keys the group — clients and roles move with it.</p>
                <div v-if="errors.name" class="field-error">{{ errors.name }}</div>
            </div>

            <div class="field">
                <label>Clients</label>
                <SuggestionInput v-model="draft.clients" :suggestions="userSuggestions" placeholder="Add a client — e.g. alice" allow-new />
                <p v-if="missingClients.length" class="warn">
                    <i class="ph-duotone ph-warning" />
                    {{ missingClients.join(', ') }} {{ missingClients.length === 1 ? 'is' : 'are' }} not in the gateway's
                    client store yet — they can be added later.
                </p>
            </div>

            <div class="field">
                <label>Roles</label>
                <SuggestionInput v-model="draft.roles" :suggestions="roleSuggestions" placeholder="Add a role — e.g. orders-reader" allow-new />
                <p v-if="danglingRoles.length" class="warn">
                    <i class="ph-duotone ph-warning" />
                    {{ danglingRoles.join(', ') }} {{ danglingRoles.length === 1 ? 'has' : 'have' }} no role config yet —
                    these clients get nothing until a role with that name exists.
                </p>
            </div>

            <div class="actions">
                <RouterLink class="btn btn-secondary" to="/rbac/groups">Cancel</RouterLink>
                <button type="submit" class="btn btn-primary" :disabled="upsert.isPending.value || rename.isPending.value">
                    <i class="ph-duotone ph-check" />{{ isNew ? 'Create group' : 'Save changes' }}
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

.editor { max-width: 680px; }
.hint { margin: 5px 0 0; }

.field > label { display: block; font-size: 12px; margin-bottom: 6px; color: var(--muted); }

.warn { display: flex; gap: 6px; align-items: baseline; font-size: 12px; color: var(--color-accent-2-700); margin: 7px 0 0; }
.warn i { font-size: 13px; flex: none; }

.actions { display: flex; gap: 10px; margin-top: 26px; }
.field-error, .form-error { font-size: 12.5px; color: var(--color-accent-2-700); margin-top: 6px; }
.form-error { font-size: 13px; }
</style>