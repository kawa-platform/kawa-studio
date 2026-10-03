<script setup lang="ts">
import { computed, inject, reactive } from 'vue';
import CelEditor from '../../clusters/components/CelEditor.vue';
import CelCode from './CelCode.vue';
import CombinatorToggle from './CombinatorToggle.vue';
import ExpressionHelp from './ExpressionHelp.vue';
import PatternTable from './PatternTable.vue';
import type { RuleOutcome } from '../lib/cel';
import { patternsFor } from '../lib/patterns';
import { resourceDef, type Target } from '../lib/resources';
import { combinatorLabel, newCheck, newGroup } from '../lib/rules';
import type { Combinator, GovernanceVariable, SubRule, SubRuleCheck } from '../lib/types';

/// Editable list of sub-rules at one level of the tree. A group renders this component
/// again for its children, so nesting is unbounded.

const nodes = defineModel<SubRule[]>('nodes', { required: true });

const props = defineProps<{
    combinator: Combinator;
    target: Target;
    variables: GovernanceVariable[];
    completions: { label: string; type: string; detail?: string }[];
    /// Sub-rule id → problem, from checkSubRules.
    issues: Map<string, string>;
    /// Sub-rule id → outcome of the inline test; null when nothing is being tested.
    outcomes: Map<string, RuleOutcome> | null;
    depth?: number;
}>();

/// Which checks are expanded; groups always show their name and message. Shared down the
/// tree so a page owns one set.
const open = inject<Set<string>>('subRuleOpen', reactive(new Set<string>()));
const toggle = (id: string): void => { if (open.has(id)) open.delete(id); else open.add(id); };

const names = computed(() => props.variables.map((v) => v.name));
/// Inside a group: only standalone checks, so no new groups and no wrapping.
const nested = computed(() => (props.depth ?? 0) > 0);
const resource = computed(() => resourceDef(props.target.type));

const add = (kind: 'check' | 'group'): void => {
    const node = kind === 'check' ? newCheck() : newGroup();
    nodes.value = [...nodes.value, node];
    if (node.kind === 'group') node.checks.forEach((c) => open.add(c.id));
    else open.add(node.id);
};

const remove = (i: number): void => { nodes.value = nodes.value.filter((_, j) => j !== i); };

const move = (i: number, by: -1 | 1): void => {
    const j = i + by;
    if (j < 0 || j >= nodes.value.length) return;
    const next = [...nodes.value];
    [next[i], next[j]] = [next[j]!, next[i]!];
    nodes.value = next;
};

/// A check can become a group (it moves inside as the first sub-rule), and a group with
/// one check can collapse back into that check.
const wrap = (i: number): void => {
    const node = nodes.value[i]!;
    if (node.kind !== 'check' || nested.value) return;
    const group = newGroup(node.name, props.combinator === 'all' ? 'any' : 'all', [{ ...node, name: node.name || 'first' }]);
    nodes.value = nodes.value.map((n, j) => (j === i ? group : n));
};
const unwrap = (i: number): void => {
    const node = nodes.value[i]!;
    if (node.kind !== 'group' || node.checks.length !== 1) return;
    nodes.value = nodes.value.map((n, j) => (j === i ? node.checks[0]! : n));
};

const badge: Record<RuleOutcome, { icon: string; cls: string; label: string }> = {
    pass: { icon: 'ph-check-circle', cls: 'ok', label: 'pass' },
    fail: { icon: 'ph-x-circle', cls: 'bad', label: 'fail' },
    error: { icon: 'ph-warning-circle', cls: 'warn', label: 'error' },
    skipped: { icon: 'ph-minus-circle', cls: 'skip', label: 'not needed' },
    exempted: { icon: 'ph-shield-check', cls: 'skip', label: 'exempted' },
};
</script>

