<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { RbacAclConfig } from '@/api/types';
import AppToast from '@/components/AppToast.vue';
import AclEditor from '../components/AclEditor.vue';
import RbacBanner from '../components/RbacBanner.vue';
import { broadAccessAcls, validateAcl } from '../lib/rbac';
import { useRbacRoles, useUpsertRbacRole } from '../queries';

const route = useRoute();
const router = useRouter();

/// /rbac/roles/:name/edit carries the decoded name already (the router decodes route params);
/// this page treats any non-empty param as an edit, no name = create.
const nameParam = computed(() => String(route.params.name ?? ''));

const roles = useRbacRoles();
const upsert = useUpsertRbacRole();

const draft = ref<{name: string; acls: RbacAclConfig[]}>({name: '', acls: []});
const errors = ref<Record<string, string>>({});
const toast = ref<{ok: boolean; text: string} | null>(null);
const toastOpen = computed({
    get: () => toast.value !== null,
    set: (v: boolean) => { if (!v) toast.value = null; },
});

const existing = computed(() =>
    nameParam.value ? roles.data.value?.find((role) => role.name === nameParam.value) : undefined,
);
const notFound = computed(() =>
    Boolean(nameParam.value) && !roles.isPending.value && roles.data.value && !existing.value,
);
const isNew = computed(() => !nameParam.value);

const cloneAcls = (acls: RbacAclConfig[]): RbacAclConfig[] =>
    acls.map((acl) => ({...acl, resource: {...acl.resource}}));

/// Draft starts empty (new role) and fills in once the role list arrives (edit). A missing
/// role after load leaves the draft untouched — the not-found view takes over.
watch(
    () => [isNew.value, existing.value] as const,
    () => {
        if (isNew.value) {
            draft.value = {name: '', acls: []};
            return;
        }
        const edit = existing.value;
        if (edit) draft.value = {name: edit.name, acls: cloneAcls(edit.acls)};
    },
    {immediate: true},
);

const addBroadAccess = (): void => {
    const keys = new Set(draft.value.acls.map((acl) => JSON.stringify(acl)));
    const fresh = broadAccessAcls().filter((acl) => !keys.has(JSON.stringify(acl)));
    draft.value = {...draft.value, acls: [...draft.value.acls, ...fresh]};
};

const save = async (): Promise<void> => {
    errors.value = {};
    const name = draft.value.name.trim();
    if (!name) {
        errors.value.name = 'Give the role a name.';
        return;
    }
    const aclErrors = draft.value.acls
        .flatMap((acl, index) => validateAcl(acl).map((message) => `ACL ${index + 1}: ${message}`));
    if (aclErrors.length) {
        const first = aclErrors[0];
        if (first) errors.value.acls = first;
        return;
    }
    try {
        await upsert.mutateAsync({name, body: {acls: draft.value.acls}});
        toast.value = {ok: true, text: `Role "${name}" persisted — the gateway applies it shortly.`};
        await router.push('/rbac/roles');
    } catch (cause) {
        errors.value.form = cause instanceof Error ? cause.message : 'Could not save the role.';
    }
};
</script>

<template>
    <div class="form">
        <div class="head">
            <h1>{{ isNew ? 'New role' : `Edit “${nameParam}”` }}</h1>
            <p class="lede">
                Under kawa the role is the ACL unit: a named set of allow/deny rules, each scoped to a topic,
                group, transactional id, or the whole cluster. Clients are never bound to a role directly — a group holds
                that link.
            </p>
        </div>

        <RbacBanner tone="warn">
            A <strong>DENY wins</strong> over any ALLOW, and access stays <strong>denied by default</strong>
            for anything a role does not touch. A role with no ACLs grants nothing.
        </RbacBanner>

        <p v-if="notFound" class="error">
            Role “{{ nameParam }}” does not exist. <RouterLink to="/rbac/roles/new">Create a new role</RouterLink> instead.
        </p>

        <p v-if="roles.error.value" class="error">{{ roles.error.value.message }}</p>

        <form v-else-if="!notFound" @submit.prevent="save">
            <section>
                <h2>1 · Identity</h2>
                <div class="field">
                    <label for="role-name">Role name</label>
                    <input
                        id="role-name"
                        v-model="draft.name"
                        class="input mono"
                        placeholder="e.g. orders-reader"
                        :disabled="!isNew"
                        @input="errors.name = ''"
                    >
                    <p v-if="!isNew" class="hint">Renaming is not supported — the name keys the config API.</p>
                    <p v-if="errors.name" class="field-error">{{ errors.name }}</p>
                </div>
            </section>

            <section>
                <h2>2 · ACLs</h2>
                <AclEditor v-model="draft.acls" />
                <button type="button" class="btn btn-ghost helper" @click="addBroadAccess">
                    <i class="ph-duotone ph-magic-wand" />Add common allow-all ACLs
                </button>
                <p v-if="errors.acls" class="field-error">{{ errors.acls }}</p>
            </section>

            <div class="actions">
                <button type="submit" class="btn btn-primary" :disabled="upsert.isPending.value">
                    <i class="ph-duotone ph-check" />{{ isNew ? 'Create role' : 'Save changes' }}
                </button>
                <RouterLink class="btn btn-secondary" to="/rbac/roles">Cancel</RouterLink>
            </div>

            <p v-if="errors.form" class="error">{{ errors.form }}</p>
        </form>

        <AppToast v-model:open="toastOpen" :ok="toast?.ok ?? true" :text="toast?.text ?? ''" />
    </div>
</template>

<style scoped>
.helper { margin-top: 10px; font-size: 12px; color: var(--color-accent-700); }
</style>