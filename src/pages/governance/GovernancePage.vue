<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppToast from '@/components/AppToast.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import CelCode from './components/CelCode.vue';
import PatternTable from './components/PatternTable.vue';
import SubRuleTree from './components/SubRuleTree.vue';
import TestTopicDrawer from './components/TestTopicDrawer.vue';
import { checkGlobalExemption, checkRule, referencesVariable } from './lib/cel';
import { patternsFor, variablePatternRows } from './lib/patterns';
import { operationOptions, resourceDef, resources, targetLabel, topicScopes, type ResourceType } from './lib/resources';
import { checksOf, ruleExpressions, targetOf } from './lib/rules';
import { useDeleteExemption, useDeleteRule, useDeleteVariable, useGovernanceDocument } from './queries';
import type { GovernanceExemption, GovernanceRule, GovernanceVariable } from './lib/types';

type Tab = 'rules' | 'variables' | 'exemptions';
/// A topic rule running on create alone shows no operations, as before alter and delete existed.
const onCreateOnly = (rule: { operations: string[] }): boolean => rule.operations.length === 1 && rule.operations[0] === 'create';
const tabList: { value: Tab; label: string }[] = [
    { value: 'rules', label: 'Rules' },
    { value: 'variables', label: 'Variables' },
    { value: 'exemptions', label: 'Global exemptions' },
];

/// The active tab lives in the URL so it is shareable, per the ui store's note.
const route = useRoute();
const router = useRouter();
const tab = computed<Tab>({
    get: () => tabList.some((t) => t.value === route.query.tab) ? route.query.tab as Tab : 'rules',
    set: (next) => { void router.replace({ query: { ...route.query, tab: next === 'rules' ? undefined : next } }); },
});

// ── Document: rules and global exemptions from the gateway, variables still mocked ──
const { query, doc } = useGovernanceDocument();
const deleteVariable = useDeleteVariable();
const deleteRule = useDeleteRule();
const deleteExemption = useDeleteExemption();

const toastOpen = ref(false);
const toast = ref<{ ok: boolean; text: string } | null>(null);
const notify = (ok: boolean, text: string): void => {
    toast.value = { ok, text };
    toastOpen.value = true;
};

// ── Rows ──
const references = (rule: GovernanceRule, name: string): boolean =>
    ruleExpressions(rule).some((e) => referencesVariable(e, name));
const usedBy = (name: string): number => doc.value.rules.filter((r) => references(r, name)).length;

/// Rules list filter by resource kind, kept in the URL; "New rule" starts on that kind.
const resourceFilter = computed<ResourceType | null>({
    get: () => resources.find((r) => r.type === route.query.resource)?.type ?? null,
    set: (next) => { void router.replace({ query: { ...route.query, resource: next ?? undefined } }); },
});
const resourceCounts = computed(() => resources
    .map((r) => ({ ...r, count: doc.value.rules.filter((x) => x.resourceType === r.type).length }))
    .filter((r) => r.count > 0 || r.type === resourceFilter.value));

const ruleRows = computed(() => doc.value.rules
    .filter((rule) => !resourceFilter.value || rule.resourceType === resourceFilter.value)
    .map((rule) => ({
        rule,
        resource: resourceDef(rule.resourceType),
        everyResource: rule.selector.trim() === 'true' || !rule.selector.trim(),
        valid: ((c) => c.selector.ok && c.issues.size === 0)(checkRule(rule, doc.value.variables)),
        every: targetLabel(targetOf(rule)),
        scope: rule.resourceType === 'topic'
            ? [topicScopes.find((s) => s.value === rule.scope)!.label, onCreateOnly(rule) ? null : operationOptions.map((o) => o.value).filter((o) => rule.operations.includes(o)).join(' + ')]
                .filter(Boolean).join(' · ')
            : null,
        /// A rule that is one check reads like before; anything else shows the tree.
        single: rule.subRules.length === 1 && rule.subRules[0]!.kind === 'check' ? rule.subRules[0]! : null,
        patterns: patternsFor(checksOf(rule.subRules).map((c) => c.expression), doc.value.variables),
    })));

const variableNames = computed(() => doc.value.variables.map((v) => v.name));
const invalidGlobal = computed(() => new Set(doc.value.exemptions
    .filter((e) => !checkGlobalExemption(e.expression, doc.value.variables).ok).map((e) => e.id)));

