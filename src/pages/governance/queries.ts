import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed, onScopeDispose, ref, watch, type Ref } from 'vue';
import type { GovernanceDryRunRequest } from '@/api/types';
import { useApi } from '@/api/api';
import { ApiError } from '@/api/error';
import { keys } from '@/queries/keys';
import { fromGlobalExemption, fromRule, fromVariable, toGovernanceDocument } from './lib/apiMapper';
import { toGovernanceResult } from './lib/dryRun';
import type { GovernanceDocument, GovernanceExemption, GovernanceRule, GovernanceVariable } from './lib/types';

/// The governance section from the gateway: rules, global exemptions and variables.
export function useGovernance() {
    const api = useApi();
    return useQuery({
        queryKey: keys.governance(),
        queryFn: async () => toGovernanceDocument(await api.getGovernance()),
    });
}

/// The document the pages work with; empty until the gateway answered.
export function useGovernanceDocument() {
    const query = useGovernance();
    const doc = computed<GovernanceDocument>(() => query.data.value ?? { rules: [], exemptions: [], variables: [] });
    return { query, doc };
}

function invalidate(client: ReturnType<typeof useQueryClient>): Promise<unknown> {
    return client.invalidateQueries({ queryKey: keys.governance() });
}

/// Saves a rule. A rule renamed in the editor is written under its new name first and the
/// old one removed after, so a failed write never loses the original.
export function useSaveRule() {
    const api = useApi();
    const client = useQueryClient();
    return useMutation<void, ApiError, { rule: GovernanceRule; previousName?: string }>({
        mutationFn: async ({ rule, previousName }) => {
            const body = fromRule(rule);
            await api.upsertGovernanceRule(body.name, body);
            if (previousName && previousName !== body.name) await api.deleteGovernanceRule(previousName);
        },
        onSettled: () => invalidate(client),
    });
}

export function useDeleteRule() {
    const api = useApi();
    const client = useQueryClient();
    return useMutation<void, ApiError, string>({
        mutationFn: (name) => api.deleteGovernanceRule(name),
        onSettled: () => invalidate(client),
    });
}

export function useSaveExemption() {
    const api = useApi();
    const client = useQueryClient();
    return useMutation<void, ApiError, { exemption: GovernanceExemption; previousName?: string }>({
        mutationFn: async ({ exemption, previousName }) => {
            const body = fromGlobalExemption(exemption);
            await api.upsertGovernanceExemption(body.name, body);
            if (previousName && previousName !== body.name) await api.deleteGovernanceExemption(previousName);
        },
        onSettled: () => invalidate(client),
    });
}

export function useDeleteExemption() {
    const api = useApi();
    const client = useQueryClient();
    return useMutation<void, ApiError, string>({
        mutationFn: (name) => api.deleteGovernanceExemption(name),
        onSettled: () => invalidate(client),
    });
}

/// Saves a variable. Renaming writes the new name and then removes the old one; the gateway
/// refuses that removal while a rule still reads the old name, so the editor blocks renaming
/// a variable in use.
export function useSaveVariable() {
    const api = useApi();
    const client = useQueryClient();
    return useMutation<void, ApiError, { variable: GovernanceVariable; previousName?: string }>({
        mutationFn: async ({ variable, previousName }) => {
            const body = fromVariable(variable);
            await api.upsertGovernanceVariable(body.name, body);
            if (previousName && previousName !== body.name) await api.deleteGovernanceVariable(previousName);
        },
        onSettled: () => invalidate(client),
    });
}

export function useDeleteVariable() {
    const api = useApi();
    const client = useQueryClient();
    return useMutation<void, ApiError, string>({
        mutationFn: (name) => api.deleteGovernanceVariable(name),
        onSettled: () => invalidate(client),
    });
}

/// `source`, settled: updates only after it stopped changing for `ms`.
function debounced<T>(source: Ref<T>, ms: number): Ref<T> {
    const out = ref(source.value) as Ref<T>;
    let timer: ReturnType<typeof setTimeout> | undefined;
    watch(source, (next) => {
        clearTimeout(timer);
        timer = setTimeout(() => { out.value = next; }, ms);
    }, { deep: true });
    onScopeDispose(() => clearTimeout(timer));
    return out;
}

/// Asks the gateway what it would decide, re-asking a moment after the inputs stop changing.
/// `request` is null while the inputs are incomplete; `rules` are the rules the trace refers
/// to (the stored ones, or the one draft under test).
export function useDryRun(request: Ref<GovernanceDryRunRequest | null>, rules: Ref<GovernanceRule[]>) {
    const api = useApi();
    const settled = debounced(request, 250);
    const query = useQuery({
        queryKey: computed(() => ['governance', 'dry-run', settled.value] as const),
        queryFn: () => api.dryRunGovernance(settled.value!),
        enabled: computed(() => settled.value !== null),
        retry: false,
        placeholderData: (previous) => previous,
    });
    const result = computed(() => (query.data.value && request.value ? toGovernanceResult(query.data.value, rules.value) : null));
    return { query, result };
}
