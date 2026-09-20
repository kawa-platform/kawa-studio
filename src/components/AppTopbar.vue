<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const crumb = computed(() => (route.meta.crumb as string | undefined) ?? 'Topics');
</script>

<template>
    <header class="topbar">
        <div class="crumbs">
            <span>Gateway</span>
            <span class="sep">/</span>
            <span class="here">{{ crumb }}</span>
        </div>
        <div class="cluster">
            <span class="dot" />
            <span class="mono">kafka-prod</span>
            <span class="faint">eu-west-1</span>
        </div>
        <div class="account">
            <i class="ph-duotone ph-user-circle" />
            admin
        </div>
    </header>
</template>

<style scoped>
.topbar {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 0 28px;
    height: 50px;
    background: var(--chrome);
    border-bottom: 1px solid var(--chrome-line);
    position: sticky;
    top: 0;
    z-index: 20;
}

.crumbs { display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--muted); margin-right: auto; }
.sep { color: var(--faint); }
.here { color: var(--color-text); }

.cluster {
    display: flex;
    align-items: center;
    gap: 7px;
    flex: none;
    white-space: nowrap;
    padding: 4px 10px;
    border: 1px solid var(--chrome-line);
    border-radius: var(--radius-md);
    font-size: 12px;
}

.dot { width: 6px; height: 6px; flex: none; border-radius: 50%; background: var(--brand); }
.account { display: flex; align-items: center; gap: 7px; flex: none; font-size: 12.5px; color: var(--muted); }
.account i { font-size: 17px; }
</style>
