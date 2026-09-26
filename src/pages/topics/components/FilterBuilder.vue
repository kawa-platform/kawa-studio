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

/// Starting points for the expression box, one per binding, so the row doubles as a
/// reminder of what a filter can read. Every function used here is one the gateway
/// exposes (the same set CelEditor highlights and completes): the conversions int/
/// double/string/bool, the string tests matches/startsWith/endsWith/contains, and has.
/// Clicking one replaces the expression.
const celExamples: string[] = [
    'headers["region"] == "eu"',
    'has(headers, "region")',
    'matches(key, "^eu-")',
    'key.startsWith("order-")',
    'int(value.amount) > 100',
    'value.name.contains("test")',
    'timestamp > 1735689600000',
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
                Applied when clients read the virtual topic. Only records that match the expression are delivered; all others
                are skipped. Clients reading the physical topic directly are not filtered.
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
                <div class="hint">
                    Available CEL bindings:
                    <ul class="bindings">
                        <li>
                            <code>value</code>
                            <span>the record value as a string or a decoded document if a format is set</span>
                        </li>
                        <li>
                            <code>headers</code>
                            <span>the record headers as a map of strings</span>
                        </li>
                        <li>
                            <code>key</code>
                            <span>the record key as a string</span>
                        </li>
                        <li>
                            <code>timestamp</code>
                            <span>the record timestamp as an integer (epoch milliseconds)</span>
                        </li>
                    </ul>
                </div>
            </div>

            <div class="field">
                <label for="vf-expression">CEL expression</label>
                <CelEditor
                    id="vf-expression"
                    :model-value="celClause.expression"
                    placeholder="value.amount > 100"
                    @update:model-value="patchCel($event as string)"
                />
                <p class="hint">Examples - click one to load it into the editor:</p>
                <ul class="examples">
                    <li v-for="example in celExamples" :key="example">
                        <button
                            type="button"
                            class="btn btn-ghost example"
                            @click="patchCel(example)"
                        >
                            {{ example }}
                        </button>
                    </li>
                </ul>
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

/* A list inside a hint keeps the hint's own type; only the UA indent and block margins
   are replaced, so the items hang just off the lead line instead of floating 40px in. */
.hint ul {
    margin: 4px 0 0;
    padding-left: 18px;
}

/* Bindings read as a key/value table: the key is accent mono, the description carries
   the meaning, so it drops the hint's faint tone for normal body text. */
.bindings {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
}
.bindings li {
    display: grid;
    grid-template-columns: 76px 1fr;
    gap: 12px;
    align-items: baseline;
    padding: 3px 0;
}
.bindings code { color: var(--color-text); }

.examples {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 7px 0 0;
    padding: 0;
}
/* .btn sets the body face and wins over the .mono utility, so the mono has to be
   restated here for the snippet to read as code. */
.example {
    font-family: var(--mono);
    font-size: 12.5px;
    font-weight: 400;
    padding: 4px 9px;
    border-color: var(--chrome-line);
}
.example:hover { border-color: var(--color-accent); }

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
