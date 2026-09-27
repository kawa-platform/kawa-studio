<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGovernanceStore } from './lib/store';
import type { GovernanceExemption } from './lib/types';

const route = useRoute();
const router = useRouter();
const store = useGovernanceStore();

const exemptionId = computed(() => route.params.id as string | undefined);
const existing = computed(() => (exemptionId.value ? store.doc.exemptions.find((e) => e.id === exemptionId.value) ?? null : null));
const isEdit = computed(() => !!exemptionId.value);

const blank = (): GovernanceExemption => ({ id: 'e' + Date.now(), name: '', principalPattern: '', topicPattern: '' });
const draft = ref<GovernanceExemption>(existing.value ? { ...existing.value } : blank());

const nameError = computed(() => {
    const name = draft.value.name.trim();
    const taken = store.doc.exemptions.some((e) => e.name === name && e.id !== draft.value.id);
    return name && taken ? 'Another exemption has this name.' : null;
});

const canSave = computed(() =>
    !!draft.value.name.trim() && !nameError.value
    && !!draft.value.principalPattern.trim() && !!draft.value.topicPattern.trim());

const back = (): void => { void router.push({ name: 'governance', query: { tab: 'exemptions' } }); };

const submit = (): void => {
    if (!canSave.value) return;
    store.upsertExemption({
        ...draft.value,
        name: draft.value.name.trim(),
        principalPattern: draft.value.principalPattern.trim(),
        topicPattern: draft.value.topicPattern.trim(),
    });
    back();
};
</script>

<template>
    <div class="form">
        <div class="head">
            <h1>{{ isEdit ? 'Edit exemption' : 'New exemption' }}</h1>
            <p class="lede">
                Skips every rule for a request, but only when both patterns match: the requesting principal
                and the topic name.
            </p>
        </div>

        <p v-if="isEdit && !existing" class="error">Exemption does not exist.</p>

        <template v-else>
            <section>
                <h2>1 · Identity</h2>
                <div class="field">
                    <label for="ex-name">Name</label>
                    <input id="ex-name" v-model="draft.name" class="input mono" placeholder="cargo-scratch" autocomplete="off">
                    <p v-if="nameError" class="field-error">{{ nameError }}</p>
                </div>
            </section>

            <section>
                <h2>2 · Match</h2>
                <div class="row">
                    <div class="field">
                        <label for="ex-principal">Principal pattern</label>
                        <input id="ex-principal" v-model="draft.principalPattern" class="input mono" placeholder="User:platform-*" autocomplete="off">
                    </div>
                    <div class="field">
                        <label for="ex-topic">Topic pattern</label>
                        <input id="ex-topic" v-model="draft.topicPattern" class="input mono" placeholder="scratch.*" autocomplete="off">
                    </div>
                </div>
                <p class="hint"><code>*</code> matches any run of characters. Both patterns must match for the exemption to apply.</p>
            </section>

            <div class="actions">
                <button class="btn btn-primary" :disabled="!canSave" @click="submit">
                    <i class="ph-duotone ph-check" />{{ isEdit ? 'Save changes' : 'Add exemption' }}
                </button>
                <button class="btn btn-secondary" @click="back">Cancel</button>
            </div>
            <p class="hint">Changes stay a draft until you save and apply them on the Governance page.</p>
        </template>
    </div>
</template>


