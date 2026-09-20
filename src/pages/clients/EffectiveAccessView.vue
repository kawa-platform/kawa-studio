<script setup lang="ts">
import { computed, ref } from 'vue';
import type { SelectItem } from '../publish/components/SearchSelect.vue';
import SearchSelect from '../publish/components/SearchSelect.vue';
import { describeAcl, effectiveAclsOfUser, groupsOfUser, missingRoleRefs, orphanRoles } from '../rbac/lib/rbac';
import RbacBanner from '../rbac/components/RbacBanner.vue';
import { useRbacAuthClients, useRbacGroups, useRbacRoles } from '../rbac/queries';

const roles = useRbacRoles();
const groups = useRbacGroups();
const authClients = useRbacAuthClients();

const selected = ref('');

/// The gateway's client store: every SASL principal configured under /auth/clients.
const known = computed(() => new Set((authClients.data.value ?? []).map((user) => user.username)));

/// The scrollable set: the client store plus every name mentioned in a group, since a
/// group can reference a client that does not exist yet.
const selectableUsers = computed(() => {
    const names = new Set(known.value);
    for (const group of groups.data.value ?? []) {
        for (const client of group.clients) names.add(client);
    }
    return [...names].sort();
});

const items = computed<SelectItem[]>(() =>
    selectableUsers.value.map((name) => {
        const memberships = groupsOfUser(groups.data.value ?? [], name);
        const effective = effectiveAclsOfUser(roles.data.value ?? [], groups.data.value ?? [], name);
        return {
            value: name,
            tag: known.value.has(name) ? 'in store' : 'group client only',
            tagAccent: !known.value.has(name),
            hint: `${memberships.length} · ${new Set(effective.map((entry) => entry.role)).size}`,
        };
    }),
);

const userGroups = computed(() => (selected.value ? groupsOfUser(groups.data.value ?? [], selected.value) : []));

const effective = computed(() =>
    selected.value
        ? effectiveAclsOfUser(roles.data.value ?? [], groups.data.value ?? [], selected.value)
        : [],
);

const boundRoles = computed(() => [...new Set(effective.value.map((entry) => entry.role))]);

const unrouted = computed(() => orphanRoles(roles.data.value ?? [], groups.data.value ?? []));
const dangling = computed(() => missingRoleRefs(groups.data.value ?? [], roles.data.value ?? []));

const missingClients = computed(() =>
    groups.data.value
        ?.flatMap((group) => group.clients)
        .filter((client) => !known.value.has(client)) ?? [],
);
</script>

