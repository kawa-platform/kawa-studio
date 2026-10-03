<script setup lang="ts">
import { computed, provide, reactive, ref, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CelEditor from '../clusters/components/CelEditor.vue';
import CelCode from './components/CelCode.vue';
import CombinatorToggle from './components/CombinatorToggle.vue';
import ResourcePicker from './components/ResourcePicker.vue';
import SegPicker from './components/SegPicker.vue';
import RuleExemptionList from './components/RuleExemptionList.vue';
import SubRuleList from './components/SubRuleList.vue';
import ExpressionHelp from './components/ExpressionHelp.vue';
import ReferencePanel from './components/ReferencePanel.vue';
import { CEL_INSERT, REFERENCE_PANEL, type CelInsertTarget } from './lib/reference';
import { checkRule, outcomesOf } from './lib/cel';
import { toDryRunRequest } from './lib/dryRun';
import {
    initialTestValues, operationOptions, type Operation, resourceCompletions, resourceDef, resources, targetLabel, testFieldsFor, topicScopes,
    type ResourceType, type TestValues, type TopicKind,
} from './lib/resources';
import { cloneRule, compileRule, newCheck, targetOf } from './lib/rules';
import { useDryRun, useGovernanceDocument, useSaveRule } from './queries';
import type { GovernanceRule } from './lib/types';

const route = useRoute();
const router = useRouter();
const { query, doc } = useGovernanceDocument();
const save = useSaveRule();

const ruleId = computed(() => route.params.id as string | undefined);
const existing = computed(() => (ruleId.value ? doc.value.rules.find((r) => r.id === ruleId.value) ?? null : null));
const isEdit = computed(() => !!ruleId.value);

const blank = (): GovernanceRule => ({
    id: 'r' + Date.now(), name: '', description: '', errorMessage: '', selector: 'true',
    resourceType: resources.some((r) => r.type === route.query.resource) ? route.query.resource as ResourceType : 'topic',
    scope: 'both', operations: ['create'], combinator: 'all', subRules: [newCheck()], exemptions: [],
});
const draft = ref<GovernanceRule>(existing.value ? cloneRule(existing.value) : blank());
/// Opened by URL before the gateway answered: take the rule once it arrives, but never
/// overwrite edits already made.
const loaded = ref(!!existing.value || !isEdit.value);
watch(existing, (rule) => {
    if (rule && !loaded.value) {
        draft.value = cloneRule(rule);
        loaded.value = true;
    }
});

/// Expanded sub-rows, shared by every level of the tree. A new rule opens its first row.
const open = reactive(new Set<string>(isEdit.value ? [] : draft.value.subRules.map((n) => n.id)));
provide('subRuleOpen', open);

const variables = computed(() => doc.value.variables);

const resource = computed(() => resourceDef(draft.value.resourceType));
const target = computed(() => targetOf(draft.value));
const targetName = computed(() => targetLabel(target.value));

/// Completions: only the context variable of the chosen resource kind, plus every
/// declared variable, typed.
const completions = computed(() => [
    ...resourceCompletions(target.value),
    ...variables.value.map((v) => ({ label: v.name, type: 'constant', detail: v.type })),
]);

const nameError = computed(() => {
    const name = draft.value.name.trim();
    if (!name) return null;
    if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) return 'Lowercase letters, digits and hyphens.';
    const taken = doc.value.rules.some((r) => r.name === name && r.id !== draft.value.id);
    return taken ? 'Another rule has this name.' : null;
});

/// A hint replaces the default "true", otherwise joins the existing condition with &&.
const addCondition = (code: string): void => {
    const current = draft.value.selector.trim();
    draft.value.selector = !current || current === 'true' ? code : `${current} && ${code}`;
};

