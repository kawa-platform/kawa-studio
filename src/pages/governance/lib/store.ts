import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { sampleDocument } from './mock';
import type { GovernanceDocument, GovernanceExemption, GovernanceRule, GovernanceVariable } from './types';

const copy = (d: GovernanceDocument): GovernanceDocument => JSON.parse(JSON.stringify(d)) as GovernanceDocument;

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
    return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
}

/// The governance document being edited. Lives in a store so the rule editor page and the
/// list share one draft. Mock until GET/PUT /governance exist.
export const useGovernanceStore = defineStore('governance', () => {
    const saved = ref<GovernanceDocument>(sampleDocument());
    const doc = ref<GovernanceDocument>(sampleDocument());
    const applied = ref(true);
    const dirty = computed(() => JSON.stringify(doc.value) !== JSON.stringify(saved.value));

    const save = (apply: boolean): void => {
        saved.value = copy(doc.value);
        applied.value = apply;
    };
    const discard = (): void => { doc.value = copy(saved.value); };

    const upsertRule = (rule: GovernanceRule): void => { doc.value.rules = upsert(doc.value.rules, rule); };
    const upsertVariable = (variable: GovernanceVariable): void => { doc.value.variables = upsert(doc.value.variables, variable); };
    const upsertExemption = (exemption: GovernanceExemption): void => { doc.value.exemptions = upsert(doc.value.exemptions, exemption); };

    return { saved, doc, applied, dirty, save, discard, upsertRule, upsertVariable, upsertExemption };
});
