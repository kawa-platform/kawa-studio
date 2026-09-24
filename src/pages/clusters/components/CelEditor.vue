<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { StreamLanguage, LanguageSupport, syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { autocompletion, completionKeymap, type CompletionContext } from '@codemirror/autocomplete';
import { tags } from '@lezer/highlight';

const model = defineModel<string>({ required: true });
const props = defineProps<{
    placeholder?: string;
    fields?: string[];
    /// Replaces the record-filter completions; governance rules complete against the topic
    /// context and declared variables instead.
    completions?: { label: string; type: string; detail?: string }[];
}>();

const host = ref<HTMLElement | null>(null);
let view: EditorView | null = null;

/// Enough of CEL to colour an expression: string and number literals, the boolean and
/// null keywords, the conversion functions the gateway exposes, and operators.
const celLanguage = StreamLanguage.define<{ }>({
    name: 'cel',
    token(stream) {
        if (stream.eatSpace()) return null;
        if (stream.match(/^"(?:[^"\\]|\\.)*"?/) || stream.match(/^'(?:[^'\\]|\\.)*'?/)) return 'string';
        if (stream.match(/^\d+(\.\d+)?/)) return 'number';
        if (stream.match(/^(true|false|null|in)\b/)) return 'keyword';
        if (stream.match(/^(int|double|string|bool|size|matches|startsWith|endsWith|contains|has)\b/)) return 'function';
        if (stream.match(/^(headers|key|value|topic|timestamp)\b/)) return 'variableName';
        if (stream.match(/^(&&|\|\||==|!=|>=|<=|[<>!+\-*/%])/)) return 'operator';
        stream.next();
        return null;
    },
});

const highlight = HighlightStyle.define([
    { tag: tags.string, color: 'var(--color-accent-2-700)' },
    { tag: tags.number, color: 'var(--color-accent-700)' },
    { tag: tags.keyword, color: 'var(--color-accent-700)', fontWeight: '600' },
    { tag: tags.function(tags.variableName), color: 'var(--color-accent-700)' },
    { tag: tags.variableName, color: 'var(--color-text)' },
    { tag: tags.operator, color: 'var(--muted)' },
]);

/// Completion is deliberately narrow: the three things a filter can read, plus the record
/// fields of the selected schema when the caller passes them.
function complete(context: CompletionContext) {
    const before = context.matchBefore(/[\w.\[\]"]*/);
    if (!before && !context.explicit) return null;

    const options = props.completions ?? [
        { label: 'headers["region"]', type: 'variable', detail: 'record header' },
        { label: 'headers["recordName"]', type: 'variable', detail: 'subject record name' },
        { label: 'key', type: 'variable', detail: 'record key, as a string' },
        { label: 'int(value.amount)', type: 'function', detail: 'numeric field' },
        { label: 'bool(value.partial)', type: 'function', detail: 'boolean field' },
        { label: 'matches(key, "^eu-")', type: 'function', detail: 'regex on the key' },
        ...(props.fields ?? []).map((name) => ({
            label: 'value.' + name, type: 'property', detail: 'schema field',
        })),
    ];

    return { from: before?.from ?? context.pos, options, validFor: /[\w.\[\]"]*/ };
}

onMounted(() => {
    if (!host.value) return;
    view = new EditorView({
        parent: host.value,
        state: EditorState.create({
            doc: model.value,
            extensions: [
                history(),
                keymap.of([...defaultKeymap, ...historyKeymap, ...completionKeymap]),
                new LanguageSupport(celLanguage),
                syntaxHighlighting(highlight),
                autocompletion({ override: [complete], activateOnTyping: true }),
                cmPlaceholder(props.placeholder ?? 'headers["region"] == "eu"'),
                EditorView.lineWrapping,
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) model.value = update.state.doc.toString();
                }),
            ],
        }),
    });
});

/// Only push external changes in — never echo what the editor just produced.
watch(model, (next) => {
    if (!view || next === view.state.doc.toString()) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next } });
});

onBeforeUnmount(() => view?.destroy());
</script>

<template>
    <div ref="host" class="editor" />
</template>

<style scoped>
.editor {
    border: 1px solid var(--chrome-line);
    border-left: 2px solid var(--color-accent);
    border-radius: var(--radius-md);
    background: var(--color-surface);
}
.editor :deep(.cm-editor) { font-family: var(--mono); font-size: 13.5px; }
.editor :deep(.cm-editor.cm-focused) { outline: none; }
.editor :deep(.cm-content) { padding: 11px 12px; min-height: 60px; }
.editor :deep(.cm-placeholder) { color: var(--faint); }
.editor :deep(.cm-tooltip-autocomplete) {
    background: var(--surface);
    border: 1px solid var(--chrome-line);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    font-family: var(--mono);
    font-size: 12px;
}
.editor :deep(.cm-tooltip-autocomplete ul li[aria-selected]) {
    background: var(--color-accent-100);
    color: var(--color-accent-900);
}
.editor :deep(.cm-completionDetail) { color: var(--faint); font-style: normal; margin-left: 10px; }
</style>