// ── Reference panel: docked beside the editor on wide screens, a drawer on narrow ones ──
const REFERENCE_KEY = 'kawa-governance-reference';
const storedReference = (): boolean | null => {
    try {
        const v = localStorage.getItem(REFERENCE_KEY);
        return v === null ? null : v === 'open';
    } catch {
        return null;
    }
};
/// The form is showing: a new rule, or an existing one that loaded.
const editing = computed(() => !isEdit.value || (!query.isPending.value && !query.error.value && loaded.value));
const referenceOpen = ref<boolean>(storedReference() ?? window.matchMedia('(min-width: 1200px)').matches);
watch(referenceOpen, (open) => {
    try {
        localStorage.setItem(REFERENCE_KEY, open ? 'open' : 'closed');
    } catch {
        // the panel still works, it just isn't remembered
    }
});
provide(REFERENCE_PANEL, { open: referenceOpen, show: () => { referenceOpen.value = true; } });

/// The expression editor the user last focused; the panel inserts there.
const insertTarget = shallowRef<CelInsertTarget | null>(null);
provide(CEL_INSERT, {
    focused: (t) => { insertTarget.value = t; },
    gone: (t) => { if (insertTarget.value === t) insertTarget.value = null; },
});
const copied = ref<string | null>(null);
let copiedTimer: ReturnType<typeof setTimeout> | undefined;
/// Inserts at the last focused editor; before one was focused, an example condition goes to
/// "When" and anything else is copied to the clipboard.
const insertFromReference = async (code: string, example: boolean): Promise<void> => {
    if (insertTarget.value) {
        insertTarget.value.insert(code);
        return;
    }
    if (example) {
        addCondition(code);
        return;
    }
    try {
        await navigator.clipboard.writeText(code);
        copied.value = code;
        clearTimeout(copiedTimer);
        copiedTimer = setTimeout(() => { copied.value = null; }, 2500);
    } catch {
        copied.value = null;
    }
};

const checked = computed(() => checkRule(draft.value, variables.value));
const selectorCheck = computed(() => checked.value.selector);
const issues = computed(() => checked.value.issues);
const exemptionIssues = computed(() => checked.value.exemptions);
const compiled = computed(() => compileRule(draft.value));
const variableNames = computed(() => variables.value.map((v) => v.name));

/// Topic rules run on create, alter, or both; at least one.
const toggleOperation = (op: Operation): void => {
    const ops = draft.value.operations;
    draft.value.operations = ops.includes(op) ? ops.filter((o) => o !== op) : [...ops, op];
};
const runsOnAlter = computed(() => draft.value.resourceType === 'topic' && draft.value.operations.includes('alter'));
const runsOnDelete = computed(() => draft.value.resourceType === 'topic' && draft.value.operations.includes('delete'));

const isValid = computed(() =>
    !!draft.value.name.trim() && !nameError.value && !!draft.value.errorMessage.trim() &&
    !!draft.value.description.trim() && selectorCheck.value.ok &&
    (draft.value.resourceType !== 'topic' || draft.value.operations.length > 0) &&
    draft.value.subRules.length > 0 && issues.value.size === 0 && exemptionIssues.value.size === 0);

// ── Inline test: evaluates the unsaved draft on every keystroke ──
/// One set of inputs per resource kind, so switching kinds keeps what was typed.
const testValues = reactive(Object.fromEntries(resources.map((r) => [r.type, initialTestValues(r.type)])) as Record<ResourceType, TestValues>);
const test = computed(() => testValues[draft.value.resourceType]);
/// Which topic kind to test as; fixed by the scope unless the rule covers both.
const pickedKind = ref<TopicKind>('physical');
const testKind = computed<TopicKind>(() => (target.value.scope === 'both' ? pickedKind.value : target.value.scope));
const kindOptions: { value: TopicKind; label: string }[] = [{ value: 'physical', label: 'Physical' }, { value: 'virtual', label: 'Virtual' }];
/// Which request to test as; limited to the operations the rule runs on.
const pickedOperation = ref<Operation>('create');
const testOperation = computed<Operation>(() => (draft.value.operations.includes(pickedOperation.value)
    ? pickedOperation.value : draft.value.operations[0] ?? 'create'));
