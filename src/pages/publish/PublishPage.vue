<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { useApi } from '@/api';
import { ApiError, type SchemaDetail, type SchemaListing } from '@/api/types';
import AppToast from '@/components/AppToast.vue';
import { keys } from '@/queries/keys';
import SchemaForm from './components/SchemaForm.vue';
import SearchSelect, { type SelectItem } from './components/SearchSelect.vue';
import { childrenOf } from '@/lib/topics';
import { buildValue, parseHeaders, prefill, validate, type FieldErrors, type FormValues } from './lib/schema';

const api = useApi();
const { data: topicsData } = useQuery({ queryKey: keys.topics(), queryFn: () => api.listTopics() });
const topics = computed(() => topicsData.value ?? []);

const topic = ref('');
const recordName = ref('');
const listing = ref<SchemaListing | null>(null);
const schema = ref<SchemaDetail | null>(null);
const values = ref<FormValues>({});
const errors = ref<FieldErrors>({});
const key = ref('');
const headerText = ref('region: eu');
const raw = ref('{\n  "example": true\n}');
const pending = ref(false);
const toastOpen = ref(false);
const toast = ref({ ok: true, text: '' });

const physicalOf = (name: string): string =>
    topics.value.find((t) => t.type === 'virtual' && t.name === name)?.physicalTopic ?? name;

const topicItems = computed<SelectItem[]>(() => topics.value.map((t) => ({
    value: t.name,
    tag: t.type,
    tagAccent: t.type === 'virtual',
    hint: t.type === 'virtual'
        ? '→ ' + t.physicalTopic
        : childrenOf(topics.value, t.name).length + ' aliases',
})));

const typeItems = computed<SelectItem[]>(() =>
    (listing.value?.subjects ?? []).map((s) => ({
        value: s.recordName,
        hint: 'v' + s.version + (schema.value?.recordName === s.recordName ? ' · ' + schema.value.fields.length + ' fields' : ''),
    })));

const hasSubjects = computed(() => (listing.value?.subjects.length ?? 0) > 0);
const schemaless = computed(() => !!topic.value && listing.value !== null && !hasSubjects.value);

/// Step 1 → 2: subjects are resolved against the PHYSICAL topic, then the prefix is
/// stripped by the backend so the dropdown holds record names only.
watch(topic, async (name) => {
    recordName.value = '';
    schema.value = null;
    listing.value = null;
    values.value = {};
    errors.value = {};
    if (!name) return;
    listing.value = await api.listSchemas(name);
});

/// Step 2 → 3: the chosen subject's field list drives the form, prefilled from the schema.
watch(recordName, async (name) => {
    schema.value = null;
    errors.value = {};
    if (!name || !listing.value) return;
    const summary = listing.value.subjects.find((s) => s.recordName === name);
    if (!summary) return;
    schema.value = await api.getSchema(summary.subject, summary.version);
    values.value = prefill(schema.value);
});

const request = computed(() => ({
    topic: topic.value,
    key: key.value || null,
    ...(schema.value ? { subject: schema.value.subject, schemaVersion: schema.value.version } : {}),
    headers: parseHeaders(headerText.value),
    value: schema.value ? buildValue(schema.value, values.value) : safeParse(raw.value),
}));

function safeParse(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        return '<invalid JSON>';
    }
}

const preview = computed(() => {
    if (!topic.value) return '// select a topic';
    if (hasSubjects.value && !schema.value) return '// select an event type';
    return JSON.stringify(request.value, null, 2);
});

const resolveLine = computed(() => {
    if (!topic.value) return '';
    const target = physicalOf(topic.value);
    const count = listing.value?.subjects.length ?? 0;
    const prefix = topic.value === target ? '' : topic.value + ' → ' + target + '  ·  ';
    return prefix + 'subjects matching ' + target + '-*  ·  ' + count + ' found';
});

const isVirtual = computed(() =>
    topics.value.some((t) => t.type === 'virtual' && t.name === topic.value));

const publish = async (): Promise<void> => {
    if (!topic.value) {
        toast.value = { ok: false, text: 'Select a topic first.' };
        toastOpen.value = true;
        return;
    }
    if (hasSubjects.value && !schema.value) {
        toast.value = { ok: false, text: 'Select an event type first.' };
        toastOpen.value = true;
        return;
    }

    if (schema.value) {
        errors.value = validate(schema.value, values.value);
        if (Object.keys(errors.value).length) {
            toast.value = {
                ok: false,
                text: 'Validation failed against ' + schema.value.subject + ' v' + schema.value.version + '.',
            };
            toastOpen.value = true;
            return;
        }
    } else if (safeParse(raw.value) === '<invalid JSON>') {
        toast.value = { ok: false, text: 'Value is not valid JSON.' };
        toastOpen.value = true;
        return;
    }

    pending.value = true;
    try {
        const result = await api.publish(request.value);
        toast.value = {
            ok: true,
            text: 'Written to ' + result.topic + ' · partition ' + result.partition + ' · offset ' + result.offset,
        };
    } catch (cause) {
        toast.value = { ok: false, text: cause instanceof ApiError ? cause.message : 'Publish failed.' };
    } finally {
        pending.value = false;
        toastOpen.value = true;
    }
};

const reset = (): void => {
    values.value = prefill(schema.value);
    errors.value = {};
    key.value = '';
};
</script>

