<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { changesOf, errorsOf, validateCreate, validateEmail } from './lib/adminUsers';
import { useAdminUsers, useCreateAdminUser, useUpdateAdminUser } from './queries';

const route = useRoute();
const router = useRouter();

/// /admin/users/:id/edit edits an existing admin user; no id = create.
const idParam = computed(() => String(route.params.id ?? ''));
const isNew = computed(() => !idParam.value);

const users = useAdminUsers();
const create = useCreateAdminUser();
const update = useUpdateAdminUser();

const draft = ref({ email: '', displayName: '', password: '', confirmPassword: '' });
const errors = ref<Record<string, string>>({});
const pending = ref(false);

const existing = computed(() =>
    idParam.value ? users.data.value?.find((user) => user.id === idParam.value) : undefined,
);
const notFound = computed(() =>
    !isNew.value && !users.isPending.value && !!users.data.value && !existing.value,
);

/// The draft fills in once the list arrives. It never holds a password for an existing user:
/// the gateway does not return one, and an edit leaves it alone.
watch(
    existing,
    (user) => {
        if (user) draft.value = { email: user.email, displayName: user.displayName ?? '', password: '', confirmPassword: '' };
    },
    { immediate: true },
);

const submit = async (): Promise<void> => {
    const found = isNew.value ? validateCreate(draft.value) : emailErrors();
    errors.value = found;
    if (Object.keys(found).length) return;
    pending.value = true;
    try {
        if (isNew.value) {
            const displayName = draft.value.displayName.trim();
            await create.mutateAsync({
                email: draft.value.email.trim(),
                password: draft.value.password,
                ...(displayName ? { displayName } : {}),
            });
        } else if (existing.value) {
            const body = changesOf(existing.value, draft.value);
            if (Object.keys(body).length) await update.mutateAsync({ id: existing.value.id, body });
        }
        void router.push('/admin/users');
    } catch (cause) {
        errors.value = errorsOf(cause);
    } finally {
        // The password is sent once; it is not kept in the form after a submit.
        draft.value = { ...draft.value, password: '', confirmPassword: '' };
        pending.value = false;
    }
};

const emailErrors = (): Record<string, string> => {
    const emailError = validateEmail(draft.value.email);
    return emailError ? { email: emailError } : {};
};
</script>

<template>
    <div class="form">
        <div class="head">
            <h1>{{ isNew ? 'New admin user' : `Edit “${existing?.email ?? ''}”` }}</h1>
            <p class="lede">
                An account that signs in to the admin console and the admin API. The email is the login name; the
                password is sent once and kept only as a hash by the gateway.
            </p>
        </div>

        <p v-if="users.error.value && !isNew" class="error" role="alert">
            Could not load admin users: {{ users.error.value.message }}
        </p>
        <p v-else-if="notFound" class="error">
            This admin user does not exist. <RouterLink to="/admin/users">Back to admin users</RouterLink>
        </p>
        <p v-else-if="!isNew && users.isPending.value" class="muted">Loading…</p>

        <template v-else>
            <section>
                <h2>1 · Identity</h2>
                <div class="row">
                    <div class="field">
                        <label for="email">Email</label>
                        <input id="email" v-model="draft.email" class="input mono" type="email" placeholder="ops@example.com" autocomplete="off">
                        <p v-if="errors.email" class="field-error">{{ errors.email }}</p>
                        <p v-else class="hint">The login name. Stored in lower case; unique across admin users.</p>
                    </div>
                    <div class="field">
                        <label for="display-name">Display name</label>
                        <input id="display-name" v-model="draft.displayName" class="input" placeholder="Optional" autocomplete="off">
                        <p class="hint">Tells admin users apart. Leave empty to clear.</p>
                    </div>
                </div>
            </section>

            <section v-if="isNew">
                <h2>2 · Password</h2>
                <div class="row">
                    <div class="field">
                        <label for="password">Password</label>
                        <input id="password" v-model="draft.password" class="input" type="password" autocomplete="new-password">
                        <p v-if="errors.password" class="field-error">{{ errors.password }}</p>
                    </div>
                    <div class="field">
                        <label for="confirm-password">Confirm password</label>
                        <input id="confirm-password" v-model="draft.confirmPassword" class="input" type="password" autocomplete="new-password">
                        <p v-if="errors.confirmPassword" class="field-error">{{ errors.confirmPassword }}</p>
                    </div>
                </div>
                <p class="hint">Write-only: it is never shown again. Change it later from the admin users list.</p>
            </section>
            <p v-else class="hint password-note">
                Saving leaves the password and the enabled state unchanged. Change those from the admin users list.
            </p>

            <div class="actions">
                <button class="btn btn-primary" :disabled="pending" @click="submit">
                    <i :class="['ph-duotone', isNew ? 'ph-user-plus' : 'ph-floppy-disk']" />
                    {{ pending ? 'Saving…' : isNew ? 'Create admin user' : 'Save changes' }}
                </button>
                <button class="btn btn-secondary" @click="router.push('/admin/users')">Cancel</button>
            </div>

            <p v-if="errors.form" class="error" role="alert">{{ errors.form }}</p>
        </template>
    </div>
</template>

<style scoped>
.password-note { margin: -8px 0 22px; }
</style>