<template>
    <div class="list" :class="{ nested: (depth ?? 0) > 0 }">
        <div v-if="(depth ?? 0) > 0" class="joiner">{{ combinatorLabel[combinator] }}</div>

        <div
            v-for="(node, i) in nodes"
            :key="node.id"
            class="node"
            :class="[node.kind, outcomes?.get(node.id) ? badge[outcomes.get(node.id)!].cls : '']"
        >
            <div class="node-head" :class="{ clickable: node.kind === 'check' }" @click="node.kind === 'check' && toggle(node.id)">
                <i :class="['ph-duotone', node.kind === 'group' ? 'ph-tree-structure' : 'ph-function', 'kind']" />
                <span class="mono node-name" :class="{ unnamed: !node.name.trim() }">{{ node.name.trim() || 'unnamed' }}</span>
                <template v-if="node.kind === 'group'">
                    <CombinatorToggle v-model="node.combinator" />
                    <span class="count">{{ node.checks.length }} check{{ node.checks.length === 1 ? '' : 's' }}</span>
                </template>
                <CelCode v-else-if="!open.has(node.id)" class="preview" :code="node.expression || '—'" :variables="names" />
                <span class="spacer" />
                <i v-if="issues.has(node.id)" class="ph-duotone ph-warning-circle issue" :title="issues.get(node.id)" />
                <span v-if="outcomes?.get(node.id)" class="outcome">
                    <i :class="['ph-duotone', badge[outcomes.get(node.id)!].icon]" />{{ badge[outcomes.get(node.id)!].label }}
                </span>
                <span class="row-actions" @click.stop>
                    <button type="button" class="btn btn-ghost icon" :disabled="i === 0" title="Move up" aria-label="Move up" @click="move(i, -1)"><i class="ph-duotone ph-arrow-up" /></button>
                    <button type="button" class="btn btn-ghost icon" :disabled="i === nodes.length - 1" title="Move down" aria-label="Move down" @click="move(i, 1)"><i class="ph-duotone ph-arrow-down" /></button>
                    <button v-if="node.kind === 'check' && !nested" type="button" class="btn btn-ghost icon" title="Wrap in a group" aria-label="Wrap in a group" @click="wrap(i)"><i class="ph-duotone ph-brackets-round" /></button>
                    <button v-else-if="node.kind === 'group' && node.checks.length === 1" type="button" class="btn btn-ghost icon" title="Unwrap group" aria-label="Unwrap group" @click="unwrap(i)"><i class="ph-duotone ph-arrows-out-line-horizontal" /></button>
                    <button type="button" class="btn btn-ghost icon btn-danger" title="Delete" aria-label="Delete sub-rule" @click="remove(i)"><i class="ph-duotone ph-trash" /></button>
                </span>
                <i v-if="node.kind === 'check'" :class="['ph-duotone', open.has(node.id) ? 'ph-caret-up' : 'ph-caret-down', 'caret']" />
            </div>

            <!-- A group's name and message are always shown; a check collapses to its expression. -->
            <div v-if="node.kind === 'group' || open.has(node.id)" class="node-body">
                <div class="grid">
                    <div class="field">
                        <label :for="'n-' + node.id">Name</label>
                        <input :id="'n-' + node.id" v-model="node.name" class="input mono" placeholder="app-standard" autocomplete="off">
                    </div>
                    <div class="field">
                        <label :for="'m-' + node.id">Error message <span class="optional">optional</span></label>
                        <input :id="'m-' + node.id" v-model="node.errorMessage" class="input" placeholder="Falls back to the parent's message" autocomplete="off">
                    </div>
                </div>
                <template v-if="node.kind === 'check'">
                    <div class="field">
                        <label>Expression</label>
                        <CelEditor :key="target.type + target.scope" v-model="node.expression" :placeholder="resource.placeholder" :completions="completions" />
                        <p v-if="issues.has(node.id)" class="field-error">{{ issues.get(node.id) }}</p>
                        <p v-else class="check-ok"><i class="ph-duotone ph-check-circle" />Type-checks.</p>
                        <ExpressionHelp />
                    </div>
                    <PatternTable
                        v-for="p in patternsFor([node.expression], variables, node.name || 'this pattern')"
                        :key="p.variable" :variable="p.variable" :rows="p.rows"
                    />
                </template>
                <p v-else-if="issues.has(node.id)" class="field-error">{{ issues.get(node.id) }}</p>
            </div>

            <SubRuleList
                v-if="node.kind === 'group'"
                :nodes="node.checks"
                :combinator="node.combinator"
                :target="target"
                :variables="variables"
                :completions="completions"
                :issues="issues"
                :outcomes="outcomes"
                :depth="(depth ?? 0) + 1"
                @update:nodes="(next: SubRule[]) => { node.checks = next.filter((n): n is SubRuleCheck => n.kind === 'check'); }"
            />
        </div>

        <div class="add">
            <button type="button" class="btn btn-secondary" @click="add('check')"><i class="ph-duotone ph-plus" />Sub-rule</button>
            <button v-if="!nested" type="button" class="btn btn-ghost" @click="add('group')"><i class="ph-duotone ph-tree-structure" />Group</button>
        </div>
    </div>
</template>

<style scoped>
.list { display: flex; flex-direction: column; gap: 6px; }
.nested { margin: 4px 0 8px 14px; padding-left: 12px; border-left: 2px solid var(--chrome-line); }
.joiner { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }

.node { border: 1px solid var(--chrome-line); border-radius: var(--radius-md); background: var(--color-surface); }
.node.group { background: color-mix(in srgb, var(--color-text) 3%, var(--color-surface)); }
.node.group > .list { padding-right: 10px; }
.node-head { display: flex; align-items: center; gap: 8px; padding: 6px 8px 6px 10px; min-width: 0; }
.node-head.clickable { cursor: pointer; }
.kind { color: var(--muted); font-size: 15px; flex: none; }
.node-name { font-size: 13px; font-weight: 600; flex: none; }
.unnamed { color: var(--faint); font-style: italic; font-weight: 400; }
.count { font-size: 12px; color: var(--muted); }
.preview { font-size: 12px; flex: 1 1 auto; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: var(--muted); }
.spacer { flex: 1 1 0; }
.preview + .spacer { flex: 0; }
.issue { color: var(--warning); font-size: 16px; }
.outcome { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; white-space: nowrap; }
.ok > .node-head .outcome { color: var(--success); }
.bad > .node-head .outcome { color: var(--color-accent-2-700); }
.warn > .node-head .outcome { color: var(--warning); }
.skip > .node-head .outcome { color: var(--faint); }
.row-actions { display: inline-flex; gap: 2px; opacity: 0.35; transition: opacity 0.12s; }
.node-head:hover > .row-actions, .row-actions:focus-within { opacity: 1; }
.icon { padding: 4px 6px; font-size: 13px; }
.caret { color: var(--faint); }

.node-body { padding: 4px 12px 12px; border-top: 1px solid var(--chrome-line); }
.grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: 12px; }
.field { margin-top: 10px; }
.field > label { display: block; }
.optional { font-size: 11px; color: var(--faint); font-weight: 400; margin-left: 4px; }
.field-error { font-size: 11.5px; color: var(--error); margin: 7px 0 0; }
.check-ok { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--success); margin: 7px 0 0; }

.hint { font-size: 11.5px; color: var(--faint); margin: 4px 0 0; }
.hint .mono { color: var(--muted); }
.add { display: flex; gap: 6px; margin-top: 2px; }
.add .btn { font-size: 12.5px; padding: 4px 10px; }
</style>
