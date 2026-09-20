<script setup lang="ts">
import { computed } from 'vue';
import type { SchemaDetail } from '@/api/types';
import { groupFields, TYPE_LABEL, type FieldErrors, type FormValues } from '../lib/schema';

const values = defineModel<FormValues>({ required: true });

const props = defineProps<{ schema: SchemaDetail; errors: FieldErrors }>();

const groups = computed(() => groupFields(props.schema));

const set = (name: string, value: string): void => {
    values.value = { ...values.value, [name]: value };
};
</script>

<template>
    <div class="fields">
        <div v-for="group in groups" :key="group.path">
            <div v-if="group.path" class="group-head" :style="{ paddingLeft: (group.depth - 1) * 18 + 'px' }">
                <i class="ph-duotone ph-brackets-curly" />
                <span class="mono">{{ group.path }}</span>
                <span class="nested">nested record</span>
            </div>

            <div
                v-for="field in group.fields"
                :key="field.name"
                class="row"
                :style="{ paddingLeft: group.depth * 18 + 'px' }"
            >
                <div class="label">
                    <div class="mono leaf">{{ field.leaf }}</div>
                    <div class="annotations">
                        <span :class="field.required ? 'req' : 'opt'">
                            {{ field.required ? 'required' : 'optional' }}
                        </span>
                        <span class="faint">{{ TYPE_LABEL[field.type] }}</span>
                    </div>
                </div>

                <div class="control">
                    <select
                        v-if="field.type === 'enum'"
                        class="input"
                        :value="values[field.name] ?? ''"
                        @change="set(field.name, ($event.target as HTMLSelectElement).value)"
                    >
                        <option v-for="symbol in field.symbols" :key="symbol" :value="symbol">{{ symbol }}</option>
                    </select>

                    <select
                        v-else-if="field.type === 'boolean'"
                        class="input"
                        :value="values[field.name] ?? 'false'"
                        @change="set(field.name, ($event.target as HTMLSelectElement).value)"
                    >
                        <option value="false">false</option>
                        <option value="true">true</option>
                    </select>

                    <input
                        v-else
                        class="input mono"
                        :value="values[field.name] ?? ''"
                        :placeholder="field.type === 'timestamp' ? 'ISO-8601' : field.type === 'double' || field.type === 'int' ? '0' : ''"
                        :aria-invalid="!!props.errors[field.name]"
                        @input="set(field.name, ($event.target as HTMLInputElement).value)"
                    >

                    <div v-if="field.doc" class="doc">{{ field.doc }}</div>
                    <div v-if="props.errors[field.name]" class="error">{{ props.errors[field.name] }}</div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.fields { display: flex; flex-direction: column; }

.group-head {
    display: flex;
    align-items: baseline;
    gap: 9px;
    margin-top: 16px;
    padding: 7px 0 5px;
    border-bottom: 1px solid var(--chrome-line);
    font-size: 12px;
}

.group-head i { font-size: 14px; color: var(--color-accent); }
.nested { font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--faint); }

.row {
    display: grid;
    grid-template-columns: minmax(150px, 190px) minmax(0, 1fr);
    column-gap: 20px;
    row-gap: 4px;
    align-items: start;
    padding: 10px 0;
    border-bottom: 1px solid var(--chrome-line);
}

.label { padding-top: 7px; }
.leaf { font-size: 12.5px; line-height: 1.3; }

.annotations {
    font-size: 10.5px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    margin-top: 3px;
    display: flex;
    gap: 7px;
    flex-wrap: wrap;
}

.req { color: var(--brand-text); }
.opt { color: var(--faint); }
.control { max-width: 320px; }
.control .input { width: 100%; box-sizing: border-box; }
.doc { font-size: 11.5px; color: var(--faint); margin-top: 4px; }
.error { font-size: 11.5px; color: var(--color-accent-2-700); margin-top: 4px; }
</style>
