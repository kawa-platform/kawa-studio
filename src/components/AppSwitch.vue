<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui';

/// The gateway's on/off switch, as on the module cards. Attributes such as `aria-label` and `disabled` fall
/// through to the switch itself.
const enabled = defineModel<boolean>({ required: true });
</script>

<template>
    <SwitchRoot v-model="enabled" class="switch-root app-switch">
        <SwitchThumb class="switch-thumb" />
    </SwitchRoot>
</template>

<style scoped>
/* A larger switch than the shared one: it is the primary action of the card or row it sits in. */
.app-switch { width: 44px; height: 26px; cursor: pointer; }
.app-switch[data-state='unchecked'] {
    background: color-mix(in srgb, var(--color-text) 16%, transparent);
    border-color: transparent;
}
.app-switch :deep(.switch-thumb) { width: 18px; height: 18px; top: 3px; left: 3px; box-shadow: 0 1px 3px color-mix(in srgb, #020b18 30%, transparent); }
.app-switch[data-state='checked'] :deep(.switch-thumb) { translate: 18px 0; }
.app-switch[data-disabled] { opacity: 0.45; cursor: not-allowed; }
.app-switch:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ring); }
</style>
