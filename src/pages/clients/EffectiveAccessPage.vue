<script setup lang="ts">
import ClientsTabs from './ClientsTabs.vue';
import EffectiveAccessView from './EffectiveAccessView.vue';
</script>

<template>
    <div>
        <div class="head">
            <div>
                <h1>Clients</h1>
                <p class="lede">
                    SASL principals the gateway authenticates. Credentials are held by kawa, not by the upstream
                    cluster.
                </p>
            </div>
        </div>
        <ClientsTabs />
        <EffectiveAccessView />
    </div>
</template>

<style scoped>
.head { display: flex; align-items: flex-end; gap: 24px; margin-bottom: 20px; }
.head > div { margin-right: auto; }
</style>