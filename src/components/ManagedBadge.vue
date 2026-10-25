<script setup lang="ts">
import type { ManagedByView } from '@/api/types';
import { managedTitle } from '@/lib/managed';

/// Marks a record owned by another writer (e.g. the Kubernetes operator).
defineProps<{ managedBy: ManagedByView }>();
</script>

<template>
    <span class="tag managed-badge" :title="managedTitle(managedBy)">
        <i class="ph-duotone ph-lock-simple" />Managed by {{ managedBy.principal }}
    </span>
</template>

<style scoped>
/* Quiet on purpose: it's context, not a call to action. */
.managed-badge {
    gap: 4px;
    padding: 1px 7px;
    font-size: 10.5px;
    white-space: nowrap;
    vertical-align: middle;
    color: var(--muted);
    border: 1px solid var(--chrome-line);
}
.managed-badge i { font-size: 11px; }
</style>
