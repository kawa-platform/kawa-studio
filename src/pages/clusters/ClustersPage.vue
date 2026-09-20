<script setup lang="ts">
import { computed, h, ref } from 'vue';
import { useRouter } from 'vue-router';
import { createColumnHelper } from '@tanstack/vue-table';
import type { TopicAlias, VirtualCluster } from '@/api/types';
import { useDeleteVirtualTopic, useClusters } from './queries';
import DataTable from '@/components/DataTable.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';

const router = useRouter();
const { data, isPending, error } = useClusters();
const remove = useDeleteVirtualTopic();

const aliases = computed<TopicAlias[]>(() => data.value?.aliases ?? []);
const clusters = computed<VirtualCluster[]>(() => data.value?.clusters ?? []);

const stats = computed(() => [
    { label: 'Virtual topics', value: aliases.value.length },
    { label: 'Physical topics', value: new Set(aliases.value.map((a) => a.physical)).size },
    { label: 'With filters', value: aliases.value.filter((a) => a.filter).length },
    { label: 'Clusters', value: clusters.value.length },
]);

const pendingDelete = ref<TopicAlias | null>(null);
const confirmOpen = ref(false);

const askDelete = (alias: TopicAlias): void => {
    pendingDelete.value = alias;
    confirmOpen.value = true;
};

const confirmDelete = async (): Promise<void> => {
    if (!pendingDelete.value) return;
    await remove.mutateAsync(pendingDelete.value.name);
    confirmOpen.value = false;
    pendingDelete.value = null;
};

const alias = createColumnHelper<TopicAlias>();
const aliasColumns = [
    alias.accessor('name', {
        header: 'Virtual name',
        meta: { width: '28%' },
        cell: (info) => h('span', { class: 'mono strong' }, info.getValue()),
    }),
    alias.accessor('physical', {
        header: 'Physical topic',
        meta: { width: '26%' },
        cell: (info) => h('span', { class: 'mono muted' }, '→ ' + info.getValue()),
    }),
    alias.accessor((row) => row.filter?.expression ?? '', {
        id: 'filter',
        header: 'Read filter',
        meta: { width: '32%' },
        cell: (info) => info.getValue()
            ? h('code', { class: 'expr' }, info.getValue() as string)
            : h('span', { class: 'faint' }, 'no filter'),
    }),
    alias.accessor('cluster', {
        header: 'Cluster',
        meta: { width: '10%' },
        cell: (info) => h('span', { class: 'mono muted small' }, info.getValue()),
    }),
    alias.display({
        id: 'actions',
        header: '',
        enableSorting: false,
        meta: { width: '4%' },
        cell: (info) => h('button', {
            class: 'btn btn-ghost btn-icon',
            title: 'Delete ' + info.row.original.name,
            onClick: (event: MouseEvent) => { event.stopPropagation(); askDelete(info.row.original); },
        }, [h('i', { class: 'ph-duotone ph-trash' })]),
    }),
];

const cluster = createColumnHelper<VirtualCluster>();
const clusterColumns = [
    cluster.accessor('name', {
        header: 'Virtual cluster',
        meta: { width: '26%' },
        cell: (info) => h('span', { class: 'mono strong' }, info.getValue()),
    }),
    cluster.accessor('bootstrap', {
        header: 'Upstream bootstrap',
        meta: { width: '38%' },
        cell: (info) => h('span', { class: 'mono muted small' }, info.getValue()),
    }),
    cluster.accessor('topics', { header: 'Topics', meta: { width: '18%' } }),
    cluster.accessor('state', {
        header: 'State',
        meta: { width: '18%' },
        cell: (info) => h('span', {
            class: ['tag', info.getValue() === 'live' ? 'tag-accent' : 'tag-brand'],
        }, info.getValue()),
    }),
];
</script>

<template>
    <div class="wrap">
        <div class="head">
            <div>
                <h1>Clusters</h1>
                <p class="lede">
                    Virtual topics are the names clients see. Each maps to exactly one physical topic upstream and
                    may carry a read filter, so two consumers of the same stream can be given different slices of it
                    without copying data.
                </p>
            </div>
            <button class="btn btn-primary" @click="router.push('/topics/new')">
                <i class="ph-duotone ph-plus" />
                New virtual topic
            </button>
        </div>

        <div class="stats">
            <div v-for="stat in stats" :key="stat.label" class="stat">
                <span class="value">{{ stat.value }}</span>
                <span class="label">{{ stat.label }}</span>
            </div>
        </div>

        <p v-if="error" class="error">{{ error.message }}</p>
        <p v-else-if="isPending" class="muted">Loading…</p>

        <template v-else>
            <h2>Topic aliases</h2>
            <DataTable :columns="aliasColumns" :data="aliases" min-width="880px" />

            <h2>Cluster mapping</h2>
            <DataTable :columns="clusterColumns" :data="clusters" min-width="720px" />
        </template>

        <ConfirmDialog
            v-model:open="confirmOpen"
            :title="'Delete ' + (pendingDelete?.name ?? '') + '?'"
            body="The alias is removed from the gateway config on the next reload. The physical topic and its data are untouched."
            confirm-label="Delete virtual topic"
            danger
            :pending="remove.isPending.value"
            @confirm="confirmDelete"
        />
    </div>
</template>

<style scoped>
.wrap { max-width: 1080px; }
.head { display: flex; align-items: flex-start; gap: var(--space-6); margin-bottom: 26px; }
.head .btn { flex: none; margin-top: 4px; }
h2 { font-family: var(--font-heading); font-size: 15px; margin: 30px 0 10px; }
.stats { display: flex; gap: 38px; margin-bottom: 26px; }
.stat { display: flex; flex-direction: column; gap: 2px; }
.stat .value { font-family: var(--font-heading); font-size: 25px; line-height: 1; }
.stat .label { font-size: 11.5px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.07em; }
.error { color: var(--error); }
:deep(.expr) { font-family: var(--mono); font-size: 12px; color: var(--brand-text); }
:deep(.strong) { font-weight: 600; }
:deep(.faint) { color: var(--faint); font-style: italic; }
</style>