<template>
    <div>
        <RbacBanner>
            The gateway enforces <strong>default-deny</strong>: without an ALLOW here the request fails, and a
            single <strong>DENY</strong> beats every ALLOW that matches. This screen reflects the config as last
            persisted — the running gateway applies it asynchronously.
        </RbacBanner>

        <p v-if="roles.error.value" class="form-error">{{ roles.error.value.message }}</p>
        <p v-if="groups.error.value" class="form-error">{{ groups.error.value.message }}</p>

        <p v-if="!selectableUsers.length" class="empty">
            No clients to inspect. Create clients on the Clients screen, then bind them through groups.
        </p>

        <template v-else>
            <div v-if="missingClients.length" class="picker-note">
                <i class="ph-duotone ph-warning" />
                {{ missingClients.length }} client{{ missingClients.length === 1 ? '' : 's' }} of a group
                {{ missingClients.length === 1 ? 'is' : 'are' }} not in the gateway's client store.
            </div>

            <SearchSelect v-model="selected" :items="items" label="Client" placeholder="Search clients…" />
            <p class="hint">Pick a client to resolve their roles and ACLs.</p>

            <div v-if="selected">
                <div class="stats">
                <div class="stat">
                    <div class="stat-value">{{ userGroups.length }}</div>
                    <div class="stat-label">groups</div>
                </div>
                <div class="stat">
                    <div class="stat-value">{{ boundRoles.length }}</div>
                    <div class="stat-label">roles</div>
                </div>
                <div class="stat">
                    <div class="stat-value">{{ effective.length }}</div>
                    <div class="stat-label">ACLs</div>
                </div>
            </div>

            <div v-if="userGroups.length" class="group-chips">
                <span v-for="group in userGroups" :key="group.name" class="tag tag-neutral"><i class="ph-duotone ph-users-three" />{{ group.name }}</span>
            </div>

            <h2 class="section-title">Effective ACLs</h2>
            <div class="table-scroll">
                <table class="table" style="min-width: 720px">
                    <thead>
                        <tr>
                            <th>Access</th>
                            <th>Permission</th>
                            <th>Granted by role</th>
                            <th>Through groups</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(entry, index) in effective" :key="index">
                            <td class="mono cell">{{ describeAcl(entry.acl) }}</td>
                            <td>
                                <span class="tag" :class="(entry.acl.permission ?? 'ALLOW') === 'ALLOW' ? 'tag-accent' : 'tag-accent-2'">
                                    {{ entry.acl.permission ?? 'ALLOW' }}
                                </span>
                            </td>
                            <td class="mono cell">{{ entry.role }}</td>
                            <td>
                                <span v-for="group in entry.groups" :key="group" class="tag tag-neutral bound-tag">{{ group }}</span>
                            </td>
                        </tr>
                        <tr v-if="!effective.length">
                            <td colspan="4" class="faint">
                                {{ selected }} has no effective grants — every request they make is denied.
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <h2 class="section-title">Hygiene</h2>
            <div v-if="!unrouted.length && !dangling.length" class="ok-note">
                <i class="ph-duotone ph-check-circle" />No orphaned roles or dangling references.
            </div>
            <ul v-else class="issues">
                <li v-for="role in unrouted" :key="role.name">
                    <span class="tag tag-accent-2">unrouted</span>
                    Role <span class="mono">{{ role.name }}</span> is defined but no group binds it —
                    <RouterLink :to="`/rbac/groups/new`">bind it</RouterLink> before it grants anything.
                </li>
                <li v-for="entry in dangling" :key="entry.name">
                    <span class="tag tag-accent-2">dangling</span>
                    Group <span class="mono">{{ entry.name }}</span> references
                    <span class="mono">{{ entry.missing.join(', ') }}</span>, which {{ entry.missing.length === 1 ? 'has' : 'have' }}
                    no role config —
                    <RouterLink :to="`/rbac/roles/${encodeURIComponent(entry.missing[0] ?? '')}/edit`">create it</RouterLink>.
                </li>
            </ul>
            </div>
        </template>
    </div>
</template>

<style scoped>
.picker-note { display: flex; gap: 6px; align-items: center; font-size: 12px; color: var(--color-accent-2-700); }
.picker-note i { font-size: 13px; }
.hint { font-size: 12.5px; color: var(--muted); margin: 8px 0 4px; }

.stats { display: flex; gap: 34px; margin: 6px 0 14px; }
.stat { min-width: 64px; }
.stat-value { font-family: var(--font-heading); font-weight: 600; font-size: 22px; font-variant-numeric: tabular-nums; line-height: 1.1; }
.stat-label { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin-top: 2px; }

.group-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 18px; }
.group-chips .tag { gap: 6px; }
.group-chips .tag i { font-size: 13px; }

.section-title { font-size: 18px; margin: 24px 0 12px; }
.cell { font-size: 12.5px; white-space: normal; }
.bound-tag { margin-right: 4px; font-size: 10.5px; }

.empty, .ok-note { padding: 20px; font-size: 13px; color: var(--muted); border: 1px dashed var(--chrome-line); border-radius: var(--radius-md); }
.ok-note { display: flex; gap: 7px; align-items: center; border-style: solid; }
.ok-note i { color: var(--color-accent-700); font-size: 15px; }

.issues { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.issues li { display: flex; align-items: center; gap: 7px; font-size: 13px; flex-wrap: wrap; }
.issues .tag { font-size: 10.5px; }
.form-error { font-size: 13px; color: var(--color-accent-2-700); }
</style>