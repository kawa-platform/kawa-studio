<script setup lang="ts" generic="T extends string">
/// Small segmented single-choice control on the shared .seg styles.
const model = defineModel<T>({ required: true });
defineProps<{ options: { value: T; label: string; icon?: string }[]; label: string }>();
</script>

<template>
    <div class="seg" role="radiogroup" :aria-label="label">
        <button
            v-for="o in options"
            :key="o.value"
            type="button"
            class="seg-opt"
            role="radio"
            :aria-checked="model === o.value"
            :data-state="model === o.value ? 'active' : 'inactive'"
            @click="model = o.value"
        ><i v-if="o.icon" :class="['ph-duotone', o.icon]" />{{ o.label }}</button>
    </div>
</template>
