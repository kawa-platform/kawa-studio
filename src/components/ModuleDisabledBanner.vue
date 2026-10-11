<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { MODULE_REFS } from '@/pages/modules/lib/modules';
import { useDisabledModules } from '@/pages/modules/queries';

const route = useRoute();
const disabled = useDisabledModules();

/// The disabled module the current page belongs to, if any.
const module = computed(() => {
    const id = route.meta.module;
    return id && disabled.value.has(id) ? { id, name: MODULE_REFS[id]?.name ?? id } : null;
});
</script>

<template>
    <div v-if="module" class="module-banner" role="status">
        <span class="banner-icon"><i class="ph-duotone ph-power" /></span>
        <p class="banner-text">
            <strong>{{ module.name }} is disabled.</strong>
            You can still view and edit it, but changes have no effect until the module is enabled.
        </p>
        <RouterLink class="btn btn-secondary banner-action" to="/modules">
            <i class="ph-duotone ph-sliders-horizontal" />Manage modules
        </RouterLink>
    </div>
</template>

<style scoped>
.module-banner {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 22px;
    padding: 12px 12px 12px 14px;
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--warning) 10%, var(--color-surface));
    border: 1px solid color-mix(in srgb, var(--warning) 32%, transparent);
    box-shadow: var(--shadow-sm);
}
.banner-icon {
    width: 34px;
    height: 34px;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: 10px;
    font-size: 18px;
    color: var(--warning);
    background: color-mix(in srgb, var(--warning) 16%, transparent);
}
.banner-text { margin: 0 auto 0 0; font-size: 13.5px; line-height: 1.5; color: var(--color-text); }
.banner-text strong { font-weight: 600; }
.banner-action { flex: none; font-size: 13px; min-height: 34px; padding: 6px 14px; }

@media (max-width: 640px) {
    .module-banner { flex-wrap: wrap; }
}
</style>