const variableRows = computed(() => doc.value.variables.map((variable) => ({
    variable,
    rules: doc.value.rules.filter((r) => references(r, variable.name)),
    patterns: variablePatternRows(variable),
})));

// ── Editors ──
const testOpen = ref(false);

const openRule = (rule: GovernanceRule | null): void => {
    void router.push(rule
        ? { name: 'governance-rule-edit', params: { id: rule.id } }
        : { name: 'governance-rule-new', query: resourceFilter.value ? { resource: resourceFilter.value } : {} });
};
const openVariable = (variable: GovernanceVariable | null): void => {
    void router.push(variable ? { name: 'governance-variable-edit', params: { id: variable.id } } : { name: 'governance-variable-new' });
};
const openExemption = (exemption: GovernanceExemption | null): void => {
    void router.push(exemption ? { name: 'governance-exemption-edit', params: { id: exemption.id } } : { name: 'governance-exemption-new' });
};

const newLabel = computed(() => ({ rules: 'New rule', variables: 'New variable', exemptions: 'New global exemption' })[tab.value]);
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
        return n ? `${n} ${n === 1 ? 'rule references' : 'rules reference'} it, so the gateway will refuse the delete.` : 'No rule references it.';
    }
    if (t.kind === 'exemptions') return 'Requests it covered are evaluated against every rule again.';
    return 'Topics are no longer checked against it.';
});

