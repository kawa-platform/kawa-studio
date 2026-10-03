<script setup lang="ts">
import { resources, type ResourceType } from '../lib/resources';

const model = defineModel<ResourceType>({ required: true });
</script>

<template>
    <div class="seg picker" role="radiogroup" aria-label="Resource type">
        <button
            v-for="r in resources"
            :key="r.type"
            type="button"
            class="seg-opt"
            role="radio"
            :aria-checked="model === r.type"
            :data-state="model === r.type ? 'active' : 'inactive'"
            @click="model = r.type"
        ><i :class="['ph-duotone', r.icon]" />{{ r.label }}</button>
    </div>
</template>

<style scoped>
.picker { flex-wrap: wrap; }
</style>
