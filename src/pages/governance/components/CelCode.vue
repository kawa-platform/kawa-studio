<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ code: string; variables?: string[] }>();

type Token = { text: string; cls?: string };

/// Same token rules as CelEditor, for read-only display. Declared variables get their own colour.
const tokens = computed<Token[]>(() => {
    const vars = new Set(props.variables ?? []);
    const out: Token[] = [];
    const rules: [RegExp, string | ((m: string) => string | undefined)][] = [
        [/^\s+/, ''],
        [/^"(?:[^"\\]|\\.)*"?|^'(?:[^'\\]|\\.)*'?/, 'str'],
        [/^\d+(\.\d+)?/, 'num'],
        [/^(true|false|null|in)\b/, 'kw'],
        [/^(int|double|string|bool|size|matches|startsWith|endsWith|contains|has)\b/, 'fn'],
        [/^[A-Za-z_]\w*/, (m) => (m === 'topic' ? 'ctx' : vars.has(m) ? 'var' : undefined)],
        [/^(&&|\|\||==|!=|>=|<=|[<>!+\-*/%])/, 'op'],
    ];
    let rest = props.code;
    while (rest.length) {
        let hit = false;
        for (const [re, cls] of rules) {
            const m = rest.match(re);
            if (!m) continue;
            const c = typeof cls === 'function' ? cls(m[0]) : cls || undefined;
            out.push({ text: m[0], cls: c });
            rest = rest.slice(m[0].length);
            hit = true;
            break;
        }
        if (!hit) { out.push({ text: rest.charAt(0) }); rest = rest.slice(1); }
    }
    return out;
});
</script>

<template>
    <code class="cel"><span v-for="(t, i) in tokens" :key="i" :class="t.cls">{{ t.text }}</span></code>
</template>

<style scoped>
.cel { font-family: var(--mono); white-space: pre-wrap; word-break: break-word; }
.str { color: var(--brand-text); }
.num, .kw { color: var(--color-accent-700); }
.kw { font-weight: 600; }
.fn, .ctx { color: var(--code-pink); }
.var { color: var(--brand-text); font-weight: 500; }
.op { color: var(--muted); }
</style>
