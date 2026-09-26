<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { TabsList, TabsRoot, TabsTrigger } from 'reka-ui';
import { isInternalTopic, type ValueFormat } from '@/api/types';
import { usePatchVirtualTopic, usePhysicalTopics, useTopics, useUpsertVirtualTopic, useCreatePhysicalTopic } from './queries';
import { useClusters } from '../clusters/queries';
import ConfigEditor from './components/ConfigEditor.vue';
import FilterBuilder from './components/FilterBuilder.vue';
import SearchSelect, { type SelectItem } from '../publish/components/SearchSelect.vue';
import {
    buildVirtualTopicConfig,
    buildVirtualTopicPatch,
    isFilterComplete,
    virtualTopicFormFromTopic,
    type VirtualTopicFilterForm,
} from './lib/virtualTopicConfig';

type TopicKind = 'virtual' | 'physical';

const router = useRouter();
const route = useRoute();
const kind = ref<TopicKind>('virtual');

// ── Virtual topic form ──
const { data: physical } = usePhysicalTopics();
const { data: topics, isPending: topicsPending, error: topicsError } = useTopics();
const { data: clusters } = useClusters();
const upsert = useUpsertVirtualTopic();
const patch = usePatchVirtualTopic();

const originalName = computed(() => String(route.params.name ?? ''));
const isEdit = computed(() => !!originalName.value);
const existing = computed(() => topics.value?.find((topic) =>
    topic.type === 'virtual' && topic.name === originalName.value));

const name = ref('');
const target = ref('');
const exposePhysicalTopic = ref(false);
const filters = ref<VirtualTopicFilterForm>({ clause: null });
const valueFormat = ref<ValueFormat | null>(null);
const serverError = ref<string | null>(null);

watch(existing, (topic) => {
    if (!topic) return;
    const form = virtualTopicFormFromTopic(topic);
    name.value = form.name;
    target.value = form.topic;
    exposePhysicalTopic.value = form.exposePhysicalTopic;
    valueFormat.value = form.valueFormat;
    filters.value = form.filters;
}, { immediate: true });

const taken = computed(() =>
    new Set((clusters.value?.aliases ?? []).map((a) => a.name)));

const targetItems = computed<SelectItem[]>(() =>
    (physical.value ?? [])
        .filter((t) => !isInternalTopic(t))
        .map((t) => ({
            value: t.name,
            hint: `${t.partitions} partitions`,
        })));

/// The one validation that fires client-side; everything else is the server's answer.
const nameError = computed(() => {
    const value = name.value.trim();
    if (!value) return null;
    return taken.value.has(value) && value !== originalName.value ? 'That name is already taken.' : null;
});

const filterComplete = computed(() => isFilterComplete(filters.value.clause));

const canSubmit = computed(() =>
    !!name.value.trim()
    && !!target.value
    && (!isEdit.value || !!existing.value)
    && !nameError.value
    && filterComplete.value
    && !upsert.isPending.value
    && !patch.isPending.value);

const submit = async (): Promise<void> => {
    serverError.value = null;
    try {
        const form = {
            topic: target.value,
            exposePhysicalTopic: exposePhysicalTopic.value,
            valueFormat: valueFormat.value,
            filters: filters.value,
        };
        if (isEdit.value) {
            await patch.mutateAsync({
                currentName: originalName.value,
                request: buildVirtualTopicPatch(form, name.value.trim()),
            });
        } else {
            await upsert.mutateAsync({
                name: name.value.trim(),
                config: buildVirtualTopicConfig(form),
            });
        }
        await router.push({ name: 'topics' });
    } catch (cause) {
        serverError.value = cause instanceof Error ? cause.message : 'Request failed.';
    }
};

// ── Physical topic form ──
const createPhysical = useCreatePhysicalTopic();
const pfName = ref('');
const partitions = ref(3);
const replicationFactor = ref(1);
const cleanupPolicy = ref<'delete' | 'compact'>('delete');
const retentionMs = ref('');
const pfExtras = ref<Record<string, string>>({});

