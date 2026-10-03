<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CelEditor from '../clusters/components/CelEditor.vue';
import ResourcePicker from './components/ResourcePicker.vue';
import { checkGlobalExemption, globToCel } from './lib/cel';
import { resourceCompletions, resourceDef, resources, type ResourceType } from './lib/resources';
import { useGovernanceDocument, useSaveExemption } from './queries';
import type { GovernanceExemption } from './lib/types';

const route = useRoute();
const router = useRouter();
const { query, doc } = useGovernanceDocument();
const save = useSaveExemption();

const exemptionId = computed(() => route.params.id as string | undefined);
const existing = computed(() => (exemptionId.value ? doc.value.exemptions.find((e) => e.id === exemptionId.value) ?? null : null));
const isEdit = computed(() => !!exemptionId.value);

const blank = (): GovernanceExemption => ({ id: 'e' + Date.now(), name: '', description: '', expression: '' });
const draft = ref<GovernanceExemption>(existing.value ? { ...existing.value } : blank());
const loaded = ref(!!existing.value || !isEdit.value);
watch(existing, (exemption) => {
    if (exemption && !loaded.value) {
        draft.value = { ...exemption };
        loaded.value = true;
    }
});

const variables = computed(() => doc.value.variables);

/// Every resource variable, since a global exemption spans resource kinds.
const completions = computed(() => [
    ...resources.flatMap((r) => resourceCompletions({ type: r.type, scope: 'both' }))
        .filter((c, i, all) => all.findIndex((x) => x.label === c.label) === i),
    ...variables.value.map((v) => ({ label: v.name, type: 'constant', detail: v.type })),
]);

const nameError = computed(() => {
    const name = draft.value.name.trim();
    const taken = doc.value.exemptions.some((e) => e.name === name && e.id !== draft.value.id);
    return name && taken ? 'Another exemption has this name.' : null;
});
const check = computed(() => checkGlobalExemption(draft.value.expression, variables.value));

const canSave = computed(() => !!draft.value.name.trim() && !nameError.value && check.value.ok);

// ── Quick fill: principal and resource-name globs → CEL ──
const quick = reactive<{ open: boolean; type: ResourceType; principal: string; name: string }>({
    open: !isEdit.value, type: 'topic', principal: '', name: '',
});
const quickSubject = computed(() => {
    const def = resourceDef(quick.type);
    return `${def.variable}.${def.test[0]!.key}`;
});
const quickCel = computed(() => [
    quick.principal.trim() ? globToCel('principal', quick.principal) : '',
    quick.name.trim() ? globToCel(quickSubject.value, quick.name) : '',
].filter(Boolean).join(' && '));
const applyQuick = (): void => {
    if (!quickCel.value) return;
    const current = draft.value.expression.trim();
    draft.value.expression = current ? `${current} && ${quickCel.value}` : quickCel.value;
};

const back = (): void => { void router.push({ name: 'governance', query: { tab: 'exemptions' } }); };

const saveError = ref<string | null>(null);

const submit = async (): Promise<void> => {
    if (!canSave.value || save.isPending.value) return;
    saveError.value = null;
    try {
        await save.mutateAsync({ exemption: { ...draft.value }, previousName: existing.value?.name });
        back();
    } catch (cause) {
        saveError.value = cause instanceof Error ? cause.message : 'Could not save the exemption.';
    }
};
</script>