const confirmDelete = async (): Promise<void> => {
    const t = target.value;
    if (!t) return;
    target.value = null;
    try {
        if (t.kind === 'rules') await deleteRule.mutateAsync(t.name);
        else if (t.kind === 'variables') await deleteVariable.mutateAsync(t.name);
        else await deleteExemption.mutateAsync(t.name);
        notify(true, `Deleted ${t.name}. The gateway applied it.`);
    } catch (cause) {
        notify(false, cause instanceof Error ? cause.message : `Could not delete ${t.name}.`);
    }
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
                    <i class="ph-duotone ph-flask" />Test a resource
                </button>
                <button class="btn btn-primary" @click="openNew">
                    <i class="ph-duotone ph-plus" />{{ newLabel }}
                </button>
            </div>
        </div>

        <div class="stat-strip">
            <div class="stat"><div class="stat-label">Rules</div><div class="stat-value">{{ doc.rules.length }}</div></div>
            <div class="stat"><div class="stat-label">Variables</div><div class="stat-value">{{ doc.variables.length }}</div></div>
            <div class="stat"><div class="stat-label">Global exemptions</div><div class="stat-value">{{ doc.exemptions.length }}</div></div>
        </div>

        <p v-if="query.isPending.value" class="loading" role="status">Loading governance from the gateway…</p>
        <p v-else-if="query.error.value" class="load-error">
            <i class="ph-duotone ph-warning-circle" />Could not load governance: {{ query.error.value.message }}
        </p>

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
            <div class="filters" role="group" aria-label="Filter rules by resource">
                <button class="chip" :class="{ on: !resourceFilter }" @click="resourceFilter = null">All <span>{{ doc.rules.length }}</span></button>
                <button
                    v-for="r in resourceCounts"
                    :key="r.type"
                    class="chip"
                    :class="{ on: resourceFilter === r.type }"
                    @click="resourceFilter = r.type"
                ><i :class="['ph-duotone', r.icon]" />{{ r.label }} <span>{{ r.count }}</span></button>
            </div>
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
                    <span class="resource"><i :class="['ph-duotone', row.resource.icon]" />{{ row.resource.label }}<span v-if="row.scope" class="scope">· {{ row.scope.toLowerCase() }}</span></span>
                    <span v-if="row.everyResource" class="every">every {{ row.every }}</span>
                    <CelCode v-else class="selector" :code="row.rule.selector" :variables="variableNames" />
                </div>
                <p v-if="row.rule.description" class="rule-message">{{ row.rule.description }}</p>
                <p v-if="row.rule.errorMessage" class="rule-error"><span class="eyebrow">Refuses with</span>{{ row.rule.errorMessage }}</p>
                <CelCode v-if="row.single" class="code-block" :code="row.single.expression" :variables="variableNames" />
                <SubRuleTree v-else class="code-block" :combinator="row.rule.combinator" :nodes="row.rule.subRules" :variables="variableNames" />
                <div v-if="row.rule.exemptions.length" class="rule-exemptions">
                    <span class="eyebrow">Exempt when</span>
                    <div v-for="e in row.rule.exemptions" :key="e.id" class="exemption-line">
                        <span class="mono exemption-name"><i class="ph-duotone ph-shield-check" />{{ e.name }}</span>
                        <CelCode class="exemption-code" :code="e.expression" :variables="variableNames" />
                    </div>
                </div>
                <div v-if="row.patterns.length" class="rule-patterns">
                    <PatternTable v-for="p in row.patterns" :key="p.variable" :variable="p.variable" :rows="p.rows" />
                </div>
            </article>
            <div v-if="!ruleRows.length && query.isSuccess.value" class="empty">No rules{{ resourceFilter ? ' for ' + resourceDef(resourceFilter).label.toLowerCase() + 's' : '' }}. Every request is allowed.</div>
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
            <div v-if="!variableRows.length && query.isSuccess.value" class="empty">No variables.</div>
        </div>

        <!-- Exemptions -->
        <div v-else class="rule-list">
            <p class="tab-note">A global exemption skips <b>every</b> rule for a request when its expression is true. To skip one rule only, add an exemption on that rule.</p>
            <article v-for="exemption in doc.exemptions" :key="exemption.id" class="rule-card">
                <header class="rule-top">
                    <span class="mono rule-title">{{ exemption.name }}</span>
                    <span v-if="invalidGlobal.has(exemption.id)" class="validity warn">
                        <i class="ph-duotone ph-warning-circle" />Does not type-check
                    </span>
                    <div class="actions">
                        <button class="btn btn-ghost" @click="openExemption(exemption)">Edit</button>
                        <button class="btn btn-ghost btn-danger" @click="target = { kind: 'exemptions', id: exemption.id, name: exemption.name }">Delete</button>
                    </div>
                </header>
                <p v-if="exemption.description" class="rule-message">{{ exemption.description }}</p>
                <CelCode class="code-block" :code="exemption.expression" :variables="variableNames" />
            </article>
            <div v-if="!doc.exemptions.length && query.isSuccess.value" class="empty">No exemptions. Every principal is checked against every rule.</div>
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

.loading { color: var(--muted); margin: 16px 0 0; }
.load-error { display: flex; align-items: center; gap: 6px; color: var(--color-accent-2-700); margin: 16px 0 0; }

.view-tabs { margin: 20px 0 16px; }

.warn { color: var(--warning); }
.muted { color: var(--muted); }

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
.filters { display: flex; flex-wrap: wrap; gap: 6px; }
.chip {
    display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; font-size: 12.5px; cursor: pointer;
    border: 1px solid var(--chrome-line); border-radius: 999px; background: transparent; color: var(--color-text);
}
.chip span { color: var(--muted); font-size: 11.5px; }
.chip.on { border-color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 12%, transparent); }
.resource {
    display: inline-flex; align-items: center; gap: 5px; font-size: 12px; padding: 1px 8px;
    border: 1px solid var(--chrome-line); border-radius: 999px; flex: none;
}
.resource .scope { color: var(--muted); }
.every { font-size: 13px; color: var(--muted); }
.rule-error { display: flex; align-items: baseline; gap: 10px; margin: 6px 0 0; font-size: 13px; color: var(--muted); max-width: 90ch; }
.rule-patterns { margin-top: 10px; }
.rule-exemptions { margin-top: 10px; display: flex; flex-direction: column; gap: 4px; }
.exemption-line { display: grid; grid-template-columns: minmax(120px, max-content) minmax(0, 1fr); gap: 12px; font-size: 12.5px; align-items: baseline; }
.exemption-name { display: inline-flex; align-items: center; gap: 4px; font-weight: 600; }
.exemption-name i { color: var(--success); }
.tab-note { margin: 0; font-size: 13px; color: var(--muted); max-width: 80ch; }
.unused { color: var(--warning); }


.actions { text-align: right; vertical-align: top; }
.actions > * + * { margin-left: 6px; }
.actions .btn { font-size: 12.5px; }
.empty { color: var(--muted); font-style: italic; padding: var(--space-5) 0; }
</style>
