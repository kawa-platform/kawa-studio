<script setup lang="ts">
import type { Topic } from '@/api/types';
import type { TopicView, TreeRow } from '../lib/rows';
import FilterBadge from './FilterBadge.vue';
import TopicTypeTag from './TopicTypeTag.vue';

const props = defineProps<{ rows: TreeRow[]; collapsed: Set<string>; view?: TopicView }>();

const emit = defineEmits<{ open: [Topic]; toggle: [string]; edit: [Topic]; delete: [Topic] }>();

const onToggle = (event: MouseEvent, name: string): void => {
    event.stopPropagation();
    emit('toggle', name);
};
</script>

<template>
    <div class="table-scroll">
        <table class="table tree" style="min-width: 760px">
            <thead>
                <tr>
                    <th style="width: 28%">Topic</th>
                    <th style="width: 9%">Type</th>
                    <th style="width: 21%">Mapping</th>
                    <th style="width: 7%" class="num">Partitions</th>
                    <th style="width: 6%" class="num">Replication Factor</th>
                    <th style="width: 17%" />
                </tr>
            </thead>
            <tbody>
                <tr
                    v-for="row in props.rows"
                    :key="row.topic.type + ':' + row.topic.name"
                    :data-parent="row.depth === 0 && row.topic.type === 'physical' ? '1' : null"
                    tabindex="0"
                    @click="emit('open', row.topic)"
                    @keydown.enter="emit('open', row.topic)"
                >
                    <td :class="{ indent: row.depth > 0 }">
                        <div class="name">
                            <button
                                v-if="row.topic.type === 'physical' && row.childCount && props.view !== 'physical'"
                                class="caret"
                                :aria-expanded="!props.collapsed.has(row.topic.name)"
                                :aria-label="'Toggle ' + row.topic.name"
                                @click="onToggle($event, row.topic.name)"
                            >
                                <i :class="['ph-duotone', props.collapsed.has(row.topic.name) ? 'ph-caret-right' : 'ph-caret-down']" />
                            </button>
                            <span v-else-if="row.depth === 0" class="caret-spacer" />
                            <span v-if="row.depth > 0" class="connector mono">{{ row.last ? '└' : '├' }}</span>
                            <span class="mono topic-name">{{ row.topic.name }}</span>
                        </div>
                    </td>
                    <td><TopicTypeTag :type="row.topic.type" /></td>
                    <td class="muted">
                        <div class="mapping">
                            <span v-if="row.topic.type === 'virtual' && row.depth === 0" class="mono">
                                → {{ row.topic.physicalTopic }}
                            </span>
                            <span v-else-if="!row.topic.filter" class="mono">—</span>
                            <FilterBadge :filter="row.topic.filter" />
                        </div>
                    </td>
                    <td class="num">{{ row.topic.partitions }}</td>
                    <td class="num">{{ row.topic.replicationFactor }}</td>
                    <td class="actions" @click.stop>
                        <template v-if="row.topic.type === 'virtual'">
                            <button
                                class="btn btn-ghost"
                                :title="'Edit ' + row.topic.name"
                                @keydown.enter.stop
                                @keydown.space.stop
                                @click="emit('edit', row.topic)"
                            >Edit</button>
                            <button
                                class="btn btn-ghost btn-danger"
                                :title="'Delete ' + row.topic.name"
                                @keydown.enter.stop
                                @keydown.space.stop
                                @click="emit('delete', row.topic)"
                            >Delete</button>
                        </template>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<style scoped>
.tree tbody tr { cursor: pointer; }
.tree tbody tr[data-parent] { background: color-mix(in srgb, var(--color-accent) 6%, transparent); }
.tree tbody tr[data-parent] td:first-child { box-shadow: inset 2px 0 0 var(--brand); }
.name { display: flex; align-items: center; gap: 7px; }
.topic-name { font-size: 12.5px; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.mapping { display: flex; align-items: center; gap: 8px; }
.actions { text-align: right; white-space: nowrap; }
.actions > * + * { margin-left: 6px; }
.actions .btn { font-size: 12.5px; }

.caret {
    display: inline-flex;
    align-items: center;
    width: 16px;
    flex: none;
    background: none;
    border: none;
    padding: 0;
    color: var(--color-accent);
    cursor: pointer;
}

.caret i { font-size: 14px; }
.caret-spacer { width: 16px; flex: none; }
.connector { color: var(--faint); width: 12px; flex: none; font-size: 12.5px; }
</style>
