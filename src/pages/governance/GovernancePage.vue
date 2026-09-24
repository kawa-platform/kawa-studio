<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppToast from '@/components/AppToast.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import CelCode from './components/CelCode.vue';
import PatternTable from './components/PatternTable.vue';
import TestTopicDrawer from './components/TestTopicDrawer.vue';
import { checkExpression, referencesVariable } from './lib/cel';
import { patternsForRule, variablePatternRows } from './lib/patterns';
import { useGovernanceStore } from './lib/store';
import { storeToRefs } from 'pinia';
import type { GovernanceExemption, GovernanceRule, GovernanceVariable } from './lib/types';

type Tab = 'rules' | 'variables' | 'exemptions';
const tabList: { value: Tab; label: string }[] = [
    { value: 'rules', label: 'Rules' },
    { value: 'variables', label: 'Variables' },
    { value: 'exemptions', label: 'Exemptions' },
];

/// The active tab lives in the URL so it is shareable, per the ui store's note.
const route = useRoute();
const router = useRouter();
const tab = computed<Tab>({
    get: () => tabList.some((t) => t.value === route.query.tab) ? route.query.tab as Tab : 'rules',
    set: (next) => { void router.replace({ query: { ...route.query, tab: next === 'rules' ? undefined : next } }); },
});

// ── Document state (shared with the rule editor page; mock until GET/PUT /governance exist) ──
const store = useGovernanceStore();
const { doc, applied, dirty } = storeToRefs(store);

const toastOpen = ref(false);
const toast = ref<{ ok: boolean; text: string } | null>(null);
const notify = (ok: boolean, text: string): void => {
    toast.value = { ok, text };
    toastOpen.value = true;
};

const save = (apply: boolean): void => {
    store.save(apply);
    notify(true, apply
        ? `${doc.value.rules.length} rules and ${doc.value.exemptions.length} exemptions are live in the gateway.`
        : 'Saved. The running gateway may not have applied it yet.');
};

const discard = (): void => {
    store.discard();
    notify(true, 'Edits discarded.');
};

// ── Rows ──
const usedBy = (name: string): number =>
    doc.value.rules.filter((r) => referencesVariable(r.expression, name) || referencesVariable(r.selector, name)).length;

const ruleRows = computed(() => doc.value.rules.map((rule) => ({
    rule,
    everyTopic: rule.selector.trim() === 'true' || !rule.selector.trim(),
    valid: checkExpression(rule.expression, doc.value.variables).ok && checkExpression(rule.selector || 'true', doc.value.variables).ok,
    patterns: patternsForRule(rule.expression, doc.value.variables),
})));

const variableNames = computed(() => doc.value.variables.map((v) => v.name));

const variableRows = computed(() => doc.value.variables.map((variable) => ({
    variable,
    rules: doc.value.rules.filter((r) => referencesVariable(r.expression, variable.name) || referencesVariable(r.selector, variable.name)),
    patterns: variablePatternRows(variable),
})));

// ── Editors ──
const testOpen = ref(false);

const openRule = (rule: GovernanceRule | null): void => {
    void router.push(rule ? { name: 'governance-rule-edit', params: { id: rule.id } } : { name: 'governance-rule-new' });
};
const openVariable = (variable: GovernanceVariable | null): void => {
    void router.push(variable ? { name: 'governance-variable-edit', params: { id: variable.id } } : { name: 'governance-variable-new' });
};
const openExemption = (exemption: GovernanceExemption | null): void => {
    void router.push(exemption ? { name: 'governance-exemption-edit', params: { id: exemption.id } } : { name: 'governance-exemption-new' });
};

const newLabel = computed(() => ({ rules: 'New rule', variables: 'New variable', exemptions: 'New exemption' })[tab.value]);
const openNew = (): void => {
    if (tab.value === 'rules') openRule(null);
    else if (tab.value === 'variables') openVariable(null);
    else openExemption(null);
};


// ── Delete ──
type Target = { kind: Tab; id: string; name: string };
const target = ref<Target | null>(null);
const deleteOpen = computed({
    get: () => target.value !== null,
    set: (value: boolean) => { if (!value) target.value = null; },
});

