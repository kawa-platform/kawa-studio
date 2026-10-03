<script setup lang="ts">
import CelCode from './CelCode.vue';
import { combinatorLabel } from '../lib/rules';
import type { Combinator, SubRule } from '../lib/types';

/// Read-only view of a rule's sub-rules, for the rules list.
defineProps<{ combinator: Combinator; nodes: SubRule[]; variables: string[] }>();
</script>

<template>
    <div class="tree">
        <div v-if="nodes.length > 1" class="joiner">{{ combinatorLabel[combinator] }}</div>
        <div v-for="node in nodes" :key="node.id" class="item">
            <template v-if="node.kind === 'check'">
                <span class="mono name">{{ node.name }}</span>
                <CelCode class="code" :code="node.expression" :variables="variables" />
            </template>
            <template v-else>
                <span class="mono name"><i class="ph-duotone ph-tree-structure" />{{ node.name }}</span>
                <SubRuleTree class="sub" :combinator="node.combinator" :nodes="node.checks" :variables="variables" />
            </template>
        </div>
    </div>
</template>

<style scoped>
.tree { display: flex; flex-direction: column; gap: 4px; }
.joiner { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
.item { display: grid; grid-template-columns: minmax(90px, max-content) minmax(0, 1fr); gap: 4px 14px; align-items: baseline; font-size: 12.5px; }
.name { font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
.name i { color: var(--muted); }
.code { line-height: 1.55; }
.sub { grid-column: 1 / -1; margin-left: 6px; padding-left: 12px; border-left: 2px solid var(--chrome-line); }
</style>
