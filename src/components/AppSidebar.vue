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
            <span class="mark" aria-label="Kawa">川</span>
            <div v-if="!collapsed" class="brand-text">
                <span class="wordmark">kawa</span>
                <span class="kicker">Kafka Gateway</span>
            </div>
            <button
                class="collapse"
                :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
                :aria-expanded="!collapsed"
                @click="collapsed = !collapsed"
            >
                <i :class="['ph-duotone', collapsed ? 'ph-caret-double-right' : 'ph-caret-double-left']" />
            </button>
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
                        <span v-if="item.level === 1 && !collapsed" class="tree-guide" />
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
            <div class="theme-switch" :class="{ 'theme-switch-col': collapsed }" role="group" aria-label="Theme">
                <button
                    v-if="!collapsed || theme === 'dark'"
                    type="button"
                    class="theme-opt"
                    :class="{ 'theme-opt-on': theme === 'light' }"
                    :aria-pressed="theme === 'light'"
                    title="Light mode"
                    @click="theme === 'dark' && toggle()"
                >
                    <i class="ph-duotone ph-sun" />
                    <span v-if="!collapsed">Light</span>
                </button>
                <button
                    v-if="!collapsed || theme === 'light'"
                    type="button"
                    class="theme-opt"
                    :class="{ 'theme-opt-on': theme === 'dark' }"
                    :aria-pressed="theme === 'dark'"
                    title="Dark mode"
                    @click="theme === 'light' && toggle()"
                >
                    <i class="ph-duotone ph-moon" />
                    <span v-if="!collapsed">Dark</span>
                </button>
            </div>
            <div v-if="!collapsed" class="version">
                <span>kawa 0.9.2</span><span>native-image</span>
            </div>
        </div>
    </aside>
</template>

<style scoped>
.sidebar {
    width: 248px;
    flex: none;
    margin: 12px 0 12px 12px;
    height: calc(100vh - 24px);
    position: sticky;
    top: 12px;
    display: flex;
    flex-direction: column;
    background: var(--panel);
    backdrop-filter: blur(18px);
    border: 1px solid var(--panel-line);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-md);
    transition: width 180ms ease;
    overflow: hidden;
}

.sidebar.collapsed { width: 72px; }

.brand { display: flex; align-items: center; gap: 11px; padding: 18px 14px 14px 16px; }
.collapsed .brand { flex-direction: column; padding: 16px 0 8px; gap: 10px; }

.mark {
    width: 38px;
    height: 38px;
    flex: none;
    border-radius: 12px;
    background: linear-gradient(145deg, var(--brand), color-mix(in srgb, var(--brand) 72%, #a06e00));
    color: var(--on-brand);
    font-weight: 700;
    font-size: 19px;
    display: grid;
    place-items: center;
    box-shadow: 0 8px 18px -8px color-mix(in srgb, var(--brand) 80%, transparent),
        inset 0 1px 0 color-mix(in srgb, #ffffff 35%, transparent);
}

.brand-text { display: flex; flex-direction: column; min-width: 0; line-height: 1.2; }
.wordmark { font-family: var(--font-heading); font-weight: 700; font-size: 17px; letter-spacing: -0.02em; }
.kicker { font-size: 11.5px; color: var(--muted); white-space: nowrap; }

.collapse {
    margin-left: auto;
    width: 30px;
    height: 30px;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: 50%;
    border: 1px solid var(--panel-line);
    background: var(--color-surface);
    color: var(--muted);
    cursor: pointer;
    transition: color 140ms ease, border-color 140ms ease;
}
.collapse:hover { color: var(--color-text); border-color: color-mix(in srgb, var(--color-text) 22%, transparent); }
.collapsed .collapse { margin-left: 0; }

nav { padding: 6px 12px 16px; display: flex; flex-direction: column; overflow-y: auto; flex: 1; }
.collapsed nav { padding-left: 12px; padding-right: 12px; }
.group { margin-bottom: 8px; }
.group-head { display: flex; align-items: baseline; gap: 6px; padding: 12px 12px 6px; }
.group-title { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 600; color: var(--faint); }
.group-note { font-size: 10.5px; color: var(--faint); margin-left: auto; white-space: nowrap; opacity: 0.8; }
.group-rule { height: 1px; margin: 8px 10px; background: var(--panel-line); }

.nav-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 9px 12px;
    margin: 1px 0;
    white-space: nowrap;
    overflow: hidden;
    font-size: 14px;
    font-weight: 500;
    text-decoration: none;
    border-radius: 12px;
    color: var(--muted);
    transition: background 140ms ease, color 140ms ease;
}
.collapsed .nav-item { justify-content: center; padding: 10px 0; }

.nav-item i { font-size: 19px; flex: none; }
.nav-item:hover { background: color-mix(in srgb, var(--color-text) 6%, transparent); color: var(--color-text); }

:global(html[data-theme='dark']) .nav-item { color: var(--color-neutral-700); }

.nav-item-nested { padding-left: 34px; }
.collapsed .nav-item-nested { padding-left: 0; }
.tree-guide {
    position: absolute;
    left: 21px;
    top: -6px;
    width: 9px;
    height: 24px;
    border-left: 1.5px solid var(--chrome-line);
    border-bottom: 1.5px solid var(--chrome-line);
    border-bottom-left-radius: 7px;
}

.nav-item-on,
.nav-item-on:hover {
    background: var(--nav-active-bg);
    color: var(--nav-active-fg);
    font-weight: 600;
    box-shadow: var(--shadow-sm);
}
:global(html[data-theme='dark']) .nav-item-on { color: var(--nav-active-fg); }
.nav-item-on i { color: var(--brand); }

.nav-item-soon { color: var(--faint); cursor: not-allowed; }
.nav-item-soon:hover { background: none; color: var(--faint); }
:global(html[data-theme='dark']) .nav-item-soon { color: var(--faint); }
.grow { margin-right: auto; }
.soon {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--brand-text);
    padding: 2px 7px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--brand) 14%, transparent);
}

.foot { padding: 12px; display: flex; flex-direction: column; gap: 10px; border-top: 1px solid var(--panel-line); }

.theme-switch {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px;
    padding: 4px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-text) 6%, transparent);
}
.theme-switch-col { grid-template-columns: 1fr; }
.theme-opt {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 6px 8px;
    border: none;
    border-radius: 999px;
    background: none;
    color: var(--muted);
    font: inherit;
    font-size: 12.5px;
    font-weight: 500;
    cursor: pointer;
}
.theme-opt i { font-size: 15px; }
.theme-opt:hover { color: var(--color-text); }
.theme-opt-on { background: var(--color-surface); color: var(--color-text); box-shadow: var(--shadow-sm); }
.version { font-size: 11px; color: var(--faint); display: flex; justify-content: space-between; padding: 0 6px; }
</style>
