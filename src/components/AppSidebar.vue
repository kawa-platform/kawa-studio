<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { navSections } from '@/router';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const theme = computed(() => (ui.dark ? 'dark' : 'light'));
const toggle = () => ui.toggleTheme();
const route = useRoute();

const isNavItemActive = (to?: string): boolean =>
    !!to && (route.path === to || route.path.startsWith(`${to}/`));

/// Collapsed state is a per-operator preference, so it lives in local storage rather
/// than the URL.
const KEY = 'kawa.sidebar';
const collapsed = ref(false);

onMounted(() => {
    try { collapsed.value = localStorage.getItem(KEY) === 'collapsed'; } catch { /* private mode */ }
});

watch(collapsed, (next) => {
    try { localStorage.setItem(KEY, next ? 'collapsed' : 'open'); } catch { /* private mode */ }
});
</script>

<template>
    <aside class="sidebar" :class="{ collapsed }">
        <div class="brand">
            <div class="brand-row">
                <span class="mark">k</span>
                <span v-if="!collapsed" class="wordmark">kawa</span>
                <button
                    class="collapse"
                    :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
                    :aria-expanded="!collapsed"
                    @click="collapsed = !collapsed"
                >
                    <i :class="['ph-duotone', collapsed ? 'ph-caret-double-right' : 'ph-caret-double-left']" />
                </button>
            </div>
            <div v-if="!collapsed" class="kicker">Access gateway · admin</div>
        </div>

        <nav>
            <div v-for="group in navSections" :key="group.title" class="group">
                <div v-if="!collapsed" class="group-head">
                    <span class="group-title">{{ group.title }}</span>
                    <span v-if="group.note" class="group-note">{{ group.note }}</span>
                </div>
                <div v-else class="group-rule" />
                <template v-for="item in group.items" :key="item.label">
                    <RouterLink v-if="item.to" :to="item.to" class="nav-item" :class="{ 'nav-item-nested': item.level === 1, 'nav-item-on': isNavItemActive(item.to) }" :title="item.label">
                        <span v-if="item.level === 1 && !collapsed" class="tree-guide">└</span>
                        <i :class="['ph-duotone', item.icon]" />
                        <span v-if="!collapsed">{{ item.label }}</span>
                    </RouterLink>
                    <div v-else class="nav-item nav-item-soon" aria-disabled="true" :title="item.label">
                        <i :class="['ph-duotone', item.icon]" />
                        <span v-if="!collapsed" class="grow">{{ item.label }}</span>
                        <span v-if="!collapsed" class="soon">soon</span>
                    </div>
                </template>
            </div>
        </nav>

        <div class="foot">
            <button class="btn btn-secondary theme-btn" :title="theme === 'dark' ? 'Light mode' : 'Dark mode'" @click="toggle">
                <i :class="['ph-duotone', theme === 'dark' ? 'ph-sun' : 'ph-moon']" />
                <span v-if="!collapsed">{{ theme === 'dark' ? 'Light mode' : 'Dark mode' }}</span>
            </button>
            <div v-if="!collapsed" class="version">
                <span>kawa 0.9.2</span><span>native-image</span>
            </div>
        </div>
    </aside>
</template>

<style scoped>
.sidebar {
    width: 232px;
    transition: width 160ms ease;
    box-shadow: inset -1px 0 0 color-mix(in srgb, var(--brand) 10%, transparent);
    flex: none;
    background: var(--chrome);
    border-right: 1px solid color-mix(in srgb, var(--chrome-line) 50%, transparent);
    display: flex;
    flex-direction: column;
    position: sticky;
    top: 0;
    height: 100vh;
}

.sidebar.collapsed { width: 62px; }
.brand { position: relative; padding: 18px 14px 16px; border-bottom: 2px solid color-mix(in srgb, var(--brand) 55%, transparent); }
.brand-row { display: flex; align-items: center; gap: 9px; }

.collapse {
    margin-left: auto;
    background: none;
    border: none;
    padding: 3px;
    color: var(--brand-text);
    cursor: pointer;
    display: inline-flex;
}

.collapsed .collapse { position: absolute; left: 50%; translate: -50% 0; top: 48px; margin-left: 0; }
.collapsed .foot, .collapsed nav { padding-left: 8px; padding-right: 8px; }
.collapsed .nav-item, .collapsed .theme-btn { justify-content: center; }

.group-rule {
    height: 1px;
    margin: 6px 8px 8px;
    background: color-mix(in srgb, var(--brand) 35%, transparent);
}

.mark {
    width: 22px;
    height: 22px;
    flex: none;
    border-radius: 3px;
    background: var(--brand);
    color: var(--on-brand);
    font-weight: 600;
    font-size: 13px;
    display: grid;
    place-items: center;
}

.wordmark { font-family: var(--font-heading); font-weight: 600; font-size: 16px; }

.kicker {
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
    margin-top: 9px;
}

nav { padding: 10px 8px 16px; display: flex; flex-direction: column; overflow-y: auto; }
.group { margin-bottom: 10px; }
.group-head { display: flex; align-items: baseline; gap: 6px; padding: 8px 10px 5px; }
.group-title { font-size: 9.5px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 600; color: var(--brand-text); }
.group-note { font-size: 9.5px; color: var(--faint); margin-left: auto; white-space: nowrap; }

.nav-item {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 8px 10px;
    white-space: nowrap;
    overflow: hidden;
    font-size: 13.5px;
    text-decoration: none;
    border-radius: var(--radius-md);
    color: var(--muted);
}

.nav-item i { font-size: 17px; flex: none; }
.nav-item:hover { background: var(--row-hover); color: var(--color-text); }

:global(html[data-theme='dark']) .nav-item { color: var(--color-neutral-700); }

.nav-item-nested { padding-left: 24px; }
.tree-guide { color: var(--faint); font-size: 12px; flex: none; }

.nav-item-on {
    background: color-mix(in srgb, var(--brand) 16%, transparent);
    color: var(--color-text);
    font-weight: 500;
    box-shadow: inset 3px 0 0 var(--brand);
}

.nav-item-soon { color: var(--faint); cursor: not-allowed; }
.nav-item-soon:hover { background: none; color: var(--faint); }
.grow { margin-right: auto; }
.soon { font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--faint); }

.foot {
    margin-top: auto;
    padding: 13px 14px;
    border-top: 1px solid var(--chrome-line);
    box-shadow: inset 0 2px 0 color-mix(in srgb, var(--brand) 40%, transparent);
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.theme-btn { justify-content: flex-start; gap: 9px; font-size: 12.5px; padding: 7px 10px; }
.version { font-size: 10.5px; color: var(--faint); display: flex; justify-content: space-between; }
</style>