const pfNameError = computed(() => {
    const value = pfName.value.trim();
    if (!value) return null;
    const physicalNames = new Set((topics.value ?? [])
        .filter((t) => t.type === 'physical')
        .map((t) => t.name));
    return physicalNames.has(value) ? 'That name is already taken.' : null;
});

const pfCanSubmit = computed(() =>
    !!pfName.value.trim()
    && !pfNameError.value
    && !createPhysical.isPending.value);

const submitPhysical = async (): Promise<void> => {
    serverError.value = null;
    const configs: Record<string, string> = {
        ...pfExtras.value,
        'cleanup.policy': cleanupPolicy.value,
    };
    if (retentionMs.value.trim()) configs['retention.ms'] = retentionMs.value.trim();
    try {
        await createPhysical.mutateAsync({
            name: pfName.value.trim(),
            partitions: partitions.value,
            replicationFactor: replicationFactor.value,
            configs,
        });
        await router.push({ name: 'topics' });
    } catch (cause) {
        serverError.value = cause instanceof Error ? cause.message : 'Request failed.';
    }
};
</script>

<template>
    <div class="wrap">
        <div class="head">
            <h1>{{ isEdit ? 'Edit topic' : 'New topic' }}</h1>
            <p class="lede">
                A topic is either virtual or physical. A virtual topic is a config entry, not a Kafka
                object: the gateway resolves the virtual name to the physical topic on every request. A
                physical topic exists on the Kafka cluster itself.
            </p>
        </div>

        <TabsRoot
            v-if="!isEdit"
            :model-value="kind"
            class="seg tabs"
            @update:model-value="kind = $event as TopicKind"
        >
            <TabsList class="seg-list">
                <TabsTrigger value="virtual" class="seg-opt">Virtual</TabsTrigger>
                <TabsTrigger value="physical" class="seg-opt">Physical</TabsTrigger>
            </TabsList>
        </TabsRoot>

        <template v-if="kind === 'virtual'">
            <p v-if="isEdit && topicsPending" class="hint">Loading topic…</p>
            <p v-else-if="isEdit && topicsError" class="error">{{ topicsError.message }}</p>
            <p v-else-if="isEdit && !existing" class="error">
                Virtual topic “{{ originalName }}” does not exist.
            </p>

            <template v-else>
            <section>
                <h2>1 · Identity</h2>
                <div class="field">
                    <label for="vt-name">Virtual name</label>
                    <input
                        id="vt-name"
                        v-model="name"
                        class="input mono"
                        placeholder="Virtual topic name"
                        autocomplete="off"
                    >
                    <p v-if="nameError" class="field-error">{{ nameError }}</p>
                    <p v-else class="hint">The name clients connect to. Must be unique across virtual and physical topics.</p>
                </div>

                <div class="field">
                    <SearchSelect
                        v-model="target"
                        label="Physical topic"
                        placeholder="Physical topic name"
                        :items="targetItems"
                        empty-text="No physical topic matches that name."
                    />
                    <p class="hint">Exactly one. Fan-out is expressed by creating several virtual topics over the same physical one.</p>
                </div>

                <label class="check">
                    <input v-model="exposePhysicalTopic" type="checkbox">
                    <span>Also expose the physical topic to clients</span>
                </label>
                <p class="hint check-hint">
                    Leave disabled when clients should access this topic only through its virtual name.
                </p>
            </section>

            <section>
                <h2>2 · Read filter</h2>
                <FilterBuilder
                    v-model="filters"
                    v-model:value-format="valueFormat"
                />
            </section>

            <div class="actions">
                <button class="btn btn-primary" :disabled="!canSubmit" @click="submit">
                    <i class="ph-duotone ph-check" />
                    {{ upsert.isPending.value || patch.isPending.value ? 'Saving…' : isEdit ? 'Save changes' : 'Create topic' }}
                </button>
                <button class="btn btn-secondary" @click="router.push('/topics')">Cancel</button>
            </div>

            <p v-if="serverError" class="error">{{ serverError }}</p>
            </template>
        </template>

        <template v-else>
            <section>
                <h2>1 · Identity</h2>
                <div class="field">
                    <label for="pt-name">Topic name</label>
                    <input
                        id="pt-name"
                        v-model="pfName"
                        class="input mono"
                        placeholder="orders.v1"
                        autocomplete="off"
                    >
                    <p v-if="pfNameError" class="field-error">{{ pfNameError }}</p>
                    <p v-else class="hint">Created on the Kafka cluster. Kafka conventions apply — names are case-sensitive and use dots and hyphens.</p>
                </div>
            </section>

            <section>
                <h2>2 · Capacity</h2>
                <div class="row">
                    <div class="field">
                        <label for="pt-partitions">Partitions</label>
                        <input id="pt-partitions" v-model.number="partitions" type="number" min="1" class="input">
                        <p class="hint">Throughput and parallel consumer count scale with partitions; they cannot be lowered later.</p>
                    </div>
                    <div class="field">
                        <label for="pt-replication">Replication factor</label>
                        <input id="pt-replication" v-model.number="replicationFactor" type="number" min="1" class="input">
                        <p class="hint">Copies of every partition. Three tolerates one broker loss.</p>
                    </div>
                </div>
            </section>

            <section>
                <h2>3 · Config</h2>
                <div class="row">
                    <div class="field">
                        <label for="pt-cleanup">Cleanup policy</label>
                        <select id="pt-cleanup" v-model="cleanupPolicy" class="input">
                            <option value="delete">delete — remove records after retention</option>
                            <option value="compact">compact — keep the latest value per key</option>
                        </select>
                        <p class="hint">How old records are reclaimed.</p>
                    </div>
                    <div class="field">
                        <label for="pt-retention">Retention (ms)</label>
                        <input id="pt-retention" v-model="retentionMs" class="input mono" placeholder="604800000" autocomplete="off">
                        <p class="hint">How long records live before deletion. Empty uses the cluster default.</p>
                    </div>
                </div>

                <div class="extra">
                    <label>Additional config</label>
                    <ConfigEditor v-model="pfExtras" />
                </div>
            </section>

            <div class="actions">
                <button class="btn btn-primary" :disabled="!pfCanSubmit" @click="submitPhysical">
                    <i class="ph-duotone ph-check" />
                    {{ createPhysical.isPending.value ? 'Creating…' : 'Create topic' }}
                </button>
                <button class="btn btn-secondary" @click="router.push('/topics')">Cancel</button>
            </div>
            <p v-if="serverError" class="error">{{ serverError }}</p>
        </template>
    </div>
