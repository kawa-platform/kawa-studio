<script setup lang="ts">
import {computed, ref} from 'vue';
import {useRouter} from 'vue-router';
import {ApiError} from '@/api/types';
import {validateCreateUser} from './lib/clients';
import {useCreateClient} from "@/pages/clients/queries";
import {useRbacGroups} from '@/pages/rbac/queries';
import SuggestionInput from '@/pages/rbac/components/SuggestionInput.vue';

const router = useRouter();

const MECHANISMS = ['PLAIN', 'SCRAM-SHA-256', 'SCRAM-SHA-512'];

const username = ref('');
const mechanism = ref('PLAIN');
const password = ref('');
const selectedGroups = ref<string[]>([]);
const errors = ref<Record<string, string>>({});
const serverError = ref<string | null>(null);
const pending = ref(false);
const createClient = useCreateClient();
const groups = useRbacGroups();
const groupSuggestions = computed(() => (groups.data.value ?? []).map((group) => group.name));

const submit = async (): Promise<void> => {
  serverError.value = null;
  const found = validateCreateUser({username: username.value, password: password.value});
  errors.value = found;
  if (Object.keys(found).length > 0) return;
  pending.value = true;
  try {
    await createClient.mutateAsync(
        {
          username: username.value.trim(),
          req: {
            mechanism: mechanism.value,
            password: password.value,
            groups: selectedGroups.value,
          },
        })
    void router.push('/clients');
  } catch (cause) {
    if (cause instanceof ApiError && cause.field) errors.value = {[cause.field]: cause.message};
    else serverError.value = cause instanceof ApiError ? cause.message : 'Request failed.';
  } finally {
    pending.value = false;
  }
};
</script>

<template>
  <div class="wrap">
    <div class="head">
      <h1>New client</h1>
      <p class="lede">
        A SASL principal the gateway authenticates. Credentials are held by kawa, not by the upstream
        cluster. The password is sent once and stored hashed by the gateway; it is never returned by the API.
      </p>
    </div>

    <section>
      <h2>1 · Identity</h2>
      <div class="field">
        <label for="username">Client name</label>
        <input
            id="username"
            v-model="username"
            class="input mono"
            placeholder="svc-invoices"
            autocomplete="off"
        >
        <p v-if="errors.username" class="field-error">{{ errors.username }}</p>
        <p v-else class="hint">The principal clients authenticate with. Must be unique across all clients.</p>
      </div>
    </section>

    <section>
      <h2>2 · Credentials</h2>
      <div class="field">
        <label for="mechanism">Mechanism</label>
        <select id="mechanism" v-model="mechanism" class="input">
          <option v-for="m in MECHANISMS" :key="m" :value="m">{{ m }}</option>
        </select>
        <p class="hint">The SASL mechanism the principal uses. SCRAM variants never put the password on the wire in the
          clear.</p>
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input
            id="password"
            v-model="password"
            class="input"
            type="password"
            autocomplete="new-password"
        >
        <p v-if="errors.password" class="field-error">{{ errors.password }}</p>
        <p v-else class="hint">At least 12 characters. Sent once on creation, then kept only as a hash by the
          gateway.</p>
      </div>
    </section>

    <section>
      <h2>3 · Groups</h2>
      <p class="hint section-hint">Choose the RBAC groups this client should belong to. Group roles grant the client its effective access.</p>
      <p v-if="groups.isPending.value" class="hint">Loading groups…</p>
      <p v-else-if="groups.error.value" class="field-error">Could not load groups: {{ groups.error.value.message }}</p>
      <SuggestionInput
          v-else-if="groups.data.value?.length"
          v-model="selectedGroups"
          :suggestions="groupSuggestions"
          placeholder="Add a group — e.g. producers"
          :allow-new="false"
      />
      <p v-else class="hint">No groups have been configured yet.</p>
    </section>

    <div class="actions">
      <button class="btn btn-primary" :disabled="pending || groups.isPending.value || !!groups.error.value" @click="submit">
        <i class="ph-duotone ph-user-plus"/>
        {{ pending ? 'Creating…' : 'Create client' }}
      </button>
      <button class="btn btn-secondary" @click="router.push('/clients')">Cancel</button>
    </div>

    <p v-if="serverError" class="error">{{ serverError }}</p>
  </div>
</template>

<style scoped>
.wrap {
  max-width: 640px;
}

.head {
  margin-bottom: 22px;
}

section {
  margin-bottom: 30px;
}

h2 {
  font-family: var(--font-heading);
  font-size: 15px;
  margin: 0 0 14px;
  padding-left: 10px;
  box-shadow: inset 3px 0 0 var(--brand);
}

.field {
  margin-bottom: 18px;
}

.hint {
  margin: 7px 0 0;
}

.section-hint { margin: -4px 0 13px; }

.field-error {
  font-size: 11.5px;
  color: var(--error);
  margin: 7px 0 0;
}

.actions {
  display: flex;
  gap: 8px;
}

.error {
  color: var(--error);
  margin-top: 14px;
}
</style>
