<script setup lang="ts">
import { computed } from 'vue';
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui';
import type { Acl, Topic } from '@/api/types';
import { aclMatchesTopic, childrenOf, formatBytes, formatCount } from '@/lib/topics';
import FilterBadge from './FilterBadge.vue';
import TopicTypeTag from './TopicTypeTag.vue';

const open = defineModel<boolean>('open', { required: true });

const props = defineProps<{
    topic: Topic | null;
    topics: Topic[];
    acls: Acl[];
}>();

const emit = defineEmits<{ openTopic: [Topic],  deleteTopic: [Topic]}>();

const target = computed(() =>
    props.topic?.type === 'virtual'
        ? props.topics.find((t) => t.type === 'physical' && t.name === props.topic?.physicalTopic) ?? null
        : props.topic);

const aliasCount = computed(() =>
    props.topic?.type === 'physical' ? childrenOf(props.topics, props.topic.name).length : 0);

const kicker = computed(() => {
    if (!props.topic) return '';
    if (props.topic.type === 'virtual') return 'virtual topic · gateway config';
    const n = aliasCount.value;
    return 'upstream kafka · ' + n + ' virtual ' + (n === 1 ? 'alias' : 'aliases');
});

const meta = computed<{ k: string; v: string }[]>(() => {
    const t = props.topic;
    const p = target.value;
    if (!t || !p) return [];
    const isVirtual = t.type === 'virtual';
    return [
        { k: 'Partitions', v: String(p.partitions) },
        { k: 'Replication factor', v: String(p.replicationFactor) },
        { k: 'min.insync.replicas', v: p.config?.['min.insync.replicas'] ?? '—' },
        { k: 'cleanup.policy', v: p.config?.['cleanup.policy'] ?? '—' },
        { k: 'retention.ms', v: p.config?.['retention.ms'] ?? '—' },
        { k: 'Messages', v: isVirtual ? 'not reported for virtual topics' : formatCount(p.messageCount) },
        { k: 'On-disk size', v: isVirtual ? 'see ' + p.name : formatBytes(p.sizeBytes) },
    ];
});

const relatedAcls = computed(() =>
    props.topic
        ? props.acls.filter((a) => a.resourceType === 'topic' && aclMatchesTopic(a.resourceName, props.topic!.name))
        : []);

const jumpToPhysical = (): void => {
    if (target.value) emit('openTopic', target.value);
};
</script>

<template>
    <DialogRoot v-model:open="open">
        <DialogPortal>
            <DialogOverlay class="overlay drawer-overlay" />
            <DialogContent v-if="topic" class="drawer">
                <div class="head">
                    <div class="head-text">
                        <div class="head-tags">
                            <TopicTypeTag :type="topic.type" />
                            <span class="kicker">{{ kicker }}</span>
                        </div>
                        <DialogTitle class="name mono">{{ topic.name }}</DialogTitle>
                        <DialogDescription class="sr">Topic detail</DialogDescription>
                    </div>
                    <DialogClose class="btn btn-icon btn-secondary" aria-label="Close">
                        <i class="ph-duotone ph-x" />
                    </DialogClose>
                </div>

                <div class="body">
                    <template v-if="topic.type === 'virtual'">
                        <section>
                            <h6>Mapping</h6>
                            <div class="map mono">
                                <span>{{ topic.name }}</span>
                                <i class="ph-duotone ph-arrow-right" />
                                <button class="link" @click="jumpToPhysical">{{ topic.physicalTopic }}</button>
                            </div>
                            <p class="note">
                                Defined in virtualTopics. Clients see the virtual name; the gateway rewrites it on
                                every request.
                            </p>
                        </section>

                        <section>
                            <h6>Filter</h6>
                            <FilterBadge :filter="topic.filter" long />
                            <pre class="pre expr">{{ topic.filter?.expression ?? 'All records pass through unfiltered.' }}</pre>
                        </section>
                    </template>

                    <section>
                        <h6>Metadata</h6>
                        <table class="table">
                            <tbody>
                                <tr v-for="row in meta" :key="row.k">
                                    <td class="meta-key">{{ row.k }}</td>
                                    <td class="mono meta-val">{{ row.v }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </section>

                    <section>
                        <h6>Associated ACLs</h6>
                        <div v-for="acl in relatedAcls" :key="acl.id" class="acl">
                            <span class="mono principal">{{ acl.principal }}</span>
                            <span>{{ acl.operation }}</span>
                            <span
                                class="tag push"
                                :class="acl.permissionType === 'deny' ? 'tag-accent-2' : 'tag-neutral'"
                            >{{ acl.permissionType }}</span>
                        </div>
                        <p v-if="!relatedAcls.length" class="note">
                            No rule references this topic. Every principal is denied by default.
                        </p>
                    </section>

                    <section v-if="topic.type === 'virtual'" class="danger-zone">
                        <button @click="emit('deleteTopic', topic)" type="button" class="btn btn-secondary btn-danger">
                            <i class="ph-duotone ph-trash" />
                            Delete virtual topic
                        </button>
                    </section>
                </div>
            </DialogContent>
        </DialogPortal>
    </DialogRoot>
</template>

<style scoped>
.drawer-overlay { background: color-mix(in srgb, #020b18 52%, transparent); }

.head {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 20px 26px 16px;
    border-bottom: 2px solid color-mix(in srgb, var(--brand) 50%, transparent);
    position: sticky;
    top: 0;
    background: var(--chrome);
    z-index: 1;
}

.head-text { margin-right: auto; min-width: 0; }
.head-tags { display: flex; align-items: center; gap: 9px; margin-bottom: 5px; }
.kicker { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--brand-text); }
.name { margin: 0; font-size: 19px; font-weight: 500; word-break: break-all; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }

.body { padding: 22px 26px 60px; }
section { margin-bottom: 24px; }
h6 { margin: 0 0 8px; color: var(--brand-text); }

.map { display: flex; align-items: center; gap: 10px; font-size: 12.5px; }
.map i { font-size: 15px; color: var(--brand); }
.link { background: none; border: none; padding: 0; font: inherit; color: var(--color-accent-700); cursor: pointer; text-decoration: underline; }
.link:hover { color: var(--color-accent-400); }
.note { font-size: 12.5px; color: var(--muted); margin: 8px 0 0; }
.expr { margin-top: 8px; white-space: pre-wrap; }

.meta-key { padding-left: 0; color: var(--muted); width: 46%; }
.meta-val { font-size: 12px; white-space: normal; }

.acl { display: flex; gap: 10px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--chrome-line); }
.principal { font-size: 12.5px; min-width: 126px; }
.push { margin-left: auto; }
.danger-zone { padding-top: 20px; border-top: 1px solid var(--chrome-line); }
</style>
