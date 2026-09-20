<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import RbacBanner from '../components/RbacBanner.vue';
import { describeAcl } from '../lib/rbac';
import { useRbacGroups, useRbacRoles } from '../queries';

const route = useRoute();
const roles = useRbacRoles();
const groups = useRbacGroups();

const nameParam = computed(() => String(route.params.name ?? ''));
const role = computed(() => roles.data.value?.find((item) => item.name === nameParam.value));
const roleGroups = computed(() =>
    groups.data.value?.filter((group) => group.roles.includes(nameParam.value)) ?? [],
);
const notFound = computed(() =>
    !roles.error.value && !roles.isPending.value && Boolean(roles.data.value) && !role.value,
);
</script>

<template>
    <div>
        <div class="head">
            <div>
                <h1 class="mono">{{ nameParam }}</h1>
                <p class="lede">ACLs and group bindings for this role.</p>
            </div>
            <div class="head-actions">
                <RouterLink class="btn btn-secondary" to="/rbac/roles">
                    <i class="ph-duotone ph-arrow-left" />Back
                </RouterLink>
                <RouterLink v-if="role" class="btn btn-primary" :to="`/rbac/roles/${encodeURIComponent(nameParam)}/edit`">
                    <i class="ph-duotone ph-pencil-simple" />Edit role
                </RouterLink>
            </div>
        </div>

        <RbacBanner>
            This is a read-only view. Groups bind clients to roles; the role itself never grants access directly.
        </RbacBanner>

        <p v-if="roles.isPending.value" class="loading" role="status">Loading role…</p>
        <p v-else-if="roles.error.value" class="form-error">{{ roles.error.value.message }}</p>
        <p v-else-if="notFound" class="form-error">
            Role “{{ nameParam }}” does not exist. <RouterLink to="/rbac/roles">Return to roles</RouterLink>.
        </p>

        <div v-else-if="role" class="details">
            <section>
                <div class="section-head">
                    <h2>ACLs</h2>
                    <span class="tag tag-neutral">{{ role.acls.length }}</span>
                </div>
                <div v-if="role.acls.length" class="items">
                    <div v-for="(acl, index) in role.acls" :key="index" class="item mono">
                        <i class="ph-duotone ph-shield-check" />{{ describeAcl(acl) }}
                    </div>
                </div>
                <p v-else class="empty">This role has no ACLs and grants no access.</p>
            </section>

            <section>
                <div class="section-head">
                    <h2>Groups granting this role</h2>
                    <span class="tag tag-neutral">{{ roleGroups.length }}</span>
                </div>
                <p v-if="groups.isPending.value" class="loading" role="status">Loading groups…</p>
                <p v-else-if="groups.error.value" class="form-error">{{ groups.error.value.message }}</p>
                <div v-else-if="roleGroups.length" class="items">
                    <RouterLink
                        v-for="group in roleGroups"
                        :key="group.name"
                        class="item mono"
                        :to="`/rbac/groups/${encodeURIComponent(group.name)}/`"
                    >
                        <i class="ph-duotone ph-users" />{{ group.name }}
                    </RouterLink>
                </div>
                <p v-else class="empty">No groups grant this role.</p>
            </section>
        </div>
    </div>
</template>

<style scoped>
.head { display: flex; align-items: flex-end; gap: 24px; margin-bottom: 20px; }
.head > div:first-child { margin-right: auto; }
.head-actions { display: flex; gap: 10px; }

.details { max-width: 860px; display: grid; gap: 28px; }
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
