<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQueryClient } from '@tanstack/vue-query';
import { ApiError } from '@/api/error';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import { DEFAULT_LANDING, safeRedirect } from './lib/login';

/// The OAuth redirect URI: the authorization server sends the browser back here with a `code` (or an
/// `error`). The code is redeemed for tokens, then the user lands on the page they were headed to.
const route = useRoute();
const router = useRouter();
const queryClient = useQueryClient();
const auth = useAuthStore();
useUiStore();

const error = ref<string | null>(null);

onMounted(async () => {
    const { code, state, error: oauthError, error_description: description } = route.query;
    if (typeof oauthError === 'string') {
        error.value = typeof description === 'string' ? description : 'Sign-in failed: ' + oauthError + '.';
        return;
    }
    if (typeof code !== 'string' || typeof state !== 'string') {
        error.value = 'This sign-in link is incomplete. Start again.';
        return;
    }
    try {
        const returnTo = await auth.completeLogin(code, state);
        // Drop anything cached anonymously or for another user.
        queryClient.clear();
        void router.replace(safeRedirect(returnTo));
    } catch (cause) {
        error.value = cause instanceof ApiError ? cause.message : 'Sign-in failed.';
    }
});

const startOver = (): void => {
    void auth.beginLogin(DEFAULT_LANDING);
};
</script>

<template>
    <main class="callback">
        <div class="card">
            <template v-if="error">
                <p class="error" role="alert">{{ error }}</p>
                <button type="button" class="btn btn-primary" @click="startOver">Sign in again</button>
            </template>
            <p v-else class="status">Signing in…</p>
        </div>
    </main>
</template>

<style scoped>
.callback { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: var(--color-bg); }
.card {
    width: min(380px, 100%);
    padding: 28px 30px;
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    text-align: center;
}
.status { margin: 0; font-size: 13px; color: var(--muted); }
.error { margin: 0 0 16px; color: var(--error); }
</style>