const testOperationOptions = computed(() => operationOptions.filter((o) => draft.value.operations.includes(o.value)));
/// On alter the fields describe the topic as it will be after the change.
const testFields = computed(() => testFieldsFor(draft.value.resourceType, testKind.value));
/// Who is asking, for exemptions; shared across resource kinds.
const caller = reactive({ principal: 'User:app-cargo', service: '' });
const testName = computed(() => String(test.value[resource.value.test[0]!.key] ?? '').trim());
/// The gateway evaluates the unsaved draft against its stored variables, shortly after the
/// inputs settle; the local type check above keeps obviously broken drafts from being sent.
const dryRunRequest = computed(() => {
    if (!testName.value || issues.value.size || exemptionIssues.value.size || !selectorCheck.value.ok) return null;
    return toDryRunRequest({
        type: draft.value.resourceType, operation: testOperation.value,
        values: { ...test.value, virtual: testKind.value === 'virtual' },
        principal: caller.principal.trim(), service: caller.service.trim(),
    }, draft.value);
});
const dryRun = useDryRun(dryRunRequest, computed(() => [draft.value]));
const trace = computed(() => {
    const result = dryRun.result.value;
    if (!result) return null;
    return result.trace[0] ?? { rule: draft.value, outcome: 'skipped' as const, nodes: [] };
});
const outcomes = computed(() => (trace.value ? outcomesOf(trace.value.nodes) : null));

/// Under "any", the branch that let the topic through, e.g. app › standard.
const passedVia = computed(() => {
    if (!trace.value || draft.value.combinator !== 'any') return [];
    const path: string[] = [];
    let level = trace.value.nodes;
    for (;;) {
        const hit = level.find((n) => n.outcome === 'pass');
        if (!hit) break;
        path.push(hit.node.name);
        if (hit.node.kind !== 'group' || hit.node.combinator !== 'any') break;
        level = hit.children ?? [];
    }
    return path;
});

const back = (): void => { void router.push({ name: 'governance' }); };

/// The gateway's 400 message, e.g. "governance rule 'x': subRules[app].expression: …".
const saveError = ref<string | null>(null);

const submit = async (): Promise<void> => {
    if (!isValid.value || save.isPending.value) return;
    saveError.value = null;
    try {
        await save.mutateAsync({ rule: cloneRule(draft.value), previousName: existing.value?.name });
        back();
    } catch (cause) {
        saveError.value = cause instanceof Error ? cause.message : 'Could not save the rule.';
    }
};
</script>

