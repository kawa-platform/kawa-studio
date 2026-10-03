<script setup lang="ts">
import { computed } from 'vue';
import CelCode from './CelCode.vue';
import ResourceContext from './ResourceContext.vue';
import { resourceDef, targetLabel, type Target } from '../lib/resources';
import type { GovernanceVariable } from '../lib/types';

/// The expression reference, docked beside the rule editor: what expressions can read, example
/// conditions and CEL basics. Every entry inserts at the cursor of the expression editor the
/// user last focused; before one was focused, examples go to the rule's "When" condition and
/// everything else is copied.
const props = defineProps<{ target: Target; variables: GovernanceVariable[]; canInsert: boolean; copied: string | null }>();
const emit = defineEmits<{ insert: [code: string, example: boolean]; close: [] }>();

const def = computed(() => resourceDef(props.target.type));
const label = computed(() => targetLabel(props.target));
const names = computed(() => props.variables.map((v) => v.name));
/// Testing topic.virtual is pointless once the scope already fixes the kind.
const examples = computed(() => def.value.whenExamples
    .filter((e) => props.target.scope === 'both' || !e.code.includes('topic.virtual'))
    .map((e) => e.code));

/// The resource's identifying string field: a topic's name, a group's or transaction's id.
const key = computed(() => `${def.value.variable}.${props.target.type === 'topic' ? 'name' : 'id'}`);
const snippets = computed<{ code: string; doc: string }[]>(() => [
    { code: `${key.value}.startsWith("")`, doc: 'prefix' },
    { code: `${key.value}.matches("^…$")`, doc: 'regular expression (RE2)' },
    { code: `size(${key.value}) <= 249`, doc: 'length' },
    ...(props.target.type === 'topic' && props.target.scope !== 'virtual' ? [
        { code: '"cleanup.policy" in topic.configs', doc: 'a config is set' },
        { code: 'int(topic.configs["retention.ms"]) >= 86400000', doc: 'configs are strings; convert to compare' },
        { code: 'topic.partitions in [1, 3]', doc: 'one of a list' },
    ] : []),
    { code: 'principal == "User:"', doc: 'who is asking' },
]);
const operators: [string, string][] = [['&&', 'and'], ['||', 'or'], ['!', 'not'], ['in', 'in a list or map'], ['== !=', 'equal, not equal'], ['< <= > >=', 'compare']];
</script>

<template>
    <aside class="panel" aria-label="Expression reference">
        <header class="top">
            <div>
                <div class="title"><i class="ph-duotone ph-book-open-text" />Reference</div>
                <div class="sub">{{ label }} rules</div>
            </div>
            <button type="button" class="btn btn-ghost icon" title="Hide reference" aria-label="Hide reference" @click="emit('close')">
                <i class="ph-duotone ph-x" />
            </button>
        </header>
        <p class="tip">
            <template v-if="canInsert">Click an entry to insert it at the cursor.</template>
            <template v-else>Click into an expression, then click an entry to insert it there.</template>
            <kbd>Ctrl</kbd>+<kbd>Space</kbd> completes while you type.
        </p>
        <p v-if="copied" class="copied" role="status"><i class="ph-duotone ph-copy" />Copied <span class="mono">{{ copied }}</span></p>

        <section>
            <h3>Fields</h3>
            <ResourceContext :target="target" :variables="variables" @insert="(path) => emit('insert', path, false)" />
        </section>

        <section v-if="examples.length">
            <h3>Example conditions</h3>
            <button v-for="code in examples" :key="code" type="button" class="snippet" @click="emit('insert', code, true)">
                <CelCode :code="code" :variables="names" />
            </button>
        </section>

        <section>
            <h3>CEL basics</h3>
            <button v-for="s in snippets" :key="s.code" type="button" class="snippet" @click="emit('insert', s.code, false)">
                <CelCode :code="s.code" :variables="names" />
                <span class="doc">{{ s.doc }}</span>
            </button>
            <dl class="ops">
                <template v-for="[op, doc] in operators" :key="op">
                    <dt class="mono">{{ op }}</dt>
                    <dd>{{ doc }}</dd>
                </template>
            </dl>
        </section>
    </aside>
</template>

<style scoped>
.panel {
    border: 1px solid var(--chrome-line); border-radius: var(--radius-md); background: var(--color-surface);
    padding: 12px 14px 16px; font-size: 13px;
}
.top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.title { display: flex; align-items: center; gap: 6px; font-family: var(--font-heading); font-size: 14px; }
.title i { color: var(--brand); }
.sub { font-size: 12px; color: var(--muted); margin-top: 1px; }
.tip { font-size: 12px; color: var(--muted); line-height: 1.5; margin: 8px 0 0; }
.copied { display: flex; align-items: baseline; gap: 5px; font-size: 12px; color: var(--success); margin: 6px 0 0; overflow-wrap: anywhere; }
section { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--chrome-line); }
h3 { font-size: 12px; font-weight: 600; margin: 0 0 8px; color: var(--color-text); }
.snippet {
    display: flex; flex-direction: column; gap: 1px; width: 100%; text-align: left; padding: 5px 8px; margin: 0 -8px;
    border: 0; border-radius: var(--radius-sm); background: none; color: inherit; cursor: pointer; font: inherit; font-size: 12.5px;
}
.snippet:hover, .snippet:focus-visible { background: color-mix(in srgb, var(--color-accent) 9%, transparent); outline: none; }
.snippet .doc { font-size: 11.5px; color: var(--faint); }
.ops { display: grid; grid-template-columns: max-content 1fr; gap: 3px 12px; margin: 10px 0 0; font-size: 12px; }
.ops dt { color: var(--color-text); }
.ops dd { margin: 0; color: var(--muted); }
kbd { font-family: var(--mono); font-size: 10.5px; padding: 0 4px; border: 1px solid var(--chrome-line); border-radius: 3px; }
</style>
