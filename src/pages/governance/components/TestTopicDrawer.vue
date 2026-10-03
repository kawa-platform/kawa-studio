<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui';
import type { RuleOutcome } from '../lib/cel';
import { toDryRunRequest } from '../lib/dryRun';
import { useDryRun } from '../queries';
import {
    initialTestValues, operationOptions, resourceDef, resources, testFieldsFor,
    type Operation, type ResourceType, type TestValues, type TopicKind,
} from '../lib/resources';
import SegPicker from './SegPicker.vue';
import type { GovernanceDocument } from '../lib/types';
import ResourcePicker from './ResourcePicker.vue';

const open = defineModel<boolean>('open', { required: true });

const props = defineProps<{ document: GovernanceDocument }>();

const principal = ref('User:app-cargo');
const service = ref('');
const type = ref<ResourceType>('topic');
const all = reactive(Object.fromEntries(resources.map((r) => [r.type, initialTestValues(r.type)])) as Record<ResourceType, TestValues>);
all.topic.name = 'app.cargo.flight';
all['consumer-group'].id = 'app.cargo.billing';
all['transactional-id'].id = 'app.cargo.tx';

const def = computed(() => resourceDef(type.value));
const values = computed(() => all[type.value]);
const kind = ref<TopicKind>('physical');
const kindOptions: { value: TopicKind; label: string }[] = [{ value: 'physical', label: 'Physical' }, { value: 'virtual', label: 'Virtual' }];
const operation = ref<Operation>('create');
/// On alter the fields describe the topic as it will be after the change, on delete as it is.
const fields = computed(() => testFieldsFor(type.value, kind.value));

const inputError = computed(() => {
    const first = def.value.test[0]!;
    if (!String(values.value[first.key] ?? '').trim()) return `Enter a ${first.label.toLowerCase()}.`;
    const bad = fields.value.find((f) => f.kind === 'int' && (!Number.isInteger(Number(values.value[f.key])) || Number(values.value[f.key]) < 1));
    return bad ? `${bad.label} must be a whole number of at least 1.` : null;
});

/// The gateway evaluates the applied governance; asked again shortly after the inputs settle.
const request = computed(() => (inputError.value || !open.value ? null : toDryRunRequest({
    type: type.value, operation: type.value === 'topic' ? operation.value : 'create', values: { ...values.value, virtual: kind.value === 'virtual' },
    principal: principal.value.trim(), service: service.value.trim(),
})));
const { query, result } = useDryRun(request, computed(() => props.document.rules));

const outcome: Record<RuleOutcome, { icon: string; cls: string; label: string }> = {
    pass: { icon: 'ph-check-circle', cls: 'ok', label: 'pass' },
    fail: { icon: 'ph-x-circle', cls: 'bad', label: 'fail' },
    error: { icon: 'ph-warning-circle', cls: 'warn', label: 'error' },
    skipped: { icon: 'ph-minus-circle', cls: 'skip', label: 'not applicable' },
    exempted: { icon: 'ph-shield-check', cls: 'skip', label: 'exempted' },
};
</script>

