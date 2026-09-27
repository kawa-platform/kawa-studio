<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CelEditor from '../clusters/components/CelEditor.vue';
import PatternTable from './components/PatternTable.vue';
import { checkExpression } from './lib/cel';
import { patternsForRule } from './lib/patterns';
import { useGovernanceStore } from './lib/store';
import type { GovernanceRule } from './lib/types';

const route = useRoute();
const router = useRouter();
const store = useGovernanceStore();

const ruleId = computed(() => route.params.id as string | undefined);
const existing = computed(() => (ruleId.value ? store.doc.rules.find((r) => r.id === ruleId.value) ?? null : null));
const isEdit = computed(() => !!ruleId.value);

const blank = (): GovernanceRule => ({
  id: 'r' + Date.now(),
  name: '',
  selector: 'true',
  expression: '',
  message: '',
  description: '',
});
const draft = ref<GovernanceRule>(existing.value ? { ...existing.value } : blank());

const variables = computed(() => store.doc.variables);

/// Completions: the topic context plus every declared variable, typed.
const completions = computed(() => [
    { label: 'topic.name', type: 'variable', detail: 'string' },
    { label: 'topic.partitions', type: 'variable', detail: 'int' },
    { label: 'topic.replicationFactor', type: 'variable', detail: 'int' },
    { label: 'topic.config["cleanup.policy"]', type: 'variable', detail: 'string' },
    { label: '"retention.ms" in topic.config', type: 'variable', detail: 'key present' },
    { label: 'topic.name.startsWith("")', type: 'function', detail: 'bool' },
    { label: 'topic.name.matches()', type: 'function', detail: 'regex' },
    ...variables.value.map((v) => ({ label: v.name, type: 'constant', detail: v.type })),
]);

const nameError = computed(() => {
    const name = draft.value.name.trim();
    if (!name) {
      return null;
    }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
      return 'Lowercase letters, digits and hyphens.';
    }
    const taken = store.doc.rules.some((r) => r.name === name && r.id !== draft.value.id);
    return taken ? 'Another rule has this name.' : null;
});

const selectorCheck = computed(() => checkExpression(draft.value.selector.trim() || 'true', variables.value));
const expressionCheck = computed(() => checkExpression(draft.value.expression, variables.value));
const patterns = computed(() => patternsForRule(draft.value.expression, variables.value));

const canSave = computed(() =>
    !!draft.value.name.trim() && !nameError.value && !!draft.value.message.trim()
    && selectorCheck.value.ok && expressionCheck.value.ok);

const back = (): void => { void router.push({ name: 'governance' }); };

const submit = (): void => {
    if (!canSave.value) return;
    store.upsertRule({ ...draft.value, name: draft.value.name.trim(), selector: draft.value.selector.trim() || 'true' });
    back();
};
</script>

<template>
    <div class="form">
        <div class="head">
            <h1>{{ isEdit ? 'Edit rule' : 'New rule' }}</h1>
            <p class="lede">
              Rules are evaluated by Kawa on the kafka network protocol when creating or modifying physical and virtual topics.
              They can be used to enforce naming conventions, partition tiers, replication factors, cleanup policies, and other topic properties.
            </p>
        </div>

        <p v-if="isEdit && !existing" class="error">Rule does not exist.</p>

        <template v-else>
            <section>
                <h2>1 · Identity</h2>
                <div class="field">
                    <label for="rule-name">Name</label>
                    <input id="rule-name" v-model="draft.name" class="input mono" placeholder="rule name" autocomplete="off">
                    <p v-if="nameError" class="field-error">{{ nameError }}</p>
                    <p v-else class="hint">Returned to the client when the rule refuses a request.</p>
                </div>
                <div class="field">
                    <label for="description-message">Description</label>
                    <textarea id="description-message" v-model="draft.description" class="input" rows="2" />
                    <p class="hint">Serves as documentation for this rule.</p>
                </div>
              <div class="field">
                <label for="rule-message">Error Message</label>
                <textarea id="rule-message" v-model="draft.message" class="input" rows="2" />
                <p class="hint">Returned to the client with the 403.</p>
              </div>
            </section>

            <section>
                <h2>2 · Applies to</h2>
                <div class="field">
                    <CelEditor v-model="draft.selector" placeholder="true" :completions="completions" />
                    <p v-if="!selectorCheck.ok" class="field-error">{{ selectorCheck.error }}</p>
                    <p v-else class="hint"><code>true</code> applies the rule to every topic.</p>
                </div>
            </section>

            <section>
                <h2>3 · Expression</h2>
                <div class="field">
                    <CelEditor v-model="draft.expression" placeholder="topic.partitions in partitionTiers" :completions="completions" />
                    <p v-if="!expressionCheck.ok" class="field-error">{{ expressionCheck.error }}</p>
                    <p v-else class="check-ok"><i class="ph-duotone ph-check-circle" />Type-checks against the topic context and declared variables.</p>
                    <p class="hint">Press <kbd>Ctrl</kbd>+<kbd>Space</kbd> for completions.</p>
                </div>
                <PatternTable v-for="p in patterns" :key="p.variable" :variable="p.variable" :rows="p.rows" />
            </section>

            <div class="actions">
                <button class="btn btn-primary" :disabled="!canSave" @click="submit">
                    <i class="ph-duotone ph-check" />{{ isEdit ? 'Save changes' : 'Add rule' }}
                </button>
                <button class="btn btn-secondary" @click="back">Cancel</button>
            </div>
            <p class="hint">Changes stay a draft until you save and apply them on the Governance page.</p>
        </template>
    </div>
</template>

<style scoped>
.check-ok { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--success); margin: 7px 0 0; }
kbd { font-family: var(--mono); font-size: 11px; padding: 0 4px; border: 1px solid var(--chrome-line); border-radius: 3px; }
</style>
