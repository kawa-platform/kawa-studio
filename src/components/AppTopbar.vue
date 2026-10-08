<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const auth = useAuthStore();
const crumb = computed(() => (route.meta.crumb as string | undefined) ?? 'Topics');
/// Up to two initials from the signed-in admin's email (or name), for the avatar.
const initials = computed(() => {
    const name = (auth.username ?? '').split('@')[0] ?? '';
    const parts = name.split(/[._\-\s]+/).filter(Boolean);
    return (parts.length > 1 ? parts[0]![0]! + parts[1]![0]! : name.slice(0, 2)).toUpperCase() || 'A';
});

const signOut = (): void => {
    auth.logout();
    void auth.beginLogin('/topics');
};
</script>

<template>
    <header class="topbar">
        <nav class="crumbs" aria-label="Breadcrumb">
            <span class="crumb-root"><i class="ph-duotone ph-squares-four" />Gateway</span>
            <i class="ph-duotone ph-caret-right sep" />
            <span class="here">{{ crumb }}</span>
        </nav>
        <div class="cluster" title="Connected cluster">
            <span class="dot" />
            <span class="mono">kafka-prod</span>
            <span class="region">eu-west-1</span>
        </div>
        <div v-if="auth.isAuthenticated" class="account">
            <span class="avatar" aria-hidden="true">{{ initials }}</span>
            <span class="who mono">{{ auth.username }}</span>
            <button type="button" class="sign-out" title="Sign out" aria-label="Sign out" @click="signOut">
                <i class="ph-duotone ph-sign-out" />
            </button>
        </div>
    </header>
</template>

<style scoped>
.topbar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 12px 20px 0;
    padding: 8px 10px 8px 18px;
    min-height: 56px;
    background: var(--panel);
    backdrop-filter: blur(18px);
    border: 1px solid var(--panel-line);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-sm);
    position: sticky;
    top: 12px;
    z-index: 20;
}

.crumbs { display: flex; align-items: center; gap: 8px; font-size: 13.5px; color: var(--muted); margin-right: auto; min-width: 0; }
.crumb-root { display: inline-flex; align-items: center; gap: 7px; }
.crumb-root i { font-size: 17px; color: var(--brand-text); }
.sep { font-size: 11px; color: var(--faint); }
.here { color: var(--color-text); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.cluster {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: none;
    white-space: nowrap;
    padding: 7px 14px;
    border-radius: 999px;
    background: var(--color-surface);
    border: 1px solid var(--panel-line);
    font-size: 12.5px;
}
.region { color: var(--faint); }
.dot {
    width: 8px;
    height: 8px;
    flex: none;
    border-radius: 50%;
    background: var(--success);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 22%, transparent);
}

.account {
    display: flex;
    align-items: center;
    gap: 9px;
    flex: none;
    padding: 4px 4px 4px 4px;
    border-radius: 999px;
    background: var(--color-surface);
    border: 1px solid var(--panel-line);
    font-size: 12.5px;
    color: var(--muted);
}
.avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: var(--on-brand);
    background: linear-gradient(145deg, var(--brand), color-mix(in srgb, var(--brand) 70%, #a06e00));
}
.who { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sign-out {
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border: none;
    border-radius: 50%;
    background: color-mix(in srgb, var(--color-text) 6%, transparent);
    color: var(--muted);
    cursor: pointer;
    transition: background 140ms ease, color 140ms ease;
}
.sign-out:hover { color: var(--color-accent-2-700); background: color-mix(in srgb, var(--color-accent-2) 14%, transparent); }
.sign-out i { font-size: 16px; }

@media (max-width: 760px) {
    .who, .region, .crumb-root { display: none; }
}
</style>
