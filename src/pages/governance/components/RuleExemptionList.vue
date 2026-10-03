<script setup lang="ts">
import CelEditor from '../../clusters/components/CelEditor.vue';
import ExpressionHelp from './ExpressionHelp.vue';
import type { Target } from '../lib/resources';
import type { GovernanceVariable, RuleExemption } from '../lib/types';

/// Editable list of one rule's exemptions. When any expression is true for a request, the
/// rule is skipped for that request; other rules still apply.
const exemptions = defineModel<RuleExemption[]>({ required: true });

defineProps<{
    target: Target;
    variables: GovernanceVariable[];
    completions: { label: string; type: string; detail?: string }[];
    /// Exemption id → problem, from checkRule.
    issues: Map<string, string>;
    /// Name of the exemption that matched in the inline test, if any.
    matched?: string;
}>();

const add = (): void => {
    exemptions.value = [...exemptions.value, {
        id: 'x' + Math.random().toString(36).slice(2, 10), name: '', description: '', expression: '',
    }];
};
const remove = (i: number): void => { exemptions.value = exemptions.value.filter((_, j) => j !== i); };
</script>

<template>
    <div class="list">
        <div v-for="(e, i) in exemptions" :key="e.id" class="exemption" :class="{ matched: matched && matched === e.name }">
            <div class="top">
                <i class="ph-duotone ph-shield-check kind" />
                <input v-model="e.name" class="input mono name" placeholder="kafka-connect-internals" autocomplete="off" aria-label="Exemption name">
                <span v-if="matched && matched === e.name" class="hit"><i class="ph-duotone ph-check-circle" />matched</span>
                <button type="button" class="btn btn-ghost icon btn-danger" title="Delete" aria-label="Delete exemption" @click="remove(i)"><i class="ph-duotone ph-trash" /></button>
            </div>
            <input v-model="e.description" class="input desc" placeholder="Why this case is allowed" autocomplete="off" aria-label="Exemption description">
            <CelEditor :key="target.type + target.scope" v-model="e.expression" placeholder='principal == "User:kafka-connect"' :completions="completions" />
            <p v-if="issues.has(e.id)" class="field-error">{{ issues.get(e.id) }}</p>
            <ExpressionHelp />
        </div>
        <div class="add">
            <button type="button" class="btn btn-secondary" @click="add"><i class="ph-duotone ph-plus" />Exemption</button>
        </div>
    </div>
</template>

<style scoped>
.list { display: flex; flex-direction: column; gap: 8px; }
.exemption { border: 1px solid var(--chrome-line); border-radius: var(--radius-md); padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
.exemption.matched { border-color: var(--success); }
.top { display: flex; align-items: center; gap: 8px; }
.kind { color: var(--muted); font-size: 16px; }
.name { flex: 1; max-width: 320px; font-size: 13px; }
.desc { font-size: 13px; }
.hit { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--success); margin-left: auto; }
.top .btn-danger { margin-left: auto; }
.hit + .btn-danger { margin-left: 0; }
.icon { padding: 4px 6px; font-size: 13px; }
.field-error { font-size: 11.5px; color: var(--error); margin: 0; }
.add .btn { font-size: 12.5px; padding: 4px 10px; }
</style>
