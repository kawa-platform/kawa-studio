<script setup lang="ts">
import { computed, ref } from 'vue';
import { TOPIC_CONFIG_KEYS, configValuesFor } from '@/lib/topicConfigs';

/// Free text, backed by autocomplete suggestions: Kafka accepts configs beyond the
/// curated list, so the key input never restricts to it.
const config = defineModel<Record<string, string>>({ required: true });

const keyInput = ref('');
const valueInput = ref('');
const error = ref<string | null>(null);

const keyDatalistId = 'kawa-config-keys';
const valueDatalistId = 'kawa-config-values';

const valueOptions = computed(() => configValuesFor(keyInput.value.trim()));

const canAdd = computed(() => !!keyInput.value.trim());

const add = (): void => {
    const key = keyInput.value.trim();
    if (!key) return;
    if (config.value[key] !== undefined) {
        error.value = '"' + key + '" is already set. Remove it first to change the value.';
        return;
    }
    config.value = { ...config.value, [key]: valueInput.value.trim() };
    keyInput.value = '';
    valueInput.value = '';
    error.value = null;
};

const remove = (key: string): void => {
    const next = { ...config.value };
    delete next[key];
    config.value = next;
};

const entries = computed(() => Object.entries(config.value));
</script>

<template>
    <div>
        <div v-if="entries.length" class="list">
            <div v-for="[key, value] in entries" :key="key" class="set">
                <span class="mono k">{{ key }}</span>
                <span class="mono v">{{ value || '—' }}</span>
                <button
                    class="btn btn-ghost btn-icon"
                    :title="'Remove ' + key"
                    aria-label="Remove"
                    @click="remove(key)"
                >
                    <i class="ph-duotone ph-x" />
                </button>
            </div>
        </div>

        <div class="add">
            <div class="field">
                <label for="kawa-config-key">Key</label>
                <input
                    id="kawa-config-key"
                    v-model="keyInput"
                    class="input mono"
                    :list="keyDatalistId"
                    placeholder="retention.ms"
                    autocomplete="off"
                    @keydown.enter.prevent="add"
                >
                <datalist :id="keyDatalistId">
                    <option v-for="key in TOPIC_CONFIG_KEYS" :key="key" :value="key" />
                </datalist>
            </div>
            <div class="field">
                <label for="kawa-config-value">Value</label>
                <input
                    id="kawa-config-value"
                    v-model="valueInput"
                    class="input mono"
                    :list="valueOptions?.length ? valueDatalistId : undefined"
                    :placeholder="valueOptions?.[0] ?? '604800000'"
                    autocomplete="off"
                    @keydown.enter.prevent="add"
                >
                <datalist v-if="valueOptions?.length" :id="valueDatalistId">
                    <option v-for="value in valueOptions" :key="value" :value="value" />
                </datalist>
            </div>
            <button class="btn btn-secondary btn-add" :disabled="!canAdd" @click="add">
                <i class="ph-duotone ph-plus" />
                Add
            </button>
        </div>

        <p v-if="error" class="field-error">{{ error }}</p>
        <p class="hint">Any Kafka topic config can be set — the list is suggestions, not a restriction.</p>
    </div>
</template>

<style scoped>
.list {
    border: 1px solid var(--chrome-line);
    border-radius: var(--radius-md);
    margin-bottom: 14px;
    overflow: hidden;
}
.set {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    align-items: center;
    gap: 12px;
    padding: 7px 10px;
    border-bottom: 1px solid var(--chrome-line);
}
.set:last-child { border-bottom: none; }
.k { font-size: 12.5px; }
.v { font-size: 12.5px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; }
.set .btn-icon { width: 30px; height: 30px; font-size: 12px; }
.add {
    display: flex;
    align-items: flex-end;
    gap: 10px;
}
.add .field { flex: 1; margin-bottom: 0; }
.btn-add { flex: none; }
.field-error { font-size: 11.5px; color: var(--error); margin: 7px 0 0; }
.hint { font-size: 11.5px; color: var(--faint); margin: 7px 0 0; }
</style>