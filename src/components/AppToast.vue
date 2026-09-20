<script setup lang="ts">
import { ToastClose, ToastDescription, ToastRoot } from 'reka-ui';

const open = defineModel<boolean>('open', { required: true });

defineProps<{ ok: boolean; text: string }>();
</script>

<template>
    <ToastRoot v-model:open="open" :duration="6000" class="toast" :class="ok ? 'toast-ok' : 'toast-bad'">
        <i :class="['ph-duotone', ok ? 'ph-check-circle' : 'ph-warning-circle']" />
        <ToastDescription class="text">{{ text }}</ToastDescription>
        <ToastClose class="close" aria-label="Dismiss">
            <i class="ph-duotone ph-x" />
        </ToastClose>
    </ToastRoot>
</template>

<style scoped>
.toast {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 11px 13px;
    font-size: 12.5px;
    background: var(--chrome);
    border: 1px solid var(--chrome-line);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
}

.toast i { font-size: 16px; flex: none; }
.toast-ok { border-color: var(--color-accent); color: var(--color-accent-700); }
.toast-bad { border-color: var(--color-accent-2); color: var(--color-accent-2-700); }
.text { flex: 1; min-width: 0; }
.close { background: none; border: none; color: var(--faint); cursor: pointer; padding: 0; display: inline-flex; }
.close:hover { color: var(--color-text); }
</style>
