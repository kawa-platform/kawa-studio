<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { TabsList, TabsRoot, TabsTrigger } from 'reka-ui';
import type { JsonValue, PayloadFormatConfig, TransformationConfig } from '@/api/types';
import { isInternalTopic } from '@/lib/topics';
import { managedTitle } from '@/lib/managed';
import RbacBanner from '../rbac/components/RbacBanner.vue';
import { usePatchVirtualTopic, usePhysicalTopics, useTopics, useUpsertVirtualTopic, useCreatePhysicalTopic } from './queries';
import { useClusters } from '../clusters/queries';
import ConfigEditor from './components/ConfigEditor.vue';
import FilterBuilder from './components/FilterBuilder.vue';
import TransformationPreview from './components/TransformationPreview.vue';
import TransformationSteps from './components/TransformationSteps.vue';
import ValueFormatFields from './components/ValueFormatFields.vue';
import SearchSelect, { type SelectItem } from '../publish/components/SearchSelect.vue';
import {
    buildVirtualTopicConfig,
    buildVirtualTopicPatch,
    isFilterComplete,
    virtualTopicFormFromTopic,
    type VirtualTopicFilterForm,
} from './lib/virtualTopicConfig';
import {
    fieldsBefore,
    hasErrors,
    stepErrorFromMessage,
    validateTransformations,
    type StepForm,
} from './lib/transformations';

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

const managedBy = computed(() => existing.value?.managedBy ?? null);

const name = ref('');
const target = ref('');
const exposePhysicalTopic = ref(false);
const filters = ref<VirtualTopicFilterForm>({ clause: null });
const valueFormat = ref<PayloadFormatConfig | null>(null);
const steps = ref<StepForm[]>([]);
/// The format transformed values are delivered in; null delivers them in the value format.
const outputFormat = ref<PayloadFormatConfig | null>(null);
/// The topic's steps when the form opened: the edit PATCH sends steps only when they changed.
const loadedSteps = ref<TransformationConfig[]>([]);
/// The preview's sample record value, as typed.
const sample = ref('');
const serverError = ref<string | null>(null);
/// A gateway 400 about one step, shown on that step's card until the steps change.
const stepServerError = ref<{ index: number; message: string } | null>(null);

watch(existing, (topic) => {
    if (!topic) return;
    const form = virtualTopicFormFromTopic(topic);
    name.value = form.name;
    target.value = form.topic;
    exposePhysicalTopic.value = form.exposePhysicalTopic;
    valueFormat.value = form.valueFormat;
    filters.value = form.filters;
    steps.value = form.transformations;
    outputFormat.value = form.outputFormat;
    loadedSteps.value = topic.transformations ?? [];
}, { immediate: true });

watch([steps, outputFormat], () => { stepServerError.value = null; }, { deep: true });


const pipelineErrors = computed(() => validateTransformations(valueFormat.value, steps.value, outputFormat.value));


/// The gateway numbers the output format as the step after the field steps (its trailing `convert`).
const outputErrors = computed(() =>
    stepServerError.value?.index === steps.value.length
        ? [...pipelineErrors.value.output, stepServerError.value.message]
        : pipelineErrors.value.output);

const stepErrors = computed(() => pipelineErrors.value.steps.map((errors, index) =>
    stepServerError.value?.index === index ? [...errors, stepServerError.value.message] : errors));

const parsedSample = computed<JsonValue | undefined>(() => {
    try {
        return sample.value.trim() ? JSON.parse(sample.value) as JsonValue : undefined;
    } catch {
        return undefined;
    }
});

const stepFields = computed(() => steps.value.map((_, index) => fieldsBefore(parsedSample.value, steps.value, index)));

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
    && !managedBy.value
    && !nameError.value
    && filterComplete.value
    && !hasErrors(pipelineErrors.value)
    && !upsert.isPending.value
    && !patch.isPending.value);