</template>

<style scoped>
.wrap { max-width: 640px; }
.head { margin-bottom: 22px; }
.tabs { margin-bottom: 30px; }
.seg-list { display: flex; }
section { margin-bottom: 30px; }
h2 {
    font-family: var(--font-heading);
    font-size: 15px;
    margin: 0 0 14px;
    padding-left: 10px;
    box-shadow: inset 3px 0 0 var(--brand);
}
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.extra { margin-top: 22px; }
.extra > label {
    display: block;
    font-size: 12px;
    margin-bottom: 9px;
    color: color-mix(in srgb, var(--color-text) 70%, transparent);
}
.field { margin-bottom: 18px; }
.hint { font-size: 11.5px; color: var(--faint); margin: 7px 0 0; max-width: 62ch; }
.hint code { font-family: var(--mono); color: var(--muted); }
.field-error { font-size: 11.5px; color: var(--error); margin: 7px 0 0; }
.check { display: flex; align-items: center; gap: 9px; font-size: 13px; margin-bottom: 14px; }
.check-hint { margin: -7px 0 0 24px; }
.actions { display: flex; gap: 8px; }
.error { color: var(--error); margin-top: 14px; }
kbd {
    font-family: var(--mono);
    font-size: 10.5px;
    border: 1px solid var(--chrome-line);
    border-radius: 2px;
    padding: 1px 4px;
}
</style>