const deleteBody = computed(() => {
    const t = target.value;
    if (!t) return '';
    if (t.kind === 'variables') {
        const n = usedBy(t.name);
        return n ? `${n} ${n === 1 ? 'rule references' : 'rules reference'} it and will stop validating.` : 'No rule references it.';
    }
    if (t.kind === 'exemptions') return 'Requests it covered are evaluated against every rule again.';
    return 'Topics are no longer checked against it.';
});

const confirmDelete = (): void => {
    const t = target.value;
    if (!t) return;
    if (t.kind === 'rules') doc.value.rules = doc.value.rules.filter((x) => x.id !== t.id);
    else if (t.kind === 'variables') doc.value.variables = doc.value.variables.filter((x) => x.id !== t.id);
    else doc.value.exemptions = doc.value.exemptions.filter((x) => x.id !== t.id);
    target.value = null;
};
</script>

<template>
    <div>
        <div class="head">
            <div>
                <h1>Governance</h1>
                <p class="lede">
                  Create your own Kafka Resource Convention applied rules for all your Kafka Resources.
                  When creating Resources through Kawa the rules are applied and the creation is either allowed or denied.
                </p>
            </div>
            <div class="head-actions">
                <button class="btn btn-secondary" @click="testOpen = true">
                    <i class="ph-duotone ph-flask" />Test a topic
                </button>
                <button class="btn btn-primary" @click="openNew">
                    <i class="ph-duotone ph-plus" />{{ newLabel }}
                </button>
            </div>
        </div>

        <div class="stat-strip">
            <div class="stat"><div class="stat-label">Rules</div><div class="stat-value">{{ doc.rules.length }}</div></div>
            <div class="stat"><div class="stat-label">Variables</div><div class="stat-value">{{ doc.variables.length }}</div></div>
            <div class="stat"><div class="stat-label">Exemptions</div><div class="stat-value">{{ doc.exemptions.length }}</div></div>
            <div v-if="dirty || !applied" class="save-actions">
                <button v-if="dirty" class="btn btn-ghost" @click="discard">Discard</button>
                <button v-if="dirty" class="btn btn-secondary" @click="save(false)">Save</button>
                <button class="btn btn-primary" @click="save(true)">Save and apply</button>
            </div>
        </div>

        <nav class="view-tabs" aria-label="Governance views">
            <button
                v-for="t in tabList"
                :key="t.value"
                class="tab"
                :class="{ 'tab-on': tab === t.value }"
                @click="tab = t.value"
            >{{ t.label }}</button>
        </nav>

        <!-- Rules -->
        <div v-if="tab === 'rules'" class="rule-list">
            <article v-for="row in ruleRows" :key="row.rule.id" class="rule-card">
                <header class="rule-top">
                    <span class="mono rule-title">{{ row.rule.name }}</span>
                    <span v-if="!row.valid" class="validity warn">
                        <i class="ph-duotone ph-warning-circle" />Does not type-check
                    </span>
                    <div class="actions">
                        <button class="btn btn-ghost" @click="openRule(row.rule)">Edit</button>
                        <button class="btn btn-ghost btn-danger" @click="target = { kind: 'rules', id: row.rule.id, name: row.rule.name }">Delete</button>
                    </div>
                </header>
                <div class="applies">
                    <span class="eyebrow">Applies to</span>
                    <span v-if="row.everyTopic" class="mono selector">every topic</span>
                    <CelCode v-else class="selector" :code="row.rule.selector" :variables="variableNames" />
                </div>
                <p v-if="row.rule.message" class="rule-message">{{ row.rule.message }}</p>
                <CelCode class="code-block" :code="row.rule.expression" :variables="variableNames" />
                <div v-if="row.patterns.length" class="rule-patterns">
                    <PatternTable v-for="p in row.patterns" :key="p.variable" :variable="p.variable" :rows="p.rows" />
                </div>
            </article>
            <div v-if="!ruleRows.length" class="empty">No rules. Every physical topic creation is allowed.</div>
        </div>

        <!-- Variables -->
        <div v-else-if="tab === 'variables'" class="rule-list">
            <article v-for="row in variableRows" :key="row.variable.id" class="rule-card">
                <header class="rule-top">
                    <span class="mono rule-title">{{ row.variable.name }}</span>
                    <span class="tag tag-neutral mono">{{ row.variable.type }}</span>
                    <div class="actions">
                        <button class="btn btn-ghost" @click="openVariable(row.variable)">Edit</button>
                        <button class="btn btn-ghost btn-danger" @click="target = { kind: 'variables', id: row.variable.id, name: row.variable.name }">Delete</button>
                    </div>
                </header>
                <div class="applies">
                    <span class="eyebrow">Used by</span>
                    <span v-if="!row.rules.length" class="unused">no rule</span>
                    <span v-else class="mono selector">{{ row.rules.map((r) => r.name).join(', ') }}</span>
                </div>
                <p v-if="row.variable.note" class="rule-message">{{ row.variable.note }}</p>
                <CelCode class="code-block" :code="row.variable.value" />
                <div v-if="row.patterns" class="rule-patterns">
                    <PatternTable :variable="row.variable.name" :rows="row.patterns" />
                </div>
            </article>
            <div v-if="!variableRows.length" class="empty">No variables.</div>
        </div>

        <!-- Exemptions -->
        <div v-else class="rule-list">
            <article v-for="exemption in doc.exemptions" :key="exemption.id" class="rule-card">
                <header class="rule-top">
                    <span class="mono rule-title">{{ exemption.name }}</span>
                    <div class="actions">
                        <button class="btn btn-ghost" @click="openExemption(exemption)">Edit</button>
                        <button class="btn btn-ghost btn-danger" @click="target = { kind: 'exemptions', id: exemption.id, name: exemption.name }">Delete</button>
                    </div>
                </header>
                <div class="applies">
                    <span class="eyebrow">Principal</span>
                    <span class="mono selector">{{ exemption.principalPattern }}</span>
                </div>
                <div class="applies">
                    <span class="eyebrow">Topic</span>
                    <span class="mono selector">{{ exemption.topicPattern }}</span>
                </div>
            </article>
            <div v-if="!doc.exemptions.length" class="empty">No exemptions. Every principal is checked against every rule.</div>
        </div>

        <TestTopicDrawer v-model:open="testOpen" :document="doc" />

        <ConfirmDialog
            v-model:open="deleteOpen"
            :title="'Delete ' + (target?.name ?? '') + '?'"
            :body="deleteBody"
            confirm-label="Delete"
            danger
            @confirm="confirmDelete"
        />

        <AppToast v-model:open="toastOpen" :ok="toast?.ok ?? true" :text="toast?.text ?? ''" />
    </div>
