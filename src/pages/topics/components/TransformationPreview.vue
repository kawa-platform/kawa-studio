<script setup lang="ts">
import { computed, ref } from 'vue';
import { useApi } from '@/api/api';
import type { JsonValue, PayloadFormatConfig } from '@/api/types';
import {
    deliveredFormat,
    describeFormat,
    previewSteps,
    renderOutput,
    sampleFromSchema,
    stepLabel,
    type StepForm,
} from '../lib/transformations';

/// The steps applied to a sample value, shown as the output format writes it, so a mapping mistake
/// shows before a client reads the topic. Runs in the browser up to the first CEL step.
const sample = defineModel<string>('sample', { required: true });
const props = defineProps<{
    steps: StepForm[];
    valueFormat: PayloadFormatConfig | null;
    outputFormat: PayloadFormatConfig | null;
    physicalTopic: string;
}>();

const api = useApi();

const parsed = computed<{ value?: JsonValue; error?: string }>(() => {
    if (!sample.value.trim()) return {};
    try {
        return { value: JSON.parse(sample.value) as JsonValue };
    } catch {
        return { error: 'The sample is not valid JSON.' };
    }
});

const preview = computed(() =>
    parsed.value.value === undefined ? null : previewSteps(parsed.value.value, props.steps));

const output = computed(() => deliveredFormat(props.valueFormat, props.outputFormat));

/// The delivered value in the output format. Up to a CEL step it is the value that step receives,
/// which is still the decoded tree, so it is shown as JSON.
const rendered = computed(() => {
    const result = preview.value;
    if (!result || result.notes.some((note) => note.failure)) return null;
    return renderOutput(result.value, result.stoppedAt === null ? output.value : null);
});

/// What the steps changed, beside the rendered value: dropped, renamed and added fields.
const changes = computed(() => preview.value?.fields.filter((row) => row.change !== 'kept') ?? []);

/// Fills the sample from the physical topic's registered schema: one placeholder per field.
const seeding = ref(false);
const seedError = ref<string | null>(null);
const canSeed = computed(() => props.valueFormat?.type === 'avro' && !!props.physicalTopic);

const seedFromSchema = async (): Promise<void> => {
    seeding.value = true;
    seedError.value = null;
    try {
        const listing = await api.listSchemas(props.physicalTopic);
        const wanted = props.valueFormat?.type === 'avro' ? props.valueFormat.subject : undefined;
        const summary = listing.subjects.find((entry) => entry.subject === wanted) ?? listing.subjects[0];
        if (!summary) {
            seedError.value = `No schema is registered for ${props.physicalTopic}.`;
            return;
        }
        const schema = await api.getSchema(summary.subject, summary.version);
        sample.value = JSON.stringify(sampleFromSchema(schema.fields), null, 2);
    } catch (cause) {
        seedError.value = cause instanceof Error ? cause.message : 'Could not read the schema.';
    } finally {
        seeding.value = false;
    }
};
</script>

<template>
    <div class="preview">
        <div class="formats">
            <span class="format-label">Decoded as</span>
            <span class="format mono">{{ describeFormat(valueFormat) }}</span>
            <i class="ph-duotone ph-arrow-right" />
            <span class="format-label">delivered as</span>
            <span class="format mono">{{ describeFormat(output) }}</span>
        </div>

        <div class="field">
            <label for="tf-sample">Sample record value</label>
            <textarea
                id="tf-sample"
                v-model="sample"
                class="input mono sample"
                rows="6"
                spellcheck="false"
                placeholder='{"order_id": "o-1", "customer": {"name": "Ada", "email": "ada@example.com"}}'
            />
            <p v-if="parsed.error" class="field-error">{{ parsed.error }}</p>
            <p v-else class="hint">
                Paste a record value as JSON to see what clients will read.
                <template v-if="valueFormat?.type === 'xml'">For XML, write it as the decoded tree: attributes as <code>"@name"</code>, text next to attributes as <code>"#text"</code>, every scalar a string.</template>
            </p>
            <button v-if="canSeed" type="button" class="btn btn-secondary seed" :disabled="seeding" @click="seedFromSchema">
                <i class="ph-duotone ph-file-code" />{{ seeding ? 'Reading schema…' : 'Fill from schema' }}
            </button>
            <p v-if="seedError" class="field-error">{{ seedError }}</p>
        </div>

        <template v-if="preview">
            <div v-if="rendered" class="field">
                <span class="out-label">
                    <template v-if="preview.stoppedAt === null">Delivered value · {{ describeFormat(output) }}</template>
                    <template v-else>Value step {{ preview.stoppedAt + 1 }} receives · decoded tree</template>
                </span>
                <pre v-if="rendered.ok" class="pre output" data-output>{{ rendered.text }}</pre>
                <p v-else class="field-error">{{ rendered.error }}</p>
                <p v-if="rendered.ok && rendered.note" class="hint">{{ rendered.note }}</p>
            </div>

            <ul v-if="changes.length" class="changes" aria-label="Changes">
                <li v-for="row in changes" :key="row.change + row.path" :class="['change', 'row-' + row.change]" class="mono">
                    <template v-if="row.change === 'renamed'">{{ row.from }} → {{ row.path }}</template>
                    <template v-else-if="row.change === 'added'">+ {{ row.path }}<template v-if="row.value"> = {{ row.value }}</template></template>
                    <template v-else>− {{ row.path }}</template>
                </li>
            </ul>

            <ul v-if="preview.notes.length" class="notes">
                <li v-for="note in preview.notes" :key="note.step + note.message" :class="{ failure: note.failure }">
                    Step {{ note.step + 1 }} ({{ stepLabel(steps[note.step]!.type) }}): {{ note.message }}
                </li>
            </ul>

            <p v-if="preview.stoppedAt !== null" class="hint stopped">
                Step {{ preview.stoppedAt + 1 }} is a CEL expression, which only the gateway evaluates: its result, and the
                steps after it, are not previewed.
            </p>
        </template>
    </div>
</template>

<style scoped>
.preview { display: flex; flex-direction: column; gap: 12px; }
.formats { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 13px; }
.format-label { color: var(--muted); }
.format { color: var(--brand-text); }
.field { margin: 0; }
.sample { width: 100%; resize: vertical; font-size: 12.5px; }
.hint, .field-error { margin: 7px 0 0; }
.seed { margin-top: 8px; }
.out-label { display: block; font-size: 12px; margin-bottom: 9px; color: color-mix(in srgb, var(--color-text) 70%, transparent); }
.output { margin: 0; font-size: 12.5px; white-space: pre; overflow-x: auto; max-height: 420px; }
.changes { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.change { font-size: 12px; padding: 2px 9px; border: 1px solid var(--chrome-line); border-radius: 999px; }
.row-dropped { text-decoration: line-through; color: var(--muted); }
.row-renamed, .row-added { color: var(--brand-text); }
.notes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
.notes { font-size: 12.5px; color: var(--warning); }
.notes .failure { color: var(--error); }
.stopped { margin: 0; }
</style>
