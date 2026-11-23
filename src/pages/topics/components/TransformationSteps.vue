<script setup lang="ts">
import { ref } from 'vue';
import CelEditor from '../../clusters/components/CelEditor.vue';
import {
    STEP_TYPES,
    addStep,
    canMove,
    moveStep,
    removeStep,
    stepLabel,
    type StepForm,
    type StepType,
} from '../lib/transformations';

/// The ordered list of a virtual topic's field steps, one card per step. The output format is a
/// block of its own on the page.
const steps = defineModel<StepForm[]>({ required: true });
const props = withDefaults(defineProps<{
    /// Per step, by index.
    errors?: string[][];
    /// Per step, by index: the fields the step sees, for path suggestions and CEL completion.
    fields?: string[][];
}>(), { errors: () => [], fields: () => [] });

const adding = ref('');
const add = (type: string): void => {
    if (type) steps.value = addStep(steps.value, type as StepType);
    adding.value = '';
};

const replace = (index: number, step: StepForm): void => {
    steps.value = steps.value.map((current, at) => (at === index ? step : current));
};

/// Text typed in each drop step's field input, keyed by step id, until it becomes a chip.
const pending = ref<Record<number, string>>({});

const addDropField = (index: number): void => {
    const step = steps.value[index];
    if (step?.type !== 'dropFields') return;
    const typed = (pending.value[step.id] ?? '').split(',').map((field) => field.trim()).filter(Boolean);
    pending.value = { ...pending.value, [step.id]: '' };
    const fresh = typed.filter((field) => !step.fields.includes(field));
    if (fresh.length) replace(index, { ...step, fields: [...step.fields, ...fresh] });
};

const removeDropField = (index: number, field: string): void => {
    const step = steps.value[index];
    if (step?.type !== 'dropFields') return;
    replace(index, { ...step, fields: step.fields.filter((current) => current !== field) });
};

const onDropKey = (event: KeyboardEvent, index: number): void => {
    if (event.key === 'Enter' || event.key === ',') {
        event.preventDefault();
        addDropField(index);
    }
};

const patch = (index: number, change: Partial<Record<'from' | 'to' | 'field' | 'value' | 'expression', string>>): void => {
    replace(index, { ...steps.value[index]!, ...change } as StepForm);
};

const listId = (step: StepForm): string => `tf-fields-${step.id}`;
</script>

