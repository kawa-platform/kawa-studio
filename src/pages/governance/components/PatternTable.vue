<script setup lang="ts">
import type { PatternRow } from '../lib/patterns';

defineProps<{ variable: string; rows: PatternRow[] }>();
</script>

<template>
    <div class="patterns">
        <div class="caption">Accepted forms, derived from <span class="mono">{{ variable }}</span></div>
        <table class="table">
            <tbody>
                <tr v-for="row in rows" :key="row.form">
                    <td class="mono form">{{ row.form }}</td>
                    <td class="mono examples">
                        {{ row.examples.join(' · ') }}<span v-if="row.note" class="note"> — {{ row.note }}</span>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<style scoped>
.patterns { margin: 4px 0 6px; }
.caption { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--brand-text); margin-bottom: 4px; }
.table { font-size: 12.5px; }
.table td { padding: 6px 12px 6px 0; }
.table tbody tr:hover { background: none; }
.form { width: 34%; }
.examples { color: var(--muted); white-space: normal; }
.note { font-family: var(--font-body); font-style: italic; }
</style>
