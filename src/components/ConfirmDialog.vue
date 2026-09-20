<script setup lang="ts">
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui';
import AppSpinner from './AppSpinner.vue';

const open = defineModel<boolean>('open', { required: true });

withDefaults(defineProps<{
    title: string;
    body?: string;
    confirmLabel?: string;
    danger?: boolean;
    pending?: boolean;
}>(), {
    confirmLabel: 'Confirm',
    danger: false,
    pending: false,
});

const emit = defineEmits<{ confirm: [] }>();
</script>

<template>
    <!-- Dialog brings the focus trap, scroll lock, Escape handling and focus restore. -->
    <DialogRoot v-model:open="open">
        <DialogPortal>
            <DialogOverlay class="overlay" />
            <DialogContent class="modal">
                <DialogTitle class="title">{{ title }}</DialogTitle>
                <DialogDescription v-if="body" class="body">{{ body }}</DialogDescription>

                <slot />

                <div class="actions">
                    <DialogClose class="btn btn-secondary">Cancel</DialogClose>
                    <button
                        class="btn btn-primary"
                        :class="{ danger }"
                        :disabled="pending"
                        @click="emit('confirm')"
                    >
                        <AppSpinner v-if="pending" />
                        {{ confirmLabel }}
                    </button>
                </div>
            </DialogContent>
        </DialogPortal>
    </DialogRoot>
</template>

<style scoped>
.title { font-family: var(--font-heading); font-size: 17px; margin: 0 0 6px; }
.body { font-size: 13px; color: var(--muted); margin: 0 0 4px; }
.actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: var(--space-4); }
.danger { background: var(--color-accent-2-600); color: #ffffff; }
.danger:hover { background: var(--color-accent-2); }
</style>