const submit = async (): Promise<void> => {
    serverError.value = null;
    stepServerError.value = null;
    try {
        const form = {
            topic: target.value,
            exposePhysicalTopic: exposePhysicalTopic.value,
            valueFormat: valueFormat.value,
            filters: filters.value,
            transformations: steps.value,
            outputFormat: outputFormat.value,
        };
        if (isEdit.value) {
            await patch.mutateAsync({
                currentName: originalName.value,
                request: buildVirtualTopicPatch(form, name.value.trim(), loadedSteps.value),
            });
        } else {
            await upsert.mutateAsync({
                name: name.value.trim(),
                config: buildVirtualTopicConfig(form),
            });
        }
        await router.push({ name: 'topics' });
    } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Request failed.';
        const step = stepErrorFromMessage(message);
        const outputIndex = outputFormat.value ? steps.value.length : -1;
        if (step && (step.index < steps.value.length || step.index === outputIndex)) {
            stepServerError.value = step;
        }
        else serverError.value = message;
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
    <div class="form">
        <div class="head">
            <h1 v-if="!isEdit">New topic</h1>
            <h1 v-else class="edit-head">
                <span class="edit-kicker">Edit topic</span>
                <span class="edit-name mono">{{ name || originalName }}</span>
            </h1>
            <p v-if="!isEdit" class="lede">
                A topic is either virtual or physical.
                The gateway resolves the virtual name to the physical topic on every request. A
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
            <RbacBanner v-if="managedBy" tone="warn">
                {{ managedTitle(managedBy) }}. Saving here is refused by the gateway.
            </RbacBanner>

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
                <h2>2 · Value format</h2>
                <ValueFormatFields
                    v-model="valueFormat"
                    id-prefix="vf-value-format"
                    label="Record value format"
                    none-label="No value format"
                    :output="steps.length > 0 && !outputFormat"
                    :errors="pipelineErrors.valueFormat"
                />
                <p class="hint">
                    How record values are decoded. A CEL filter reads the decoded value; transformations need a format.
                </p>
            </section>

            <section>
                <h2>3 · Read filter</h2>
                <FilterBuilder v-model="filters" />
            </section>


            <section>
                <h2>4 · Transformations</h2>
                <p class="hint section-lede">
                    Applied in order to each record value when clients read the virtual topic; keys and headers are never
                    changed. Field paths are dotted (<code>customer.name</code>); a list on the path applies the step to
                    every element. Clients reading the physical topic directly get the stored value.
                </p>
                <TransformationSteps v-model="steps" :errors="stepErrors" :fields="stepFields" />
            </section>

            <section>
                <h2>5 · Output format</h2>
                <ValueFormatFields
                    v-model="outputFormat"
                    id-prefix="tf-output"
                    label="Deliver values as"
                    none-label="Same as the value format"
                    output
                    :errors="outputErrors"
                />
                <p class="hint">
                    The format clients read transformed values in. Avro needs a subject to encode with, XML a root element.
                </p>
            </section>

            <section v-if="steps.length || outputFormat">
                <h2>6 · Preview</h2>
                <TransformationPreview
                    v-model:sample="sample"
                    :steps="steps"
                    :value-format="valueFormat"
                    :output-format="outputFormat"
                    :physical-topic="target"
                />
            </section>

            <div class="actions">
                <button class="btn btn-primary" :disabled="!canSubmit" :title="managedTitle(managedBy)" @click="submit">
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
/* Edit head is a masthead pair: a small kicker over the topic name as the subject line.
   The name is the thing the operator came to see, so it takes the h1's full size. */
.edit-head { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
.edit-kicker {
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
}
.edit-name { color: var(--brand-text); overflow-wrap: anywhere; }
.tabs { margin-bottom: 30px; }
.section-lede { margin: 0 0 12px; }
.seg-list { display: flex; }
.extra { margin-top: 22px; }
.extra > label {
    display: block;
    font-size: 12px;
    margin-bottom: 9px;
    color: color-mix(in srgb, var(--color-text) 70%, transparent);
}
.check { display: flex; align-items: center; gap: 9px; font-size: 13px; margin-bottom: 14px; }
.check-hint { margin: -7px 0 0 24px; }
kbd {
    font-family: var(--mono);
    font-size: 10.5px;
    border: 1px solid var(--chrome-line);
    border-radius: 2px;
    padding: 1px 4px;
}
</style>