<template>
    <div class="steps">
        <p v-if="steps.length === 0" class="empty">
            No transformations: records are delivered as stored. Add a step to reshape the value clients read.
        </p>

        <ol v-else class="step-list">
            <li v-for="(step, index) in steps" :key="step.id" class="step" :data-step="step.type">
                <div class="step-head">
                    <span class="step-title"><span class="step-no">{{ index + 1 }}</span>{{ stepLabel(step.type) }}</span>
                    <span class="step-tools">
                        <button
                            type="button"
                            class="btn btn-icon btn-ghost"
                            aria-label="Move up"
                            :disabled="!canMove(steps, index, -1)"
                            @click="steps = moveStep(steps, index, -1)"
                        >
                            <i class="ph-duotone ph-arrow-up" />
                        </button>
                        <button
                            type="button"
                            class="btn btn-icon btn-ghost"
                            aria-label="Move down"
                            :disabled="!canMove(steps, index, 1)"
                            @click="steps = moveStep(steps, index, 1)"
                        >
                            <i class="ph-duotone ph-arrow-down" />
                        </button>
                        <button
                            type="button"
                            class="btn btn-icon btn-ghost"
                            aria-label="Remove step"
                            @click="steps = removeStep(steps, index)"
                        >
                            <i class="ph-duotone ph-trash" />
                        </button>
                    </span>
                </div>

                <datalist :id="listId(step)">
                    <option v-for="field in props.fields[index] ?? []" :key="field" :value="field" />
                </datalist>

                <template v-if="step.type === 'dropFields'">
                    <ul v-if="step.fields.length" class="chips">
                        <li v-for="field in step.fields" :key="field" class="chip mono">
                            {{ field }}
                            <button type="button" class="chip-x" :aria-label="`Keep ${field}`" @click="removeDropField(index, field)">
                                <i class="ph-duotone ph-x" />
                            </button>
                        </li>
                    </ul>
                    <input
                        class="input mono"
                        :list="listId(step)"
                        :value="pending[step.id] ?? ''"
                        placeholder="Field path, e.g. customer.email — Enter to add"
                        aria-label="Field to drop"
                        autocomplete="off"
                        @input="pending = { ...pending, [step.id]: ($event.target as HTMLInputElement).value }"
                        @keydown="onDropKey($event, index)"
                        @blur="addDropField(index)"
                    >
                </template>

                <div v-else-if="step.type === 'renameField'" class="pair">
                    <input
                        class="input mono"
                        :list="listId(step)"
                        :value="step.from"
                        placeholder="From, e.g. customer.name"
                        aria-label="Rename from"
                        autocomplete="off"
                        @input="patch(index, { from: ($event.target as HTMLInputElement).value })"
                    >
                    <i class="ph-duotone ph-arrow-right" />
                    <input
                        class="input mono"
                        :value="step.to"
                        placeholder="To, e.g. customerName"
                        aria-label="Rename to"
                        autocomplete="off"
                        @input="patch(index, { to: ($event.target as HTMLInputElement).value })"
                    >
                </div>

                <div v-else-if="step.type === 'defaultField'" class="pair">
                    <input
                        class="input mono"
                        :list="listId(step)"
                        :value="step.field"
                        placeholder="Field, e.g. currency"
                        aria-label="Default field"
                        autocomplete="off"
                        @input="patch(index, { field: ($event.target as HTMLInputElement).value })"
                    >
                    <span class="eq">=</span>
                    <input
                        class="input mono"
                        :value="step.value"
                        placeholder='JSON value, e.g. "EUR"'
                        aria-label="Default value"
                        autocomplete="off"
                        @input="patch(index, { value: ($event.target as HTMLInputElement).value })"
                    >
                </div>

                <template v-else>
                    <CelEditor
                        :model-value="step.expression"
                        :fields="props.fields[index]"
                        placeholder='{"id": value.order_id, "skus": value.lines.map(l, l.sku)}'
                        @update:model-value="patch(index, { expression: $event as string })"
                    />
                    <p class="hint">The result replaces the whole value. Bindings: <code>value</code>, <code>key</code>, <code>headers</code>, <code>timestamp</code>.</p>
                </template>

                <p v-for="error in props.errors[index] ?? []" :key="error" class="field-error">{{ error }}</p>
            </li>
        </ol>

        <div class="add">
            <select
                v-model="adding"
                class="input"
                aria-label="Add step"
                @change="add(adding)"
            >
                <option value="" disabled>Add step…</option>
                <option v-for="entry in STEP_TYPES" :key="entry.type" :value="entry.type">
                    {{ entry.label }} — {{ entry.hint }}
                </option>
            </select>
            <button v-if="steps.length" type="button" class="btn btn-secondary" @click="steps = []">
                <i class="ph-duotone ph-trash" />Remove all
            </button>
        </div>
    </div>
</template>

<style scoped>
.steps { display: flex; flex-direction: column; gap: 12px; }
.step-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.step {
    display: flex;
    flex-direction: column;
    gap: 9px;
    padding: 12px 14px;
    border: 1px solid var(--chrome-line);
    border-radius: var(--radius-md);
}
.step-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.step-title { display: flex; align-items: center; gap: 9px; font-size: 13px; font-weight: 600; }
.step-no {
    display: inline-grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    font-size: 11px;
    color: var(--brand-text);
    background: color-mix(in srgb, var(--brand) 14%, transparent);
}
.step-tools { display: flex; gap: 2px; }
.pair { display: grid; grid-template-columns: 1fr auto 1fr; gap: 8px; align-items: center; }
.pair .input { min-width: 0; }
.eq { font-family: var(--mono); color: var(--muted); }
.chips { list-style: none; display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; }
.chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12.5px;
    padding: 2px 4px 2px 9px;
    border: 1px solid var(--chrome-line);
    border-radius: 999px;
}
.chip-x { border: 0; background: none; color: var(--muted); cursor: pointer; padding: 2px; line-height: 1; }
.chip-x:hover { color: var(--color-text); }
.hint, .field-error { margin: 0; }
.add { display: flex; gap: 8px; }
.add select { flex: 1; }
.empty {
    font-size: 13px;
    color: var(--muted);
    padding: 14px;
    margin: 0;
    border: 1px dashed var(--chrome-line);
    border-radius: var(--radius-md);
}
</style>
