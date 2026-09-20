<script setup lang="ts">
import { computed, ref } from 'vue';

/// Token input for multi-value fields (group members, role bindings). Typed values are
/// matched against `suggestions`; anything else is still accepted — the gateway persists
/// arbitrary names and surfaces dangling references as warnings, so the UI must not block.
const model = defineModel<string[]>({ required: true });

const props = withDefaults(defineProps<{
    suggestions?: string[];
    placeholder?: string;
    allowNew?: boolean;
    disabled?: boolean;
}>(), {
    suggestions: () => [],
    placeholder: 'Type a value and press Enter…',
    allowNew: true,
    disabled: false,
});

const text = ref('');
const open = ref(false);
const highlight = ref(0);

const filtered = computed(() => {
    const q = text.value.trim().toLowerCase();
    if (!q) return props.suggestions.filter((s) => !model.value.includes(s));
    return props.suggestions.filter((s) => s.toLowerCase().includes(q) && !model.value.includes(s));
});

/// The list actually offered: matching suggestions, or (when free text is allowed) the
/// typed value itself so Enter always has something to commit.
const offered = computed(() => {
    const q = text.value.trim();
    if (filtered.value.length) return filtered.value;
    return q && props.allowNew ? [q] : [];
});

function select(value: string): void {
    const cleaned = value.trim();
    if (!cleaned || model.value.includes(cleaned)) {
        text.value = '';
        open.value = false;
        return;
    }
    model.value = [...model.value, cleaned];
    text.value = '';
    open.value = false;
}

const remove = (value: string): void => {
    model.value = model.value.filter((v) => v !== value);
};

function onInput(): void {
    highlight.value = 0;
    open.value = offered.value.length > 0;
}

function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
        event.preventDefault();
        const list = offered.value;
        const target = list[highlight.value] ?? list[0];
        if (target) select(target);
    } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        highlight.value = Math.min(highlight.value + 1, Math.max(offered.value.length - 1, 0));
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        highlight.value = Math.max(highlight.value - 1, 0);
    } else if (event.key === 'Backspace' && !text.value && model.value.length) {
        const last = model.value[model.value.length - 1];
        if (last) remove(last);
    } else if (event.key === 'Escape') {
        open.value = false;
    }
}

function blur(): void {
    // Let a mousedown on an option register its click first.
    setTimeout(() => { open.value = false; }, 120);
}
</script>

<template>
    <div class="suggestion-input" :class="{ disabled }">
        <div class="chips">
            <span v-for="value in model" :key="value" class="tag tag-neutral chip">
                <span class="mono chip-label">{{ value }}</span>
                <button class="remove" type="button" aria-label="Remove {{ value }}" @click="remove(value)">
                    <i class="ph-duotone ph-x" />
                </button>
            </span>
            <input
                v-model="text"
                class="input chip-input"
                type="text"
                :placeholder="model.length ? '' : placeholder"
                :disabled="disabled"
                @input="onInput"
                @keydown="onKeydown"
                @focus="onInput"
                @blur="blur"
            >
        </div>

        <div v-if="open && offered.length" class="options">
            <button
                v-for="(option, index) in offered"
                :key="option"
                type="button"
                class="option"
                :class="{ on: index === highlight }"
                @mousedown.prevent
                @click="select(option)"
                @mouseenter="highlight = index"
            >
                <span class="mono value">{{ option }}</span>
                <i class="ph-duotone ph-plus" />
            </button>
        </div>
    </div>
</template>

<style scoped>
.suggestion-input { position: relative; }
.disabled { opacity: 0.6; }

.chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    padding: 6px 8px;
    min-height: 36px;
    background: var(--color-surface);
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-md);
}
.chips:focus-within { border-color: var(--color-accent); }

.chip { gap: 4px; padding: 2px 6px 2px 9px; }
.chip-label { font-size: 11.5px; }
.remove {
    display: inline-flex;
    background: none;
    border: none;
    padding: 1px;
    color: var(--faint);
    cursor: pointer;
    border-radius: 3px;
}
.remove:hover { color: var(--color-accent-2-700); }
.remove i { font-size: 12px; }

.chip-input {
    flex: 1;
    min-width: 160px;
    width: auto;
    min-height: 0;
    padding: 3px 4px;
    background: transparent;
    border: none;
}
.chip-input:hover { border-color: transparent; }
.chip-input:focus-visible { border: none; outline-offset: 0; }

.options {
    position: absolute;
    z-index: 30;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    max-height: 240px;
    overflow-y: auto;
    background: var(--chrome);
    border: 1px solid var(--chrome-line);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    padding: 4px;
}

.option {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 9px;
    font-size: 12.5px;
    text-align: left;
    background: none;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    color: var(--color-text);
}
.option:hover, .option.on { background: var(--row-hover); }

.value { flex: 1; font-size: 12px; }
.option i { color: var(--faint); font-size: 13px; }
</style>