<template>
    <DialogRoot v-model:open="open">
        <DialogPortal>
            <DialogOverlay class="overlay drawer-overlay" />
            <DialogContent class="drawer">
                <div class="head">
                    <div class="head-text">
                        <span class="kicker">dry run · nothing is created</span>
                        <DialogTitle class="name">Test a resource</DialogTitle>
                        <DialogDescription class="desc">The gateway evaluates its applied rules for this request. Nothing is created.</DialogDescription>
                    </div>
                    <DialogClose class="btn btn-icon btn-secondary" aria-label="Close">
                        <i class="ph-duotone ph-x" />
                    </DialogClose>
                </div>

                <div class="body">
                    <section>
                        <div class="row">
                            <div class="field">
                                <label for="t-principal">Principal</label>
                                <input id="t-principal" v-model="principal" class="input mono" autocomplete="off">
                            </div>
                            <div class="field">
                                <label for="t-service">Service</label>
                                <input id="t-service" v-model="service" class="input mono" autocomplete="off">
                            </div>
                        </div>
                        <div class="field">
                            <label>Resource</label>
                            <ResourcePicker v-model="type" />
                        </div>
                        <div v-if="type === 'topic'" class="field">
                            <label>Kind</label>
                            <SegPicker v-model="kind" :options="kindOptions" label="Topic kind" />
                        </div>
                        <div v-if="type === 'topic'" class="field">
                            <label>Request</label>
                            <SegPicker v-model="operation" :options="operationOptions" label="Request" />
                        </div>
                        <div class="row">
                            <div v-for="(f, i) in fields" :key="type + f.key" class="field" :class="{ wide: i === 0 }">
                                <label :for="'t-' + f.key">{{ f.label }}</label>
                                <input
                                    :id="'t-' + f.key"
                                    v-model="values[f.key]"
                                    :type="f.kind === 'int' ? 'number' : 'text'"
                                    class="input"
                                    :class="{ mono: f.mono }"
                                    autocomplete="off"
                                >
                            </div>
                        </div>
                    </section>

                    <p v-if="inputError" class="note">{{ inputError }}</p>
                    <p v-else-if="query.error.value" class="note bad-text">The gateway could not evaluate it: {{ query.error.value.message }}</p>
                    <p v-else-if="!result" class="note">Asking the gateway…</p>

                    <template v-else-if="result">
                        <section class="verdict" :class="result.status === 201 ? 'ok' : 'bad'">
                            <div class="code mono">{{ result.status }}</div>
                            <div>
                                <div class="verdict-title">
                                    {{ result.status === 201 ? (result.exemptedBy ? 'Created, globally exempt' : 'Would be created') : 'Refused by governance' }}
                                </div>
                                <p v-if="result.exemptedBy" class="note">Global exemption <span class="mono">{{ result.exemptedBy }}</span> matched; no rule was evaluated.</p>
                                <p v-else-if="result.error" class="note">{{ result.error }}</p>
                                <template v-else-if="result.failed">
                                    <p class="mono failed">{{ [result.failed.rule.name, ...(result.failed.path ?? [])].join(' › ') }}</p>
                                    <p class="note">{{ result.failed.detail ?? result.failed.message ?? result.failed.rule.errorMessage }}</p>
                                </template>
                                <p v-else class="note">Passed every {{ def.singular }} rule that applies.</p>
                            </div>
                        </section>

                        <section v-if="result.trace.length">
                            <h6>Trace</h6>
                            <div v-for="step in result.trace" :key="step.rule.id" class="step" :class="outcome[step.outcome].cls">
                                <i :class="['ph-duotone', outcome[step.outcome].icon]" />
                                <span class="mono step-name">{{ step.rule.name }}</span>
                                <span class="step-label">{{ outcome[step.outcome].label }}<template v-if="step.exemptedBy"> · {{ step.exemptedBy }}</template></span>
                                <p v-if="step.detail" class="note step-detail">{{ step.detail }}</p>
                            </div>
                        </section>
                    </template>
                </div>
            </DialogContent>
        </DialogPortal>
    </DialogRoot>
</template>

<style scoped>
.drawer-overlay { background: color-mix(in srgb, #020b18 52%, transparent); }

.head {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 20px 26px 16px;
    border-bottom: 2px solid color-mix(in srgb, var(--brand) 50%, transparent);
    position: sticky;
    top: 0;
    background: var(--chrome);
    z-index: 1;
}
.head-text { margin-right: auto; min-width: 0; }
.kicker { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--brand-text); }
.name { margin: 4px 0 0; font-size: 19px; font-weight: 500; }
.desc { font-size: 12.5px; color: var(--muted); margin: 4px 0 0; }

.body { padding: 22px 26px 60px; }
section { margin-bottom: 24px; }
h6 { margin: 0 0 8px; color: var(--brand-text); }
.field { margin-bottom: 14px; }
.field > label { display: block; }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 0 14px; }
.row .wide { grid-column: 1 / -1; }
.note { font-size: 12.5px; color: var(--muted); margin: 4px 0 0; }
.bad-text { color: var(--color-accent-2-700); }

.verdict { display: flex; gap: 14px; align-items: flex-start; padding: 14px 16px; border: 1px solid var(--chrome-line); border-radius: var(--radius-md); }
.verdict.ok { border-color: var(--success); }
.verdict.bad { border-color: var(--color-accent-2); }
.code { font-size: 20px; font-weight: 600; line-height: 1.2; }
.verdict.ok .code { color: var(--success); }
.verdict.bad .code { color: var(--color-accent-2-700); }
.verdict-title { font-weight: 600; font-size: 15px; }
.failed { font-size: 12.5px; margin: 4px 0 0; color: var(--color-accent-2-700); }

.step { display: grid; grid-template-columns: 18px minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 7px 0; border-bottom: 1px solid var(--chrome-line); }
.step i { font-size: 16px; }
.step-name { font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; }
.step-label { font-size: 12px; color: var(--muted); }
.step-detail { grid-column: 2 / -1; margin: 0; }
.ok i { color: var(--success); }
.bad i, .bad .step-label { color: var(--color-accent-2-700); }
.warn i, .warn .step-label { color: var(--warning); }
.skip { color: var(--faint); }
.skip i { color: var(--faint); }
</style>
