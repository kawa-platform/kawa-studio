<script setup lang="ts">
import { computed } from 'vue';
import { fieldsFor, missingFieldsFor, requestFields, resourceDef, resources, targetLabel, type Target } from '../lib/resources';
import type { GovernanceVariable } from '../lib/types';

/// What an expression on this target can read: the context variable's fields, the request
/// fields and the declared variables, each a button that inserts its path. Under "physical
/// and virtual", one-kind fields are tagged and need a topic.virtual guard.
const props = defineProps<{ target: Target; variables: GovernanceVariable[] }>();
const emit = defineEmits<{ insert: [path: string] }>();

const def = computed(() => resourceDef(props.target.type));
const label = computed(() => targetLabel(props.target));
const fields = computed(() => fieldsFor(props.target));
const tagged = computed(() => props.target.scope === 'both' && fields.value.some((f) => f.only));
const unavailable = computed(() => [
    ...missingFieldsFor(props.target).map((f) => `${def.value.variable}.${f.name}`),
    ...resources.filter((r) => r.type !== props.target.type).map((r) => r.variable),
]);

interface Row { path: string; root: string; rest: string; type: string; doc: string; only?: string; variable?: boolean }

const groups = computed<{ title: string; rows: Row[] }[]>(() => [
    {
        title: `${def.value.variable}.*`,
        rows: fields.value.map((f) => ({
            path: `${def.value.variable}.${f.name}`, root: def.value.variable, rest: `.${f.name}`, type: f.type, doc: f.doc,
            ...(f.only && props.target.scope === 'both' ? { only: f.only } : {}),
        })),
    },
    {
        title: 'Request',
        rows: requestFields.map((f) => ({ path: f.name, root: f.name, rest: '', type: f.type, doc: f.doc })),
    },
    {
        title: 'Variables',
        rows: props.variables.map((v) => ({
            path: v.name, root: v.name, rest: '', type: v.type, doc: v.note || 'Declared variable.', variable: true,
        })),
    },
].filter((g) => g.rows.length > 0));
</script>

<template>
    <div class="context">
        <div v-for="g in groups" :key="g.title" class="group">
            <div class="caption">{{ g.title }}</div>
            <button
                v-for="r in g.rows" :key="r.path" type="button" class="row" :title="`Insert ${r.path}`"
                @click="emit('insert', r.path)"
            >
                <span class="line">
                    <span class="mono path" :class="{ var: r.variable }"><span class="root">{{ r.root }}</span>{{ r.rest }}</span>
                    <span class="mono type">{{ r.type }}</span>
                    <span v-if="r.only" class="only">{{ r.only }} only</span>
                </span>
                <span class="doc">{{ r.doc }}</span>
            </button>
        </div>
        <p v-if="tagged" class="guard">
            <i class="ph-duotone ph-info" />
            <span>
                Fields marked <span class="only">physical only</span> or <span class="only">virtual only</span> need a guard,
                e.g. <span class="mono">!topic.virtual &amp;&amp; topic.partitions &gt;= 3</span>, or narrow the topics to one kind.
            </span>
        </p>
        <p class="not">
            <i class="ph-duotone ph-prohibit" />
            <span>
                Not available on {{ label }} rules:
                <template v-for="(name, i) in unavailable" :key="name"><span class="mono">{{ name }}</span>{{ i < unavailable.length - 1 ? ', ' : '' }}</template>
            </span>
        </p>
    </div>
</template>

<style scoped>
.group + .group { margin-top: 12px; }
.caption { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; font-family: var(--mono); }
.row {
    display: block; width: 100%; text-align: left; padding: 5px 8px; margin: 0 -8px; border: 0; border-radius: var(--radius-sm);
    background: none; color: inherit; cursor: pointer; font: inherit;
}
.row:hover, .row:focus-visible { background: color-mix(in srgb, var(--color-accent) 9%, transparent); outline: none; }
.line { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.path { font-size: 12.5px; color: var(--code-pink); }
.path .root { font-weight: 600; }
.path.var { color: var(--brand-text); }
.type { font-size: 11.5px; color: var(--faint); }
.doc { display: block; font-size: 12px; color: var(--muted); line-height: 1.45; margin-top: 1px; }
.only {
    display: inline-block; font-size: 10.5px; padding: 0 6px; border-radius: 999px;
    border: 1px solid var(--warning); color: var(--warning); white-space: nowrap;
}
.guard, .not { display: flex; gap: 6px; align-items: baseline; margin: 12px 0 0; font-size: 12px; line-height: 1.6; }
.guard { color: var(--muted); }
.not { color: var(--faint); }
.not .mono { text-decoration: line-through; }
</style>
