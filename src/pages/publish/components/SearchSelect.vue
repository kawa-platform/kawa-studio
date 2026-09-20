<script setup lang="ts">
import {
    ComboboxAnchor, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem,
    ComboboxPortal, ComboboxRoot, ComboboxTrigger,
} from 'reka-ui';

export interface SelectItem {
    value: string;
    label?: string;
    tag?: string;
    tagAccent?: boolean;
    hint?: string;
}

const model = defineModel<string>({ required: true });

const props = withDefaults(defineProps<{
    items: SelectItem[];
    label: string;
    placeholder?: string;
    disabled?: boolean;
    emptyText?: string;
}>(), {
    placeholder: 'Search…',
    disabled: false,
    emptyText: 'Nothing matches that name.',
});

const labelOf = (value: string): string =>
    props.items.find((item) => item.value === value)?.label ?? value;
</script>

<template>
    <!-- Reka's Combobox owns filtering, arrow-key navigation, typeahead and the aria wiring;
         all we bring is the Broadsheet classes. -->
    <ComboboxRoot v-model="model" :disabled="disabled" :ignore-filter="false" :open-on-click="true" :open-on-focus="true" class="field select-field">
        <label>{{ label }}</label>
        <ComboboxAnchor class="anchor">
            <ComboboxInput class="input mono" :placeholder="placeholder" :display-value="labelOf" />
            <ComboboxTrigger class="caret" aria-label="Toggle options">
                <i class="ph-duotone ph-caret-down" />
            </ComboboxTrigger>
        </ComboboxAnchor>

        <ComboboxPortal>
            <ComboboxContent position="popper" :side-offset="4" class="popover">
                <ComboboxEmpty class="empty">{{ emptyText }}</ComboboxEmpty>
                <ComboboxItem v-for="item in items" :key="item.value" :value="item.value" :text-value="item.label" class="option">
                    <span class="mono value">{{ item.label ?? item.value }}</span>
                    <span v-if="item.tag" class="pill" :class="{ 'pill-accent': item.tagAccent }">{{ item.tag }}</span>
                    <span v-if="item.hint" class="hint">{{ item.hint }}</span>
                </ComboboxItem>
            </ComboboxContent>
        </ComboboxPortal>
    </ComboboxRoot>
</template>

<style scoped>
.select-field { width: 340px; }
.anchor { position: relative; display: block; }
.anchor .input { padding-right: 28px; width: 100%; box-sizing: border-box; }

.caret {
    position: absolute;
    right: 6px;
    top: 50%;
    translate: 0 -50%;
    background: none;
    border: none;
    padding: 4px;
    color: var(--faint);
    cursor: pointer;
    display: inline-flex;
}

.caret:hover { color: var(--color-accent-700); }
.value { font-size: 12.5px; }
.hint { font-size: 11px; color: var(--faint); margin-left: auto; white-space: nowrap; }
.empty { padding: 10px 11px; font-size: 12px; color: var(--muted); }
</style>
