<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router';

const route = useRoute();
</script>

<template>
    <nav class="clients-tabs" aria-label="Clients views">
        <RouterLink to="/clients" class="tab" :class="{ 'tab-on': route.path === '/clients' }">Clients</RouterLink>
        <RouterLink to="/clients/access" class="tab" :class="{ 'tab-on': route.path === '/clients/access' }">Effective access</RouterLink>
    </nav>
</template>

<style scoped>
.clients-tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--chrome-line); margin-bottom: 16px; }
.tab { padding: 7px 12px; font-size: 12.5px; color: var(--muted); text-decoration: none; border-bottom: 2px solid transparent; margin-bottom: -1px; }
.tab:hover { color: var(--color-text); }
.tab-on { color: var(--color-text); border-bottom-color: var(--brand); font-weight: 500; }
</style>