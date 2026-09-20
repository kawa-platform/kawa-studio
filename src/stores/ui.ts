import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

/// Operator preferences, not view state. Anything shareable (filters, tabs) belongs in the
/// URL instead — see the assumptions in the README.
export const useUiStore = defineStore('ui', () => {
    const dark = ref(localStorage.getItem('kawa-theme') === 'dark');
    const sidebarCollapsed = ref(localStorage.getItem('kawa-sidebar') === 'collapsed');

    watch(dark, (on) => {
        localStorage.setItem('kawa-theme', on ? 'dark' : 'light');
        document.documentElement.dataset.theme = on ? 'dark' : 'light';
    }, { immediate: true });

    watch(sidebarCollapsed, (on) => {
        localStorage.setItem('kawa-sidebar', on ? 'collapsed' : 'expanded');
    });

    return {
        dark,
        sidebarCollapsed,
        toggleTheme: () => { dark.value = !dark.value; },
        toggleSidebar: () => { sidebarCollapsed.value = !sidebarCollapsed.value; },
    };
});
