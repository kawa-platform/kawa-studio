<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useRbacGroups } from '../rbac/queries';
import { useClients } from './queries';

const route = useRoute();
const clients = useClients();
const groups = useRbacGroups();

const nameParam = computed(() => String(route.params.name ?? ''));
const client = computed(() =>
    clients.data.value?.find((item) => item.username === nameParam.value),
);
const clientGroups = computed(() =>
    groups.data.value?.filter((group) => group.clients.includes(nameParam.value)) ?? [],
);
const notFound = computed(() =>
    !clients.error.value && !clients.isPending.value && Boolean(clients.data.value) && !client.value,
);
</script>

<template>
    <div>
        <div class="head">
            <div>
                <h1 class="mono">{{ nameParam }}</h1>
                <p class="lede">Authentication settings and RBAC group memberships for this client.</p>
            </div>
            <div class="head-actions">
                <RouterLink class="btn btn-secondary" to="/clients">
                    <i class="ph-duotone ph-arrow-left" />Back
                </RouterLink>
                <RouterLink v-if="client" class="btn btn-primary" :to="`/clients/${encodeURIComponent(nameParam)}/edit`">
                    <i class="ph-duotone ph-pencil-simple" />Edit client
                </RouterLink>
            </div>
        </div>

        <p v-if="clients.isPending.value" class="loading" role="status">Loading client…</p>
        <p v-else-if="clients.error.value" class="form-error">{{ clients.error.value.message }}</p>
        <p v-else-if="notFound" class="form-error">
            Client “{{ nameParam }}” does not exist. <RouterLink to="/clients">Return to clients</RouterLink>.
        </p>

        <div v-else-if="client" class="details">
            <section class="summary">
                <div>
                    <span class="label">Mechanism</span>
                    <span class="tag tag-neutral">{{ client.mechanism }}</span>
                </div>
                <div>
                    <span class="label">Groups</span>
                    <span class="tag tag-neutral">{{ clientGroups.length }}</span>
                </div>
            </section>

            <section>
                <div class="section-head">
                    <h2>RBAC groups</h2>
                    <span class="tag tag-neutral">{{ clientGroups.length }}</span>
                </div>
                <p v-if="groups.isPending.value" class="loading" role="status">Loading groups…</p>
                <p v-else-if="groups.error.value" class="form-error">{{ groups.error.value.message }}</p>
                <div v-else-if="clientGroups.length" class="items">
                    <RouterLink
                        v-for="group in clientGroups"
                        :key="group.name"
                        class="item mono"
                        :to="`/rbac/groups/${encodeURIComponent(group.name)}/`"
                    >
                        <i class="ph-duotone ph-users" />{{ group.name }}
                    </RouterLink>
                </div>
                <p v-else class="empty">This client does not belong to any groups.</p>
            </section>
        </div>
    </div>
</template>

<style scoped>
.head { display: flex; align-items: flex-end; gap: 24px; margin-bottom: 20px; }
.head > div:first-child { margin-right: auto; }
.head-actions { display: flex; gap: 10px; }

.details { max-width: 760px; display: grid; gap: 28px; }
.summary { display: flex; gap: 42px; padding: 18px 20px; border: 1px solid var(--chrome-line); border-radius: var(--radius-md); }
.summary > div { display: flex; flex-direction: column; gap: 7px; }
.label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
.section-head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.section-head h2 { font-size: 18px; margin: 0; }
.section-head .tag { font-size: 10.5px; }

.items { display: flex; flex-direction: column; border: 1px solid var(--chrome-line); border-radius: var(--radius-md); overflow: hidden; }
.item { display: flex; align-items: center; gap: 9px; min-width: 0; padding: 11px 13px; color: inherit; font-size: 12.5px; overflow-wrap: anywhere; text-decoration: none; }
.item + .item { border-top: 1px solid var(--chrome-line); }
.item:hover { background: color-mix(in srgb, var(--color-accent) 6%, transparent); }
.item i { color: var(--color-accent-700); font-size: 15px; }

.empty { margin: 0; padding: 20px; font-size: 13px; color: var(--muted); border: 1px dashed var(--chrome-line); border-radius: var(--radius-md); }
.loading { font-size: 13px; color: var(--muted); }
.form-error { font-size: 13px; color: var(--color-accent-2-700); }
.head h1 { overflow-wrap: anywhere; }

@media (max-width: 680px) {
    .head { align-items: flex-start; flex-direction: column; }
    .head-actions { width: 100%; flex-wrap: wrap; }
    .summary { gap: 24px; flex-wrap: wrap; }
}
</style>
