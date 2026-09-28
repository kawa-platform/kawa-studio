<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router';

const route = useRoute();
</script>

<template>
    <nav class="view-tabs" aria-label="Clients views">
        <RouterLink to="/clients" class="tab" :class="{ 'tab-on': route.path === '/clients' }">Clients</RouterLink>
        <RouterLink to="/clients/access" class="tab" :class="{ 'tab-on': route.path === '/clients/access' }">Effective access</RouterLink>
    </nav>
</template>