<template>
    <div>
        <div class="head">
            <h1>Publish</h1>
            <p class="lede">
                Pick a topic, then the event type. Subjects are resolved with the TopicRecordName strategy — the
                topic prefix is stripped and what remains is the record name. A schema, when one is registered,
                prefills the record.
            </p>
        </div>

        <div class="split">
            <div class="form-col">
                <div class="steps">
                    <SearchSelect
                        v-model="topic"
                        label="1 · Topic"
                        placeholder="Search topics…"
                        :items="topicItems"
                        empty-text="No topic matches that name."
                    />
                    <SearchSelect
                        v-model="recordName"
                        label="2 · Event type"
                        :items="typeItems"
                        :disabled="!topic || !hasSubjects"
                        :placeholder="!topic ? 'Select a topic first' : hasSubjects ? 'Search event types…' : 'No schema registered'"
                        empty-text="No event type matches that name."
                    />
                </div>

                <p v-if="topic" class="resolve">
                    <span class="pill" :class="{ 'pill-accent': isVirtual }">{{ isVirtual ? 'virtual' : 'physical' }}</span>
                    <span class="mono">{{ resolveLine }}</span>
                </p>

                <div v-if="!topic" class="gate">
                    Select a topic to continue. The event type and the record fields stay locked until kawa knows
                    which physical topic to resolve subjects against.
                </div>

                <div v-else-if="hasSubjects && !schema" class="gate">
                    {{ listing?.subjects.length }} event
                    {{ listing?.subjects.length === 1 ? 'type' : 'types' }} registered under
                    {{ physicalOf(topic) }}-*. Select one and its schema will prefill the record below.
                </div>

                <template v-else-if="schema">
                    <div class="schema-head">
                        <h4>3 · {{ schema.recordName }}</h4>
                        <span class="tag tag-neutral mono">{{ schema.subject }}</span>
                        <span class="faint">
                            v{{ schema.version }} · {{ schema.fields.length }} fields ·
                            {{ schema.fields.filter((field) => field.required).length }} required
                        </span>
                    </div>
                    <SchemaForm v-model="values" :schema="schema" :errors="errors" />
                </template>

                <template v-else-if="schemaless">
                    <div class="schema-head">
                        <h4>3 · Record</h4>
                        <span class="tag tag-neutral">no schema registered</span>
                    </div>
                    <p class="lede raw-note">
                        No subject in the registry starts with <span class="mono">{{ physicalOf(topic) }}-</span>, so
                        there is nothing to prefill. Send the value as raw JSON; the gateway passes it through
                        unvalidated.
                    </p>
                    <textarea v-model="raw" class="input raw" aria-label="Raw JSON value" />
                </template>

                <div v-if="topic" class="meta">
                    <div class="field">
                        <label for="pub-key">Message key <span class="faint">optional</span></label>
                        <input id="pub-key" v-model="key" class="input mono" placeholder="null → round-robin partition">
                    </div>
                    <div class="field">
                        <label for="pub-headers">Headers <span class="faint">one per line, name: value</span></label>
                        <textarea id="pub-headers" v-model="headerText" class="input headers" />
                    </div>
                </div>
            </div>

            <aside class="preview-col">
                <div class="preview-head">
                    <h6>Request preview</h6>
                    <span class="mono faint">POST /api/publish</span>
                </div>
                <pre class="pre preview">{{ preview }}</pre>
                <div class="preview-actions">
                    <button class="btn btn-primary" :disabled="pending" @click="publish">
                        <i class="ph-duotone ph-paper-plane-tilt" />Publish record
                    </button>
                    <button class="btn btn-secondary" @click="reset">Reset</button>
                </div>
                <p class="footnote">
                    Filters are applied when clients read a virtual topic, not on publish — a record that fails the
                    filter is still written to the physical topic.
                </p>
            </aside>
        </div>

        <AppToast v-model:open="toastOpen" :ok="toast.ok" :text="toast.text" />
    </div>
</template>

<style scoped>
.head { margin-bottom: 20px; }
.split { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 30px; align-items: start; }
.form-col { min-width: 0; }
.steps { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 6px; }
/* SearchSelect fills its column, so the two steps set the width themselves. */
.steps > * { flex: 1 1 300px; }

.resolve {
    font-size: 12px;
    color: var(--muted);
    margin: 2px 0 22px;
    display: flex;
    gap: 8px;
    align-items: baseline;
    flex-wrap: wrap;
}

.resolve .mono { font-size: 12.5px; }

.gate {
    margin: 18px 0 0;
    padding: 22px 0;
    border-top: 1px solid var(--chrome-line);
    max-width: 58ch;
    font-size: 13px;
    color: var(--muted);
}

.schema-head {
    display: flex;
    align-items: baseline;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--chrome-line);
}

.schema-head h4 { margin: 0; white-space: nowrap; }
.schema-head .faint { font-size: 11.5px; white-space: nowrap; }
.raw-note { margin-bottom: 12px; }
.raw { min-height: 180px; width: 100%; box-sizing: border-box; max-width: 60ch; }

.meta {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    margin-top: 24px;
    padding-top: 18px;
    border-top: 1px solid var(--chrome-line);
}

.meta .field { width: 280px; }
.meta .input { width: 100%; box-sizing: border-box; }
.headers { min-height: 74px; }

.preview-col {
    position: sticky;
    top: 74px;
    background: var(--chrome);
    border: 1px solid var(--chrome-line);
    border-radius: var(--radius-md);
    padding: 18px;
    min-width: 0;
}

.preview-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 10px; }
.preview-head h6 { margin: 0; color: var(--faint); }
.preview-head .mono { font-size: 12px; margin-left: auto; }
.preview { max-height: 340px; margin-bottom: 14px; white-space: pre; }
.preview-actions { display: flex; gap: 8px; align-items: center; }
.footnote { font-size: 11.5px; color: var(--faint); margin: 14px 0 0; }
</style>