<template>
    <div class="layout" :class="{ docked: referenceOpen && editing }">
    <div class="wrap">
        <div class="head">
            <div class="title-row">
                <h1>{{ isEdit ? 'Edit rule' : 'New rule' }}</h1>
                <button
                    v-if="editing" type="button" class="btn btn-secondary reference-toggle"
                    :aria-pressed="referenceOpen" @click="referenceOpen = !referenceOpen"
                >
                    <i class="ph-duotone ph-book-open-text" />{{ referenceOpen ? 'Hide reference' : 'Reference' }}
                </button>
            </div>
            <p class="lede">
              Rules are evaluated by Kawa on the kafka network protocol when creating or modifying physical and virtual topics.
              They can be used to enforce naming conventions, partition tiers, replication factors, cleanup policies, and other topic properties.
            </p>
        </div>

        <p v-if="isEdit && query.isPending.value" class="hint" role="status">Loading the rule from the gateway…</p>
        <p v-else-if="isEdit && query.error.value" class="error">Could not load governance: {{ query.error.value.message }}</p>
        <p v-else-if="isEdit && !loaded" class="error">Rule does not exist.</p>

        <template v-else>
            <section>
                <h2>1 · Identity</h2>
                <div class="field">
                    <label for="rule-name">Name</label>
                    <input id="rule-name" v-model="draft.name" class="input mono" placeholder="partition-tier" autocomplete="off">
                    <p v-if="nameError" class="field-error">{{ nameError }}</p>
                    <p v-else class="hint">Returned to the client when the rule refuses a request.</p>
                </div>
                <div class="field">
                    <label for="rule-error-message">Error message</label>
                    <textarea id="rule-error-message" v-model="draft.errorMessage" class="input" rows="2" />
                    <p class="hint">Returned to the client with the 403.</p>
                </div>
              <div class="field">
                <label for="rule-description">Description</label>
                <textarea id="rule-description" v-model="draft.description" class="input" rows="2" />
                <p class="hint">Serves as documentation of the rule.</p>
              </div>
            </section>

            <section>
                <h2>2 · Applies to</h2>
                <div class="field">
                    <label>Resource</label>
                    <ResourcePicker v-model="draft.resourceType" />
                </div>
                <div v-if="draft.resourceType === 'topic'" class="field">
                    <label>Topics</label>
                    <SegPicker v-model="draft.scope" :options="topicScopes" label="Which topics" />
                </div>
                <div v-if="draft.resourceType === 'topic'" class="field">
                    <label>Runs on</label>
                    <div class="seg" role="group" aria-label="Requests the rule runs on">
                        <button
                            v-for="o in operationOptions"
                            :key="o.value"
                            type="button"
                            class="seg-opt"
                            :aria-pressed="draft.operations.includes(o.value)"
                            :data-state="draft.operations.includes(o.value) ? 'active' : 'inactive'"
                            @click="toggleOperation(o.value)"
                        ><i :class="['ph-duotone', draft.operations.includes(o.value) ? 'ph-check-square' : 'ph-square']" />{{ o.label }}</button>
                    </div>
                    <p v-if="!draft.operations.length" class="field-error">Pick at least one.</p>
                    <p v-else-if="runsOnAlter || runsOnDelete" class="hint">
                        <template v-if="runsOnAlter">Alter covers config changes and adding partitions; the rule sees the topic as it will be after the change.</template>
                        <template v-if="runsOnDelete"> On delete it sees the topic as it is; the rule must hold for the topic to be deleted.</template>
                    </p>
                </div>
                <div class="field">
                    <label>When <span class="optional">optional</span></label>
                    <CelEditor :key="draft.resourceType + draft.scope" v-model="draft.selector" placeholder="true" :completions="completions" />
                    <p v-if="!selectorCheck.ok" class="field-error">{{ selectorCheck.error }}</p>
                    <ExpressionHelp>
                        <span v-if="selectorCheck.ok"><code>true</code> = every {{ targetName }}.</span>
                    </ExpressionHelp>
                </div>
            </section>

            <section>
                <div class="section-head">
                    <h2>3 · Sub-rules</h2>
                    <span class="match">Pass when</span>
                    <CombinatorToggle v-model="draft.combinator" label="Combine the rule's sub-rules" />
                    <span class="match">hold</span>
                </div>
                <p class="hint lead">
                    Each sub-rule is a standalone check, or a group of checks combined with <b>all</b> (AND) or <b>any</b> (OR). Groups can't contain groups.
                </p>
                <SubRuleList
                    v-model:nodes="draft.subRules"
                    :combinator="draft.combinator"
                    :variables="variables"
                    :completions="completions"
                    :target="target"
                    :issues="issues"
                    :outcomes="outcomes"
                />
                <p v-if="!draft.subRules.length" class="field-error">Add at least one sub-rule.</p>
                <details class="compiled">
                    <summary>Equivalent CEL expression</summary>
                    <CelCode class="code-block" :code="compiled" :variables="variableNames" />
                </details>
            </section>

            <section>
                <h2>4 · Exemptions</h2>
                <p class="hint lead">
                    When any exemption is true for a request, this rule is skipped for it; other rules still apply.
                    An exemption that fails to evaluate does not apply. Exemptions for every rule live under Global exemptions.
                </p>
                <RuleExemptionList
                    v-model="draft.exemptions"
                    :target="target"
                    :variables="variables"
                    :completions="completions"
                    :issues="exemptionIssues"
                    :matched="trace?.exemptedBy"
                />
            </section>

            <section>
                <h2>5 · Test</h2>
                <div v-if="target.type === 'topic' && target.scope === 'both'" class="field">
                    <label>Test as</label>
                    <SegPicker v-model="pickedKind" :options="kindOptions" label="Topic kind to test" />
                </div>
                <div v-if="target.type === 'topic' && testOperationOptions.length > 1" class="field">
                    <label>Request</label>
                    <SegPicker v-model="pickedOperation" :options="testOperationOptions" label="Request to test" />
                </div>
                <div class="test-grid">
                    <div class="field wide2"><label for="t-principal">Principal</label><input id="t-principal" v-model="caller.principal" class="input mono" autocomplete="off"></div>
                    <div class="field wide2"><label for="t-service">Service</label><input id="t-service" v-model="caller.service" class="input mono" autocomplete="off"></div>
                    <div v-for="(f, i) in testFields" :key="resource.type + f.key" class="field" :class="{ wide: i === 0 }">
                        <label :for="'t-' + f.key">{{ f.label }}</label>
                        <input
                            :id="'t-' + f.key"
                            v-model="test[f.key]"
                            :type="f.kind === 'int' ? 'number' : 'text'"
                            class="input"
                            :class="{ mono: f.mono }"
                            autocomplete="off"
                        >
                    </div>
                </div>
                <p v-if="!testName" class="hint">Enter a {{ resource.test[0]!.label.toLowerCase() }} to see every sub-rule pass or fail above.</p>
                <p v-else-if="!dryRunRequest" class="hint">Fix the problems above to run the test.</p>
                <p v-else-if="dryRun.query.error.value" class="save-error" role="alert">
                    <i class="ph-duotone ph-warning-circle" />The gateway could not evaluate the draft: {{ dryRun.query.error.value.message }}
                </p>
                <p v-else-if="!trace" class="hint" role="status">Asking the gateway…</p>
                <div v-else class="verdict" :class="trace.outcome">
                    <template v-if="trace.outcome === 'skipped'">
                        <i class="ph-duotone ph-minus-circle" />Does not apply: the condition is false for this {{ testKind === 'virtual' && target.type === 'topic' ? 'virtual topic' : resource.singular }}.
                    </template>
                    <template v-else-if="trace.outcome === 'exempted'">
                        <i class="ph-duotone ph-shield-check" />Skipped: exemption<span class="mono">&nbsp;{{ trace.exemptedBy }}</span>&nbsp;matched.
                    </template>
                    <template v-else-if="trace.outcome === 'pass'">
                        <i class="ph-duotone ph-check-circle" />Allowed<span v-if="passedVia.length" class="mono">&nbsp;via {{ passedVia.join(' › ') }}</span>
                    </template>
                    <template v-else>
                        <i class="ph-duotone ph-x-circle" />
                        <span>
                            Refused<span v-if="trace.path?.length" class="mono">&nbsp;by {{ trace.path.join(' › ') }}</span>
                            <span class="verdict-msg">{{ trace.detail ?? trace.message }}</span>
                        </span>
                    </template>
                </div>
            </section>

            <div class="actions">
                <button class="btn btn-primary" :disabled="!isValid || save.isPending.value" @click="submit">
                    <i class="ph-duotone ph-check" />{{ save.isPending.value ? 'Saving…' : isEdit ? 'Save changes' : 'Add rule' }}
                </button>
                <button class="btn btn-secondary" @click="back">Cancel</button>
            </div>
            <p v-if="saveError" class="save-error" role="alert"><i class="ph-duotone ph-warning-circle" />{{ saveError }}</p>
            <p class="hint">Saving writes the rule to the gateway and waits until it is applied.</p>
        </template>
    </div>
    <template v-if="referenceOpen && editing">
        <div class="reference-backdrop" aria-hidden="true" @click="referenceOpen = false" />
        <div class="reference">
            <ReferencePanel
                :target="target" :variables="variables" :can-insert="!!insertTarget" :copied="copied"
                @insert="insertFromReference" @close="referenceOpen = false"
            />
        </div>
    </template>
    </div>