<template>
    <div class="wrap">
        <div class="head">
            <h1>{{ isEdit ? 'Edit global exemption' : 'New global exemption' }}</h1>
            <p class="lede">
                Skips every rule for a request when its expression is true. To skip a single rule, add an
                exemption on that rule instead.
            </p>
        </div>

        <p v-if="isEdit && query.isPending.value" class="hint" role="status">Loading the exemption from the gateway…</p>
        <p v-else-if="isEdit && query.error.value" class="error">Could not load governance: {{ query.error.value.message }}</p>
        <p v-else-if="isEdit && !loaded" class="error">Exemption does not exist.</p>

        <template v-else>
            <section>
                <h2>1 · Identity</h2>
                <div class="field">
                    <label for="ex-name">Name</label>
                    <input id="ex-name" v-model="draft.name" class="input mono" placeholder="cargo-scratch" autocomplete="off">
                    <p v-if="nameError" class="field-error">{{ nameError }}</p>
                </div>
                <div class="field">
                    <label for="ex-desc">Description</label>
                    <input id="ex-desc" v-model="draft.description" class="input" placeholder="Why these requests skip governance" autocomplete="off">
                </div>
            </section>

            <section>
                <h2>2 · Expression</h2>
                <div class="field">
                    <CelEditor v-model="draft.expression" placeholder='principal == "User:app-cargo" &amp;&amp; topic.name.startsWith("scratch.")' :completions="completions" />
                    <p v-if="draft.expression.trim() && !check.ok" class="field-error">{{ check.error }}</p>
                    <p v-else-if="check.ok" class="check-ok"><i class="ph-duotone ph-check-circle" />Type-checks.</p>
                    <p class="hint">
                        Reads <code>principal</code>, <code>service</code>, any resource
                        (<code v-for="(r, i) in resources" :key="r.type">{{ r.variable }}{{ i < resources.length - 1 ? ', ' : '' }}</code>)
                        and your variables. Only the requested resource is bound, so <code>topic.name…</code> never matches a
                        consumer group request: an exemption that fails to evaluate does not apply.
                    </p>
                </div>

                <div class="quick">
                    <button type="button" class="quick-toggle" :aria-expanded="quick.open" @click="quick.open = !quick.open">
                        <i :class="['ph-duotone', quick.open ? 'ph-caret-down' : 'ph-caret-right']" />Build from patterns
                    </button>
                    <template v-if="quick.open">
                        <div class="field">
                            <label>Resource</label>
                            <ResourcePicker v-model="quick.type" />
                        </div>
                        <div class="row">
                            <div class="field">
                                <label for="q-principal">Principal pattern</label>
                                <input id="q-principal" v-model="quick.principal" class="input mono" placeholder="User:platform-*" autocomplete="off">
                            </div>
                            <div class="field">
                                <label for="q-name">{{ resourceDef(quick.type).test[0]!.label }} pattern</label>
                                <input id="q-name" v-model="quick.name" class="input mono" placeholder="legacy-*" autocomplete="off">
                            </div>
                        </div>
                        <p class="hint"><code>*</code> matches any run of characters. Leave a pattern empty to skip it.</p>
                        <div class="quick-out">
                            <code class="mono">{{ quickCel || '—' }}</code>
                            <button type="button" class="btn btn-secondary" :disabled="!quickCel" @click="applyQuick">
                                <i class="ph-duotone ph-arrow-up" />{{ draft.expression.trim() ? 'Add with &&' : 'Use' }}
                            </button>
                        </div>
                    </template>
                </div>
            </section>

            <div class="actions">
                <button class="btn btn-primary" :disabled="!canSave || save.isPending.value" @click="submit">
                    <i class="ph-duotone ph-check" />{{ save.isPending.value ? 'Saving…' : isEdit ? 'Save changes' : 'Add global exemption' }}
                </button>
                <button class="btn btn-secondary" @click="back">Cancel</button>
            </div>
            <p v-if="saveError" class="field-error" role="alert">{{ saveError }}</p>
            <p class="hint">Saving writes the exemption to the gateway and waits until it is applied. Try it with Test a resource.</p>
        </template>
    </div>
</template>

<style scoped>
.wrap { max-width: 720px; }
.head { margin-bottom: 22px; }
section { margin-bottom: 30px; }
h2 {
    font-family: var(--font-heading);
    font-size: 15px;
    margin: 0 0 14px;
    padding-left: 10px;
    box-shadow: inset 3px 0 0 var(--brand);
}
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.field { margin-bottom: 18px; }
.field > label { display: block; }
.hint { font-size: 11.5px; color: var(--faint); margin: 7px 0 0; max-width: 62ch; }
.hint code { font-family: var(--mono); color: var(--muted); }
.field-error { font-size: 11.5px; color: var(--error); margin: 7px 0 0; }
.actions { display: flex; gap: 8px; }
.check-ok { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--success); margin: 7px 0 0; }
.quick { border: 1px solid var(--chrome-line); border-radius: var(--radius-md); padding: 10px 12px; }
.quick-toggle { display: inline-flex; align-items: center; gap: 6px; border: 0; background: none; padding: 0; cursor: pointer; font-size: 13px; color: var(--color-text); }
.quick .field:first-of-type { margin-top: 12px; }
.quick-out { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
.quick-out code { flex: 1; font-size: 12px; color: var(--muted); overflow-wrap: anywhere; }
.error { color: var(--error); margin-top: 14px; }
</style>
