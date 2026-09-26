<script setup lang="ts">
import type { TopicFilter } from '@/api/types';

const props = defineProps<{ filter?: TopicFilter | null; long?: boolean }>();

const SHORT: Partial<Record<TopicFilter['kind'], string>> = {
    cel: 'CEL',
    header: 'header-equals',
    headerContains: 'header-contains',
    headerStartsWith: 'header-starts-with',
    headerMatches: 'header-matches',
};

const LONG: Partial<Record<TopicFilter['kind'], string>> = { ...SHORT, cel: 'CEL filter' };

const label = (): string => {
    if (!props.filter) return props.long ? 'no filter' : '';
    return props.long
        ? (LONG[props.filter.kind] ?? props.filter.kind)
        : (SHORT[props.filter.kind] ?? props.filter.kind);
};
</script>

<template>
    <span v-if="filter || long" class="pill" :class="{ 'pill-accent': !!filter }">{{ label() }}</span>
</template>