</template>

<style scoped>
.layout { display: block; }
.layout.docked { display: grid; grid-template-columns: minmax(0, 760px) minmax(280px, 340px); gap: 28px; align-items: start; }
.wrap { max-width: 760px; min-width: 0; }
.head { margin-bottom: 22px; }
.title-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.title-row h1 { margin: 0; }
.reference-toggle { flex: none; }
.reference { position: sticky; top: 16px; max-height: calc(100vh - 32px); overflow-y: auto; }
.reference-backdrop { display: none; }
/* Too narrow to sit side by side: the reference slides in over the editor. */
@media (max-width: 1199px) {
    .layout.docked { display: block; }
    .reference {
        position: fixed; top: 0; right: 0; bottom: 0; z-index: 40; width: min(360px, 92vw); max-height: none;
        padding: 12px; background: var(--color-bg, var(--color-surface)); box-shadow: var(--shadow-md);
    }
    .reference-backdrop { display: block; position: fixed; inset: 0; z-index: 39; background: color-mix(in srgb, black 25%, transparent); }
}
section { margin-bottom: 30px; }
h2 {
    font-family: var(--font-heading);
    font-size: 15px;
    margin: 0 0 14px;
    padding-left: 10px;
    box-shadow: inset 3px 0 0 var(--brand);
}
.field { margin-bottom: 18px; }
.field > label { display: block; }
.hint { font-size: 11.5px; color: var(--faint); margin: 7px 0 0; max-width: 62ch; }
.hint code { font-family: var(--mono); color: var(--muted); }
.field-error { font-size: 11.5px; color: var(--error); margin: 7px 0 0; }
.check-ok { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--success); margin: 7px 0 0; }
textarea.input { font-family: var(--font-body); font-size: 14px; resize: vertical; }
.actions { display: flex; gap: 8px; }
.save-error { display: flex; align-items: baseline; gap: 6px; margin: 10px 0 0; font-size: 13px; color: var(--error); max-width: 80ch; overflow-wrap: anywhere; }
.save-error.warn { color: var(--warning); }
.section-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.section-head h2 { margin: 0 auto 0 0; }
.match { font-size: 12.5px; color: var(--muted); }
.lead { margin: 0 0 12px; }
.optional { font-size: 11px; color: var(--faint); font-weight: 400; margin-left: 4px; }
.compiled { margin-top: 14px; font-size: 12.5px; }
.compiled summary { cursor: pointer; color: var(--muted); }
.code-block {
    display: block; margin-top: 8px; padding: 10px 12px; font-size: 12.5px; line-height: 1.55;
    border: 1px solid var(--chrome-line); border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--color-text) 3%, transparent);
}
.test-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0 12px; }
.test-grid .wide { grid-column: 1 / -1; }
.test-grid .wide2 { grid-column: span 2; }
.verdict { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border: 1px solid var(--chrome-line); border-radius: var(--radius-md); font-size: 13.5px; }
.verdict i { font-size: 17px; margin-top: 1px; }
.verdict.pass { border-color: var(--success); }
.verdict.pass i { color: var(--success); }
.verdict.fail, .verdict.error { border-color: var(--color-accent-2); }
.verdict.fail i, .verdict.error i { color: var(--color-accent-2-700); }
.verdict.skipped, .verdict.exempted { color: var(--muted); }
.verdict.exempted i { color: var(--success); }
.verdict-msg { display: block; color: var(--muted); font-size: 12.5px; margin-top: 2px; }
.error { color: var(--error); margin-top: 14px; }
kbd { font-family: var(--mono); font-size: 11px; padding: 0 4px; border: 1px solid var(--chrome-line); border-radius: 3px; }
</style>
