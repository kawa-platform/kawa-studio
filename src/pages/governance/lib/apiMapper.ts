import type {
    GovernanceExemptionView, GovernanceExpression, GovernanceMatch, GovernanceResourceType,
    GovernanceRuleView, GovernanceSubRule, GovernanceTopicScope, GovernanceVariableView, GovernanceView,
} from '@/api/types';
import { fromWireOperation, operationOptions, toWireOperation, type ResourceType, type TopicScope } from './resources';
import type {
    Combinator, GovernanceDocument, GovernanceExemption, GovernanceRule, GovernanceVariable, RuleExemption, SubRule,
} from './types';

/// Converts between the gateway's governance wire format and the page's own model. The
/// gateway keys rules and exemptions by name, so the name doubles as the UI id; sub-rules and
/// rule exemptions get local ids that only live as long as the page.

const localId = (prefix: string): string => prefix + Math.random().toString(36).slice(2, 10);

const resourceTypes: Record<GovernanceResourceType, ResourceType> = {
    TOPIC: 'topic', GROUP: 'consumer-group', TRANSACTIONAL_ID: 'transactional-id',
};
const resourceTypesBack = Object.fromEntries(Object.entries(resourceTypes).map(([k, v]) => [v, k])) as
    Record<ResourceType, GovernanceResourceType>;

const scopes: Record<GovernanceTopicScope, TopicScope> = { BOTH: 'both', PHYSICAL: 'physical', VIRTUAL: 'virtual' };
const scopesBack = Object.fromEntries(Object.entries(scopes).map(([k, v]) => [v, k])) as Record<TopicScope, GovernanceTopicScope>;

const combinator = (m: GovernanceMatch): Combinator => (m === 'ANY' ? 'any' : 'all');
const match = (c: Combinator): GovernanceMatch => (c === 'any' ? 'ANY' : 'ALL');

const cel = (value: string): GovernanceExpression => ({ type: 'CEL', value: value.trim() });
const orNull = (s: string | undefined): string | null => (s?.trim() ? s.trim() : null);
/// Sub-rule messages are optional in the UI model: absent rather than empty.
const message = (m: string | null): { errorMessage?: string } => (m ? { errorMessage: m } : {});

// ── wire → UI ──

function toSubRule(s: GovernanceSubRule): SubRule {
    if (s.kind === 'group') {
        return {
            id: localId('g'), kind: 'group', name: s.name, ...message(s.errorMessage),
            combinator: combinator(s.match),
            checks: s.checks.map((c) => ({ id: localId('c'), kind: 'check', name: c.name, ...message(c.errorMessage), expression: c.expression.value })),
        };
    }
    return { id: localId('c'), kind: 'check', name: s.name, ...message(s.errorMessage), expression: s.expression.value };
}

function toExemption(e: GovernanceExemptionView, id: string): RuleExemption {
    return { id, name: e.name, description: e.description ?? '', expression: e.expression.value };
}

export function toRule(view: GovernanceRuleView): GovernanceRule {
    return {
        id: view.name,
        name: view.name,
        description: view.description ?? '',
        errorMessage: view.errorMessage,
        resourceType: resourceTypes[view.selector.resourceType] ?? 'topic',
        scope: scopes[view.selector.scope ?? 'BOTH'] ?? 'both',
        operations: (view.selector.operations ?? ['CREATE']).map(fromWireOperation),
        selector: view.selector.expression?.value ?? 'true',
        combinator: combinator(view.match),
        subRules: view.subRules.map(toSubRule),
        exemptions: view.exemptions.map((e) => toExemption(e, localId('x'))),
    };
}

export function toGlobalExemption(view: GovernanceExemptionView): GovernanceExemption {
    return toExemption(view, view.name);
}

const nonEmpty = <T>(m: Record<string, T> | undefined): Record<string, T> | undefined =>
    (m && Object.keys(m).length ? m : undefined);

export function toVariable(view: GovernanceVariableView): GovernanceVariable {
    return {
        id: view.name, name: view.name, type: view.type, value: view.value, note: view.note ?? '',
        samples: nonEmpty(view.samples), notes: nonEmpty(view.notes), extraExamples: nonEmpty(view.extraExamples),
    };
}

export function fromVariable(v: GovernanceVariable): GovernanceVariableView {
    return {
        name: v.name.trim(), type: v.type, value: v.value.trim(), note: orNull(v.note),
        samples: v.samples ?? {}, notes: v.notes ?? {}, extraExamples: v.extraExamples ?? {},
    };
}

export function toGovernanceDocument(view: GovernanceView): GovernanceDocument {
    const byName = <T extends { name: string }>(a: T, b: T): number => a.name.localeCompare(b.name);
    return {
        rules: view.rules.map(toRule).sort(byName),
        exemptions: view.exemptions.map(toGlobalExemption).sort(byName),
        variables: (view.variables ?? []).map(toVariable).sort(byName),
    };
}

// ── UI → wire ──

function fromSubRule(s: SubRule): GovernanceSubRule {
    if (s.kind === 'group') {
        return {
            kind: 'group', name: s.name.trim(), errorMessage: orNull(s.errorMessage), match: match(s.combinator),
            checks: s.checks.map((c) => ({ kind: 'check', name: c.name.trim(), errorMessage: orNull(c.errorMessage), expression: cel(c.expression) })),
        };
    }
    return { kind: 'check', name: s.name.trim(), errorMessage: orNull(s.errorMessage), expression: cel(s.expression) };
}

function fromExemption(e: RuleExemption): GovernanceExemptionView {
    return { name: e.name.trim(), description: orNull(e.description), expression: cel(e.expression) };
}

export function fromRule(rule: GovernanceRule): GovernanceRuleView {
    const selector = rule.selector.trim();
    return {
        name: rule.name.trim(),
        errorMessage: rule.errorMessage.trim(),
        description: orNull(rule.description),
        selector: {
            resourceType: resourceTypesBack[rule.resourceType],
            expression: !selector || selector === 'true' ? null : cel(selector),
            scope: rule.resourceType === 'topic' ? scopesBack[rule.scope] : 'BOTH',
            operations: rule.resourceType === 'topic' && rule.operations.length
                ? operationOptions.map((o) => o.value).filter((o) => rule.operations.includes(o)).map(toWireOperation)
                : ['CREATE'],
        },
        match: match(rule.combinator),
        subRules: rule.subRules.map(fromSubRule),
        exemptions: rule.exemptions.map(fromExemption),
    };
}

export const fromGlobalExemption = fromExemption;
