<script setup lang="ts">
import type { TopicFilter } from '@/api/types';

const props = defineProps<{ filter?: TopicFilter | null; long?: boolean }>();

const label = (): string => {
    if (!props.filter) return props.long ? 'no filter' : '';
    if (props.long) return props.filter.kind === 'cel' ? 'CEL filter' : 'header-equals';
    return props.filter.kind === 'cel' ? 'CEL' : 'header';
};
</script>

<template>
    <span v-if="filter || long" class="pill" :class="{ 'pill-accent': !!filter }">{{ label() }}</span>
</template>
