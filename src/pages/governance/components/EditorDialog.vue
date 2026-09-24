<script setup lang="ts">
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui';

const open = defineModel<boolean>('open', { required: true });

defineProps<{ title: string; body?: string; saveLabel?: string; canSave: boolean }>();

const emit = defineEmits<{ save: [] }>();
</script>

<template>
    <!-- Same primitives as ConfirmDialog, wider, for the rule / variable / exemption forms. -->
    <DialogRoot v-model:open="open">
        <DialogPortal>
            <DialogOverlay class="overlay" />
            <DialogContent class="modal wide">
                <DialogTitle class="title">{{ title }}</DialogTitle>
                <DialogDescription v-if="body" class="body">{{ body }}</DialogDescription>

                <div class="fields"><slot /></div>

                <div class="actions">
                    <DialogClose class="btn btn-secondary">Cancel</DialogClose>
                    <button class="btn btn-primary" :disabled="!canSave" @click="emit('save')">
                        {{ saveLabel ?? 'Save' }}
                    </button>
                </div>
            </DialogContent>
        </DialogPortal>
    </DialogRoot>
</template>

<style scoped>
.wide { width: min(680px, calc(100vw - 32px)); }
.title { font-family: var(--font-heading); font-size: 17px; margin: 0 0 6px; }
.body { font-size: 13px; color: var(--muted); margin: 0; }
.fields { display: grid; gap: 18px; margin-top: var(--space-4); }
.actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: var(--space-5); }
</style>
