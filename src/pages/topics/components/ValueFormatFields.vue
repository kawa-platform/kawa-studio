<script setup lang="ts">
import { computed } from 'vue';
import type { OnDecodeError, PayloadFormatConfig, ValueFormat } from '@/api/types';

/// Edits one payload format: a virtual topic's value format or its output format.
const model = defineModel<PayloadFormatConfig | null>({ required: true });
const props = withDefaults(defineProps<{
    /// Prefixes the input ids, so several editors can share a page.
    idPrefix: string;
    label: string;
    /// The text of the "no format" option, which clears the model.
    noneLabel: string;
    /// This is the format transformed values are encoded in: Avro needs a subject, XML a root.
    output?: boolean;
    errors?: string[];
}>(), { output: false, errors: () => [] });

const id = (name: string): string => `${props.idPrefix}-${name}`;

const setType = (type: string): void => {
    if (!type) {
        model.value = null;
        return;
    }
    // A switch keeps the decode-error choice; the per-format fields start empty.
    const onDecodeError = model.value?.onDecodeError ? { onDecodeError: model.value.onDecodeError } : {};
    model.value = { type: type as ValueFormat, ...onDecodeError } as PayloadFormatConfig;
};

const update = (patch: Record<string, unknown>): void => {
    if (!model.value) return;
    const next: Record<string, unknown> = { ...model.value, ...patch };
    // An emptied optional field is omitted, as the gateway expects, rather than sent blank.
    for (const key of Object.keys(patch)) {
        if (next[key] === undefined || next[key] === '') delete next[key];
    }
    model.value = next as PayloadFormatConfig;
};

const setVersion = (raw: string): void => {
    const trimmed = raw.trim();
    update({ version: trimmed ? Number(trimmed) : undefined });
};

const avro = computed(() => (model.value?.type === 'avro' ? model.value : null));
const xml = computed(() => (model.value?.type === 'xml' ? model.value : null));
</script>

<template>
    <div class="value-format">
        <div class="row">
            <div class="field">
                <label :for="id('type')">{{ label }}</label>
                <select
                    :id="id('type')"
                    class="input"
                    :value="model?.type ?? ''"
                    @change="setType(($event.target as HTMLSelectElement).value)"
                >
                    <option value="">{{ noneLabel }}</option>
                    <option value="json">JSON</option>
                    <option value="avro">Avro</option>
                    <option value="xml">XML</option>
                </select>
            </div>
            <div v-if="model" class="field">
                <label :for="id('on-decode-error')">On decode error</label>
                <select
                    :id="id('on-decode-error')"
                    class="input"
                    :value="model.onDecodeError ?? 'skip'"
                    @change="update({ onDecodeError: ($event.target as HTMLSelectElement).value as OnDecodeError })"
                >
                    <option value="skip">skip — drop the record</option>
                    <option value="include">include — deliver it as stored</option>
                    <option value="fail">fail — fail the fetch</option>
                </select>
            </div>
        </div>

        <div v-if="avro" class="row">
            <div class="field">
                <label :for="id('subject')">Subject</label>
                <input
                    :id="id('subject')"
                    class="input mono"
                    :value="avro.subject ?? ''"
                    :placeholder="output ? 'Required, e.g. orders-value' : 'Optional'"
                    autocomplete="off"
                    @input="update({ subject: ($event.target as HTMLInputElement).value })"
                >
            </div>
            <div class="field">
                <label :for="id('version')">Version</label>
                <input
                    :id="id('version')"
                    class="input mono"
                    type="number"
                    min="1"
                    :value="avro.version ?? ''"
                    placeholder="Latest"
                    @input="setVersion(($event.target as HTMLInputElement).value)"
                >
            </div>
        </div>

        <div v-if="xml" class="field">
            <label :for="id('root')">Root element</label>
            <input
                :id="id('root')"
                class="input mono"
                :value="xml.root ?? ''"
                :placeholder="output ? 'Required, e.g. order' : 'Optional; when set, another root is refused'"
                autocomplete="off"
                @input="update({ root: ($event.target as HTMLInputElement).value })"
            >
            <p class="hint">
                Attributes read as <code>@name</code> fields, text next to attributes as <code>#text</code>, and every
                scalar is a string.
            </p>
        </div>

        <p v-for="error in errors" :key="error" class="field-error">{{ error }}</p>
    </div>
</template>

<style scoped>
.value-format { display: flex; flex-direction: column; gap: 10px; }
.field { margin: 0; }
.field-error { margin: 0; }
</style>