</template>

<style scoped>
.head { display: flex; align-items: flex-end; gap: 24px; margin-bottom: 20px; }
.head > div:first-child { margin-right: auto; }
.head-actions { display: flex; gap: 8px; }

.save-actions { display: flex; gap: 8px; align-items: center; margin-left: auto; }

.view-tabs { margin: 20px 0 16px; }

.warn { color: var(--warning); }

.rule-list { display: flex; flex-direction: column; gap: 12px; }
.rule-card {
    border: 1px solid var(--chrome-line);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    padding: 14px 16px 16px;
}
.rule-top { display: flex; align-items: center; gap: 8px; }
.rule-title { font-size: 14px; font-weight: 600; margin-right: auto; min-width: 0; overflow-wrap: anywhere; }
.validity { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; margin-right: 6px; white-space: nowrap; }
.applies { display: flex; align-items: baseline; gap: 10px; margin-top: 10px; font-size: 13px; }
.eyebrow { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); flex: none; }
.selector { font-size: 13px; }
.selector, .selector :deep(span) { color: var(--code-pink); }
.rule-message { margin: 10px 0 0; font-size: 14.5px; line-height: 1.55; color: var(--color-text); max-width: 80ch; }
.code-block {
    display: block;
    margin-top: 12px;
    padding: 10px 12px;
    font-size: 12.5px;
    line-height: 1.55;
    border: 1px solid var(--chrome-line);
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--color-text) 3%, transparent);
}
.rule-patterns { margin-top: 10px; }
.unused { color: var(--warning); }


.actions { text-align: right; vertical-align: top; }
.actions > * + * { margin-left: 6px; }
.actions .btn { font-size: 12.5px; }
.empty { color: var(--muted); font-style: italic; padding: var(--space-5) 0; }
</style>
