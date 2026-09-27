<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PatternTable from './components/PatternTable.vue';
import { parseLiteral, referencesVariable } from './lib/cel';
import { hasNamedGroups, variablePatternRows } from './lib/patterns';
import { useGovernanceStore } from './lib/store';
import { variableTypes, type GovernanceVariable } from './lib/types';

const route = useRoute();
const router = useRouter();
const store = useGovernanceStore();

const variableId = computed(() => route.params.id as string | undefined);
const existing = computed(() => (variableId.value ? store.doc.variables.find((v) => v.id === variableId.value) ?? null : null));
const isEdit = computed(() => !!variableId.value);

const blank = (): GovernanceVariable => ({ id: 'v' + Date.now(), name: '', type: 'string', value: '', note: '' });
const draft = ref<GovernanceVariable>(existing.value ? { ...existing.value } : blank());

const reserved = new Set(['topic', 'true', 'false', 'null', 'in', 'has', 'int', 'uint', 'double', 'string', 'bool', 'bytes', 'size', 'dyn', 'type']);

/// Rules that reference the variable under its saved name.
const usedBy = computed(() => {
    const name = existing.value?.name;
    if (!name) return 0;
    return store.doc.rules.filter((r) => referencesVariable(r.expression, name) || referencesVariable(r.selector, name)).length;
});

const nameError = computed(() => {
    const name = draft.value.name.trim();
    if (!name) return null;
    if (!/^[A-Za-z_]\w*$/.test(name)) return 'Start with a letter or underscore; letters, digits and underscores only.';
    if (reserved.has(name)) return `${name} is reserved in CEL or the topic context.`;
    const taken = store.doc.variables.some((v) => v.name === name && v.id !== draft.value.id);
    return taken ? 'Another variable has this name.' : null;
});

const renamed = computed(() => !!existing.value && usedBy.value > 0 && draft.value.name.trim() !== existing.value.name);

const valueError = computed(() => {
    if (!draft.value.value.trim()) return null;
    try {
        parseLiteral(draft.value.value, draft.value.type);
        return null;
    } catch (cause) {
        return cause instanceof Error ? cause.message : 'Invalid value.';
    }
});

/// Live preview of the pattern table for annotated regex strings.
const isAnnotated = computed(() => {
    if (draft.value.type !== 'string' || valueError.value) return false;
    try {
        const v: unknown = JSON.parse(draft.value.value);
        return typeof v === 'string' && hasNamedGroups(v);
    } catch {
        return false;
    }
});
const rows = computed(() => (isAnnotated.value ? variablePatternRows(draft.value) : null));

const canSave = computed(() =>
    !!draft.value.name.trim() && !nameError.value && !!draft.value.value.trim() && !valueError.value);

const back = (): void => { void router.push({ name: 'governance', query: { tab: 'variables' } }); };

const submit = (): void => {
    if (!canSave.value) return;
    store.upsertVariable({ ...draft.value, name: draft.value.name.trim() });
    back();
};
</script>

<template>
    <div class="form">
        <div class="head">
            <h1>{{ isEdit ? 'Edit variable' : 'New variable' }}</h1>
            <p class="lede">
                A named constant declared once and bound into every rule's evaluation. Changing it changes
                every rule that references it.
            </p>
        </div>

        <p v-if="isEdit && !existing" class="error">Variable does not exist.</p>

        <template v-else>
            <section>
                <h2>1 · Identity</h2>
                <div class="row">
                    <div class="field">
                        <label for="var-name">Name</label>
                        <input id="var-name" v-model="draft.name" class="input mono" placeholder="partitionTiers" autocomplete="off">
                        <p v-if="nameError" class="field-error">{{ nameError }}</p>
                        <p v-else-if="renamed" class="field-warn">
                            Referenced by {{ usedBy }} {{ usedBy === 1 ? 'rule' : 'rules' }} as {{ existing?.name }}; they stop validating until updated.
                        </p>
                        <p v-else class="hint">How rules refer to it.</p>
                    </div>
                    <div class="field">
                        <label for="var-type">Type</label>
                        <select id="var-type" v-model="draft.type" class="input mono">
                            <option v-for="t in variableTypes" :key="t" :value="t">{{ t }}</option>
                        </select>
                    </div>
                </div>
                <div class="field">
                    <label for="var-note">Note</label>
                    <input id="var-note" v-model="draft.note" class="input" autocomplete="off">
                    <p class="hint">Shown under the variable on the Governance page.</p>
                </div>
            </section>

            <section>
                <h2>2 · Value</h2>
                <div class="field">
                    <textarea id="var-value" v-model="draft.value" class="input mono" rows="4" placeholder="[1, 4, 6, 12]" />
                    <p v-if="valueError" class="field-error">{{ valueError }}</p>
                    <p v-else class="hint">
                        A CEL literal. A string regex with named groups, like <code>(?&lt;domain&gt;…)</code>, is shown as a
                        pattern table on rules that match against it.
                    </p>
                </div>
                <PatternTable v-if="rows" :variable="draft.name || 'this value'" :rows="rows" />
                <p v-else-if="isAnnotated" class="field-warn">
                    Uses a regex construct the table cannot show (lookaround, backreference or {n,m}). Rules still enforce it.
                </p>
            </section>

            <div class="actions">
                <button class="btn btn-primary" :disabled="!canSave" @click="submit">
                    <i class="ph-duotone ph-check" />{{ isEdit ? 'Save changes' : 'Add variable' }}
                </button>
                <button class="btn btn-secondary" @click="back">Cancel</button>
            </div>
            <p class="hint">Changes stay a draft until you save and apply them on the Governance page.</p>
        </template>
    </div>
</template>

<style scoped>
.hint code { font-family: var(--mono); color: var(--muted); }
.field-warn { color: var(--warning); margin: 7px 0 0; }
textarea.input { resize: vertical; }
</style>
