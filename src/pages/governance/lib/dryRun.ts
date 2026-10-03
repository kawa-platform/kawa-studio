import type {
    GovernanceDryRunRequest, GovernanceDryRunView, GovernanceNodeTraceView, GovernanceTraceOutcome,
} from '@/api/types';
import { fromRule } from './apiMapper';
import type { GovernanceResult, NodeTrace, RuleOutcome, RuleTrace } from './cel';
import { resourceDef, toWireOperation } from './resources';
import type { GovernanceRule, ResourceInput, SubRule } from './types';

/// Converts between the page's test inputs and results and the gateway's dry-run wire format.

const wireType = { topic: 'TOPIC', 'consumer-group': 'GROUP', 'transactional-id': 'TRANSACTIONAL_ID' } as const;

const str = (v: unknown): string => String(v ?? '').trim();
const num = (v: unknown): number | undefined => {
    const n = Number(v);
    return str(v) && Number.isFinite(n) ? Math.trunc(n) : undefined;
};

/// The test inputs as a dry-run body; with `rule`, the gateway evaluates that unsaved rule alone.
export function toDryRunRequest(input: ResourceInput, rule?: GovernanceRule): GovernanceDryRunRequest {
    const v = input.values;
    const virtual = input.type === 'topic' && v.virtual === true;
    let resource: Record<string, unknown>;
    if (input.type !== 'topic') {
        resource = { [resourceDef(input.type).test[0]!.key]: str(v[resourceDef(input.type).test[0]!.key]) };
    } else if (virtual) {
        resource = { name: str(v.name), physicalTopic: str(v.physicalTopic) };
    } else {
        const configs: Record<string, string> = {};
        for (const key of ['cleanup.policy', 'retention.ms']) if (str(v[key])) configs[key] = str(v[key]);
        resource = { name: str(v.name), partitions: num(v.partitions), replicationFactor: num(v.replicationFactor), configs };
    }
    return {
        resourceType: wireType[input.type],
        operation: input.type === 'topic' ? toWireOperation(input.operation ?? 'create') : 'CREATE',
        virtual,
        resource,
        principal: input.principal ?? '',
        service: input.service ?? '',
        ...(rule ? { rule: fromRule(rule) } : {}),
    };
}

const outcome = (o: GovernanceTraceOutcome): RuleOutcome => o.toLowerCase() as RuleOutcome;

/// Pairs each trace node with the sub-rule it reports on; the gateway keeps their order.
function nodes(traces: GovernanceNodeTraceView[], subRules: SubRule[]): NodeTrace[] {
    return traces.flatMap((t, i): NodeTrace[] => {
        const node = subRules[i];
        if (!node) return [];
        return [{
            node,
            outcome: outcome(t.outcome),
            ...(t.detail ? { detail: t.detail } : {}),
            ...(node.kind === 'group' ? { children: nodes(t.checks, node.checks) } : {}),
        }];
    });
}

/// The gateway's answer in the shape the pages render. Rules are matched by name against
/// `rules` (the stored ones, or the one draft being tested).
export function toGovernanceResult(view: GovernanceDryRunView, rules: GovernanceRule[]): GovernanceResult {
    const byName = new Map(rules.map((r) => [r.name, r]));
    const trace: RuleTrace[] = view.rules.flatMap((t): RuleTrace[] => {
        const rule = byName.get(t.rule) ?? (rules.length === 1 ? rules[0] : undefined);
        if (!rule) return [];
        return [{
            rule,
            outcome: outcome(t.outcome),
            ...(t.detail ? { detail: t.detail } : {}),
            ...(t.exemptedBy ? { exemptedBy: t.exemptedBy } : {}),
            nodes: nodes(t.subRules, rule.subRules),
            ...(t.outcome === 'FAIL' || t.outcome === 'ERROR' ? { path: t.path, message: t.message ?? rule.errorMessage } : {}),
        }];
    });
    const failed = trace.find((t) => t.outcome === 'fail' || t.outcome === 'error');
    return {
        status: view.allowed ? 201 : 403,
        ...(view.exemptedBy ? { exemptedBy: view.exemptedBy } : {}),
        ...(failed && !view.allowed ? { failed } : {}),
        trace,
    };
}
