<script setup lang="ts">
import { watch } from 'vue';
import { useRoute } from 'vue-router';
import { ToastProvider, ToastViewport } from 'reka-ui';
import AppSidebar from '@/components/AppSidebar.vue';
import AppTopbar from '@/components/AppTopbar.vue';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const auth = useAuthStore();

/// The gateway asked for a login (no session, or one that could not be refreshed): start the OAuth
/// login, which comes back to this page afterwards.
watch(() => auth.loginRequests, () => {
    if (route.meta.public) return;
    void auth.beginLogin(route.fullPath);
});
</script>

<template>
    <ToastProvider>
        <RouterView v-if="route.meta.bare" />
        <div v-else class="shell">
            <AppSidebar />
            <main class="main">
                <AppTopbar />
                <div class="page">
                    <RouterView />
                </div>
            </main>
        </div>
        <ToastViewport class="toast-viewport" />
    </ToastProvider>
</template>

<style scoped>
.shell { min-height: 100vh; display: flex; }
.main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.page { padding: 24px 28px 72px; max-width: 1440px; }

.toast-viewport {
    position: fixed;
    bottom: 18px;
    right: 18px;
    z-index: 60;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 340px;
    list-style: none;
    margin: 0;
    padding: 0;
}
</style>
