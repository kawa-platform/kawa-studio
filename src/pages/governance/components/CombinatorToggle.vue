<script setup lang="ts">
import type { Combinator } from '../lib/types';

const model = defineModel<Combinator>({ required: true });
defineProps<{ label?: string }>();

const options: { value: Combinator; label: string; title: string }[] = [
    { value: 'all', label: 'all', title: 'Every sub-rule must hold (AND)' },
    { value: 'any', label: 'any', title: 'One sub-rule must hold (OR)' },
];
</script>

<template>
    <div class="seg combinator" role="radiogroup" :aria-label="label ?? 'Combine sub-rules'" @click.stop>
        <button
            v-for="o in options"
            :key="o.value"
            type="button"
            class="seg-opt"
            role="radio"
            :aria-checked="model === o.value"
            :data-state="model === o.value ? 'active' : 'inactive'"
            :title="o.title"
            @click="model = o.value"
        >{{ o.label }}</button>
    </div>
</template>

<style scoped>
.combinator .seg-opt { padding: 3px 10px; font-size: 12px; font-family: var(--mono); }
</style>
