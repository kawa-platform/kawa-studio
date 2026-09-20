<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'info' | 'warn' }>(), { tone: 'info' });
</script>

<template>
    <div class="rbac-banner" :class="tone">
        <i :class="['ph-fill', tone === 'warn' ? 'ph-warning' : 'ph-shield-check']" />
        <div class="body"><slot /></div>
    </div>
</template>

<style scoped>
.rbac-banner {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 12px 14px;
    font-size: 12.5px;
    line-height: 1.5;
    border: 1px solid var(--chrome-line);
    border-radius: var(--radius-md);
    background: var(--chrome);
    margin-bottom: 18px;
}

.rbac-banner i { font-size: 16px; margin-top: 1px; flex: none; }
.rbac-banner.info { border-color: color-mix(in srgb, var(--color-accent) 55%, transparent); }
.rbac-banner.info i { color: var(--color-accent-700); }
.rbac-banner.warn { border-color: color-mix(in srgb, var(--color-accent-2) 55%, transparent); }
.rbac-banner.warn i { color: var(--color-accent-2-700); }
.body { min-width: 0; }
</style>