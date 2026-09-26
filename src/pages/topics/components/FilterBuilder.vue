<script setup lang="ts">
import { computed } from 'vue';
import type { ValueFormat } from '@/api/types';
import CelEditor from '../../clusters/components/CelEditor.vue';
import SearchSelect, { type SelectItem } from '../../publish/components/SearchSelect.vue';
import {
    familyOf,
    headerClauseTypes,
    isCelClause,
    isHeaderClause,
    type VirtualTopicConfigFilter as Clause,
    type VirtualTopicFilterForm,
} from '../lib/virtualTopicConfig';

const model = defineModel<VirtualTopicFilterForm>({ required: true });
const valueFormat = defineModel<ValueFormat | null>('valueFormat', { default: null });

type HeaderType = (typeof headerClauseTypes)[number];

/// The kind dropdown is a SearchSelect like the physical-topic picker; empty string means
/// "no filter chosen". Picking a family replaces the clause with a blank instance.
const kind = computed<string>({
    get: () => familyOf(model.value.clause) ?? '',
    set: (value) => {
        if (value === 'cel') {
            model.value = { ...model.value, clause: { type: 'cel', expression: '' } };
        } else if (value === 'header') {
            // A header filter never touches the record value, so drop a previously set format
            // rather than silently keeping `valueFormat` on the topic.
            valueFormat.value = null;
            model.value = { ...model.value, clause: { type: 'headerEquals', header: '', value: '' } };
        }
    },
});

const kindItems: SelectItem[] = [
    { value: 'header', label: 'Header filter', hint: 'Filter on record headers' },
    { value: 'cel', label: 'CEL expression', hint: 'Evaluate over headers, metadata or the decoded record value' },
];

const headerClause = computed(() =>
    model.value.clause && isHeaderClause(model.value.clause) ? model.value.clause : null);
const celClause = computed(() =>
    model.value.clause && isCelClause(model.value.clause) ? model.value.clause : null);

const setClause = (clause: Clause | null): void => {
    model.value = { ...model.value, clause };
};

const patchHeader = (patch: { type?: HeaderType; header?: string; value?: string }): void => {
    if (!headerClause.value) return;
    setClause({ ...headerClause.value, ...patch });
};

const patchCel = (expression: string): void => {
    if (!celClause.value) return;
    setClause({ ...celClause.value, expression });
};

const setValueFormat = (value: string): void => {
    valueFormat.value = (value || null) as ValueFormat | null;
};
</script>

<template>
    <div class="filter-builder">
        <div class="field">
            <SearchSelect
                v-model="kind"
                :items="kindItems"
                label="Filter kind"
                placeholder="No filter"
                empty-text="No filter type matches."
            />
            <p class="hint">
                Filters apply when clients read the virtual topic.
                Only matched records are delivered, none matched records are skipped.
                You can either filter based on headers, record values using CEL or any other metadata available in the record.
            </p>
        </div>

        <template v-if="headerClause">
            <div class="row">
                <select
                    class="input op"
                    :value="headerClause.type"
                    aria-label="Header comparison"
                    @change="patchHeader({ type: ($event.target as HTMLSelectElement).value as HeaderType })"
                >
                    <option value="headerEquals">Header equals</option>
                    <option value="headerContains">Header contains</option>
                    <option value="headerStartsWith">Header starts with</option>
                    <option value="headerMatches">Header matches (regex)</option>
                </select>

                <span class="inputs">
                    <input
                        class="input mono"
                        :value="headerClause.header"
                        placeholder="Header name"
                        autocomplete="off"
                        @input="patchHeader({ header: ($event.target as HTMLInputElement).value })"
                    >
                    <input
                        class="input mono"
                        :value="headerClause.value"
                        :placeholder="headerClause.type === 'headerMatches' ? 'Regular expression' : 'Exact matching value'"
                        autocomplete="off"
                        @input="patchHeader({ value: ($event.target as HTMLInputElement).value })"
                    >
                </span>
            </div>
        </template>

        <template v-else-if="celClause">
            <div class="field">
                <label for="vf-value-format">Record value format</label>
                <select
                    id="vf-value-format"
                    class="input"
                    :value="valueFormat ?? ''"
                    @change="setValueFormat(($event.target as HTMLSelectElement).value)"
                >
                    <option value="">No value format</option>
                    <option value="json">JSON</option>
                </select>
                <p class="hint">
                    CEL binds <code>value</code> to the raw record value as a string unless a format
                    is set; <code>headers</code>, <code>key</code> and <code>timestamp</code> never
                    need one. JSON decodes <code>value</code> into a document so expressions can
                    descend into it, records that aren't valid JSON are then skipped.
                </p>
            </div>

            <div class="field">
                <label for="vf-expression">CEL expression</label>
                <CelEditor
                    id="vf-expression"
                    :model-value="celClause.expression"
                    placeholder="value.amount > 100"
                    @update:model-value="patchCel($event as string)"
                />
            </div>
        </template>

        <p v-else class="empty">
            Every record is delivered through the virtual topic. Choose a filter to keep only matching records.
        </p>
    </div>
</template>

<style scoped>
.filter-builder { display: flex; flex-direction: column; gap: 10px; }

.field { margin: 0; }
.hint { margin: 7px 0 0; }

.row {
    display: grid;
    grid-template-columns: minmax(150px, 220px) 1fr;
    gap: 8px;
    align-items: start;
}
.op { min-height: 32px; }
.inputs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    min-width: 0;
}
.inputs .input { min-width: 0; }

.empty {
    font-size: 13px;
    color: var(--muted);
    padding: 14px;
    border: 1px dashed var(--chrome-line);
    border-radius: var(--radius-md);
}
</style>