<script setup lang="ts">
import { computed, ref } from 'vue';
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui';
import { runGovernance, type RuleOutcome } from '../lib/cel';
import type { GovernanceDocument } from '../lib/types';

const open = defineModel<boolean>('open', { required: true });

const props = defineProps<{ document: GovernanceDocument }>();

const principal = ref('User:app-cargo');
const name = ref('app.cargo.flight');
const partitions = ref(12);
const replicationFactor = ref(3);
const cleanupPolicy = ref('delete');
const retentionMs = ref('604800000');

const inputError = computed(() => {
    if (!name.value.trim()) return 'Enter a topic name.';
    if (!Number.isInteger(partitions.value) || partitions.value < 1) return 'Partitions must be a whole number of at least 1.';
    if (!Number.isInteger(replicationFactor.value) || replicationFactor.value < 1) return 'Replication factor must be a whole number of at least 1.';
    return null;
});

/// Re-evaluated on every keystroke, against the unsaved document.
const result = computed(() => {
    if (inputError.value) return null;
    const config: Record<string, string> = {};
    if (cleanupPolicy.value.trim()) config['cleanup.policy'] = cleanupPolicy.value.trim();
    if (retentionMs.value.trim()) config['retention.ms'] = retentionMs.value.trim();
    return runGovernance(props.document, {
        name: name.value.trim(),
        partitions: partitions.value,
        replicationFactor: replicationFactor.value,
        config,
    }, principal.value.trim());
});

const outcome: Record<RuleOutcome, { icon: string; cls: string; label: string }> = {
    pass: { icon: 'ph-check-circle', cls: 'ok', label: 'pass' },
    fail: { icon: 'ph-x-circle', cls: 'bad', label: 'fail' },
    error: { icon: 'ph-warning-circle', cls: 'warn', label: 'error' },
    skipped: { icon: 'ph-minus-circle', cls: 'skip', label: 'not applicable' },
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
                        <DialogTitle class="name">Test a topic</DialogTitle>
                        <DialogDescription class="desc">Evaluates the current, unsaved rules the way the gateway does on physical topic creation.</DialogDescription>
                    </div>
                    <DialogClose class="btn btn-icon btn-secondary" aria-label="Close">
                        <i class="ph-duotone ph-x" />
                    </DialogClose>
                </div>

                <div class="body">
                    <section>
                        <div class="field">
                            <label for="t-principal">Principal</label>
                            <input id="t-principal" v-model="principal" class="input mono" autocomplete="off">
                        </div>
                        <div class="field">
                            <label for="t-name">Topic name</label>
                            <input id="t-name" v-model="name" class="input mono" autocomplete="off">
                        </div>
                        <div class="row">
                            <div class="field">
                                <label for="t-partitions">Partitions</label>
                                <input id="t-partitions" v-model.number="partitions" type="number" min="1" class="input">
                            </div>
                            <div class="field">
                                <label for="t-rf">Replication factor</label>
                                <input id="t-rf" v-model.number="replicationFactor" type="number" min="1" class="input">
                            </div>
                        </div>
                        <div class="row">
                            <div class="field">
                                <label for="t-cleanup">cleanup.policy</label>
                                <input id="t-cleanup" v-model="cleanupPolicy" class="input mono" autocomplete="off">
                            </div>
                            <div class="field">
                                <label for="t-retention">retention.ms</label>
                                <input id="t-retention" v-model="retentionMs" class="input mono" autocomplete="off">
                            </div>
                        </div>
                    </section>

                    <p v-if="inputError" class="note">{{ inputError }}</p>

                    <template v-else-if="result">
                        <section class="verdict" :class="result.status === 201 ? 'ok' : 'bad'">
                            <div class="code mono">{{ result.status }}</div>
                            <div>
                                <div class="verdict-title">
                                    {{ result.status === 201 ? (result.exemptedBy ? 'Created, exempt from governance' : 'Would be created') : 'Refused by governance' }}
                                </div>
                                <p v-if="result.exemptedBy" class="note">Exemption <span class="mono">{{ result.exemptedBy }}</span> matched; no rule was evaluated.</p>
                                <p v-else-if="result.error" class="note">{{ result.error }}</p>
                                <template v-else-if="result.failed">
                                    <p class="mono failed">{{ result.failed.rule.name }}</p>
                                    <p class="note">{{ result.failed.detail ?? result.failed.rule.message }}</p>
                                </template>
                                <p v-else class="note">Passed every rule that applies.</p>
                            </div>
                        </section>

                        <section v-if="result.trace.length">
                            <h6>Trace</h6>
                            <div v-for="step in result.trace" :key="step.rule.id" class="step" :class="outcome[step.outcome].cls">
                                <i :class="['ph-duotone', outcome[step.outcome].icon]" />
                                <span class="mono step-name">{{ step.rule.name }}</span>
                                <span class="step-label">{{ outcome[step.outcome].label }}</span>
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
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.note { font-size: 12.5px; color: var(--muted); margin: 4px 0 0; }

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
