<script setup lang="ts">
import type { TopicType } from '@/api/types';

defineProps<{ type: TopicType }>();
</script>

<template>
    <span class="tag" :class="type === 'virtual' ? 'tag-accent' : 'tag-neutral'">{{ type }}</span>
</template>
