<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import RbacBanner from '../components/RbacBanner.vue';
import { useRbacGroups } from '../queries';

const route = useRoute();
const groups = useRbacGroups();

const nameParam = computed(() => String(route.params.name ?? ''));
const group = computed(() => groups.data.value?.find((item) => item.name === nameParam.value));
const notFound = computed(() =>
    !groups.error.value && !groups.isPending.value && Boolean(groups.data.value) && !group.value,
);
</script>

<template>
    <div>
        <div class="head">
            <div>
                <h1 class="mono">{{ nameParam }}</h1>
                <p class="lede">Clients in this group inherit the access granted by every assigned role.</p>
            </div>
            <div class="head-actions">
                <RouterLink class="btn btn-secondary" to="/rbac/groups">
                    <i class="ph-duotone ph-arrow-left" />Back
                </RouterLink>
                <RouterLink v-if="group" class="btn btn-primary" :to="`/rbac/groups/${encodeURIComponent(nameParam)}/edit`">
                    <i class="ph-duotone ph-pencil-simple" />Edit group
                </RouterLink>
            </div>
        </div>

        <RbacBanner>
            This is a read-only view. Membership alone grants nothing; access comes from the roles assigned to the group.
        </RbacBanner>

        <p v-if="groups.isPending.value" class="loading" role="status">Loading group…</p>

        <p v-else-if="groups.error.value" class="form-error">{{ groups.error.value.message }}</p>

        <p v-else-if="notFound" class="form-error">
            Group “{{ nameParam }}” does not exist. <RouterLink to="/rbac/groups">Return to groups</RouterLink>.
        </p>

        <div v-else-if="group" class="details">
            <section>
                <div class="section-head">
                    <h2>Clients</h2>
                    <span class="tag tag-neutral">{{ group.clients.length }}</span>
                </div>
                <div v-if="group.clients.length" class="items">
                    <RouterLink
                        v-for="client in group.clients"
                        :key="client"
                        class="item mono"
                        :to="`/clients/${encodeURIComponent(client)}`"
                    >
                        <i class="ph-duotone ph-user" />{{ client }}
                    </RouterLink>
                </div>
                <p v-else class="empty">No clients belong to this group.</p>
            </section>

            <section>
                <div class="section-head">
                    <h2>Roles</h2>
                    <span class="tag tag-neutral">{{ group.roles.length }}</span>
                </div>
                <div v-if="group.roles.length" class="items">
                    <RouterLink
                        v-for="role in group.roles"
                        :key="role"
                        class="item mono"
                        :to="`/rbac/roles/${encodeURIComponent(role)}`"
                    >
                        <i class="ph-duotone ph-shield-check" />{{ role }}
                    </RouterLink>
                </div>
                <p v-else class="empty">No roles are assigned. This group grants no access.</p>
            </section>
        </div>
    </div>
</template>

<style scoped>
.head { display: flex; align-items: flex-end; gap: 24px; margin-bottom: 20px; }
.head > div:first-child { margin-right: auto; }
.head-actions { display: flex; gap: 10px; }

.details { max-width: 760px; display: grid; gap: 28px; }
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
}
</style>
