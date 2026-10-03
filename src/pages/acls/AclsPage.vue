<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { useApi } from '@/api/api';
import { ApiError } from '@/api/error';
import type { Acl, CreateAclRequest, PermissionType, ResourceType } from '@/api/types';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import { keys } from '@/queries/keys';

const api = useApi();
const principal = ref('');
const resource = ref('');

const { data: aclsData, refetch: reload } = useQuery({ queryKey: keys.acls(), queryFn: () => api.listAcls() });
const acls = computed(() => aclsData.value ?? []);

/// Filtering is client-side for responsiveness; the endpoint accepts the same two
/// parameters when the rule count outgrows one page.
const shown = computed(() => {
    const p = principal.value.trim().toLowerCase();
    const r = resource.value.trim().toLowerCase();
    return acls.value.filter((a) =>
        (!p || a.principal.toLowerCase().includes(p))
        && (!r || a.resourceName.toLowerCase().includes(r)));
});

const RESOURCE_TYPES: ResourceType[] = ['topic', 'group', 'cluster'];
const OPERATIONS = ['READ', 'WRITE', 'DESCRIBE', 'CREATE', 'DELETE'];
const PERMISSIONS: PermissionType[] = ['allow', 'deny'];

const kind = ref<'create' | 'delete' | null>(null);
const target = ref<Acl | null>(null);
const pending = ref(false);
const errors = ref<Record<string, string>>({});

const blank = (): CreateAclRequest => ({
    principal: '',
    resourceType: 'topic',
    resourceName: '',
    operation: 'READ',
    permissionType: 'allow',
    host: '*',
});

const form = ref<CreateAclRequest>(blank());

const open = computed({
    get: () => kind.value !== null,
    set: (value: boolean) => { if (!value) kind.value = null; },
});

watch(() => form.value.resourceType, (type) => {
    if (type === 'cluster' && !form.value.resourceName) form.value.resourceName = 'kafka-prod';
});

const openCreate = (): void => {
    form.value = blank();
    errors.value = {};
    kind.value = 'create';
};

const openDelete = (acl: Acl): void => {
    target.value = acl;
    errors.value = {};
    kind.value = 'delete';
};

const submit = async (): Promise<void> => {
    pending.value = true;
    try {
        if (kind.value === 'create') {
            const found: Record<string, string> = {};
            if (!form.value.principal) found.principal = 'Principal is required.';
            if (!form.value.resourceName) found.resourceName = 'Resource name is required.';
            errors.value = found;
            if (Object.keys(found).length) return;
            await api.createAcl({ ...form.value });
        } else if (target.value) {
            await api.deleteAcl(target.value.id);
        }
        kind.value = null;
        await reload();
    } catch (cause) {
        if (cause instanceof ApiError && cause.field) errors.value = { [cause.field]: cause.message };
        else errors.value = { form: cause instanceof ApiError ? cause.message : 'Request failed.' };
    } finally {
        pending.value = false;
    }
};

const deleteBody = computed(() => {
    const a = target.value;
    if (!a) return '';
    return a.principal + ' → ' + a.operation + ' on ' + a.resourceType + ' ' + a.resourceName
        + '. Access is revoked on the next request.';
});
</script>

