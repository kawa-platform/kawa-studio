<script setup lang="ts">
import { inject } from 'vue';
import { REFERENCE_PANEL } from '../lib/reference';

/// One quiet line under an expression editor. Fields, variables and examples live in the
/// page's reference panel; while it is closed this line offers to open it.
const reference = inject(REFERENCE_PANEL, null);
</script>

<template>
    <p class="line">
        <slot />
        <span><kbd>Ctrl</kbd>+<kbd>Space</kbd> completes.</span>
        <button v-if="reference && !reference.open.value" type="button" class="toggle" @click="reference.show()">
            <i class="ph-duotone ph-book-open-text" />Fields, variables and examples
        </button>
    </p>
</template>

<style scoped>
.line { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; font-size: 11.5px; color: var(--faint); margin: 7px 0 0; }
.toggle {
    display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; cursor: pointer; font-size: 11.5px;
    border: 1px solid var(--chrome-line); border-radius: 999px; background: none; color: var(--muted);
}
.toggle:hover { color: var(--color-text); border-color: var(--color-accent); }
kbd { font-family: var(--mono); font-size: 10.5px; padding: 0 4px; border: 1px solid var(--chrome-line); border-radius: 3px; }
</style>