<template>
    <div>
        <div class="head">
            <div>
                <h1>ACLs</h1>
                <p class="lede">
                    Rules are evaluated by the gateway before a request reaches Kafka. Deny wins over allow.
                </p>
            </div>
            <button class="btn btn-primary" @click="openCreate">
                <i class="ph-duotone ph-shield-check" />New ACL
            </button>
        </div>

        <div class="filters">
            <input v-model="principal" class="input" placeholder="Principal…" aria-label="Filter by principal">
            <input v-model="resource" class="input" placeholder="Resource…" aria-label="Filter by resource">
            <span class="count muted">{{ shown.length }} of {{ acls.length }} rules</span>
        </div>

        <div class="table-scroll">
            <table class="table" style="min-width: 900px">
                <thead>
                    <tr>
                        <th style="width: 20%">Principal</th>
                        <th style="width: 11%">Resource type</th>
                        <th style="width: 24%">Resource</th>
                        <th style="width: 12%">Operation</th>
                        <th style="width: 11%">Permission</th>
                        <th style="width: 12%">Host</th>
                        <th style="width: 10%" />
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="acl in shown" :key="acl.id">
                        <td class="mono cell">{{ acl.principal }}</td>
                        <td class="muted">{{ acl.resourceType }}</td>
                        <td class="mono cell">{{ acl.resourceName }}</td>
                        <td>{{ acl.operation }}</td>
                        <td>
                            <span
                                class="tag"
                                :class="acl.permissionType === 'deny' ? 'tag-accent-2' : 'tag-neutral'"
                            >{{ acl.permissionType }}</span>
                        </td>
                        <td class="mono host muted">{{ acl.host }}</td>
                        <td class="actions">
                            <button class="btn btn-ghost btn-danger" @click="openDelete(acl)">Delete</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div v-if="!shown.length" class="empty">
            <h4>No ACLs match that filter</h4>
            <p class="muted">Clear the principal and resource filters, or create a rule for this principal.</p>
        </div>

        <ConfirmDialog
            v-model:open="open"
            :title="kind === 'create' ? 'New ACL' : 'Delete this rule?'"
            :body="kind === 'create' ? 'Rules apply at the gateway. A deny rule beats any allow rule for the same principal.' : deleteBody"
            :confirm-label="kind === 'create' ? 'Create ACL' : 'Delete ACL'"
            :danger="kind === 'delete'"
            :pending="pending"
            @confirm="submit"
        >
            <template v-if="kind === 'create'">
                <div class="field">
                    <label for="acl-principal">Principal</label>
                    <input id="acl-principal" v-model="form.principal" class="input" placeholder="svc-invoices">
                    <div v-if="errors.principal" class="field-error">{{ errors.principal }}</div>
                </div>
                <div class="field">
                    <label for="acl-type">Resource type</label>
                    <select id="acl-type" v-model="form.resourceType" class="input">
                        <option v-for="t in RESOURCE_TYPES" :key="t" :value="t">{{ t }}</option>
                    </select>
                </div>
                <div class="field">
                    <label for="acl-resource">Resource name</label>
                    <input id="acl-resource" v-model="form.resourceName" class="input" placeholder="orders* — wildcards allowed">
                    <div v-if="errors.resourceName" class="field-error">{{ errors.resourceName }}</div>
                </div>
                <div class="field">
                    <label for="acl-op">Operation</label>
                    <select id="acl-op" v-model="form.operation" class="input">
                        <option v-for="o in OPERATIONS" :key="o" :value="o">{{ o }}</option>
                    </select>
                </div>
                <div class="field">
                    <label for="acl-perm">Permission</label>
                    <select id="acl-perm" v-model="form.permissionType" class="input">
                        <option v-for="p in PERMISSIONS" :key="p" :value="p">{{ p }}</option>
                    </select>
                </div>
                <div class="field">
                    <label for="acl-host">Host</label>
                    <input id="acl-host" v-model="form.host" class="input" placeholder="* or CIDR">
                </div>
                <p v-if="errors.form" class="field-error">{{ errors.form }}</p>
            </template>
        </ConfirmDialog>
    </div>
</template>

<style scoped>
.head { display: flex; align-items: flex-end; gap: 24px; margin-bottom: 20px; }
.head > div { margin-right: auto; }
.filters { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-bottom: 6px; }
.filters .input { width: 205px; font-size: 13px; }
.count { font-size: 12px; margin-left: auto; }
.host { font-size: 12px; }
.actions { text-align: right; }
.actions .btn { font-size: 12.5px; }
.empty { padding: 48px 0 20px; max-width: 48ch; }
.empty h4 { margin: 0 0 6px; }
.empty p { font-size: 13px; }
.field-error { font-size: 12px; color: var(--color-accent-2-700); margin-top: 4px; }
</style>
