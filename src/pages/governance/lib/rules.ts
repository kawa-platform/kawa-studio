import type { Target } from './resources';
import type { Combinator, GovernanceRule, SubRule, SubRuleCheck, SubRuleGroup } from './types';

/// Structural helpers for the sub-rule tree. Evaluation lives in cel.ts.

const newId = (): string => 's' + Math.random().toString(36).slice(2, 10);

export const newCheck = (name = '', expression = ''): SubRuleCheck => ({ id: newId(), kind: 'check', name, expression });

export const newGroup = (name = '', combinator: Combinator = 'any', checks: SubRuleCheck[] = [newCheck()]): SubRuleGroup =>
    ({ id: newId(), kind: 'group', name, combinator, checks });

export const combinatorOp: Record<Combinator, string> = { all: ' && ', any: ' || ' };
export const combinatorLabel: Record<Combinator, string> = { all: 'all of', any: 'any of' };

/// Every check in the tree, depth first.
export function checksOf(nodes: SubRule[]): SubRuleCheck[] {
    return nodes.flatMap((n) => (n.kind === 'check' ? [n] : n.checks));
}

/// Every CEL expression a rule evaluates, selector included.
export function ruleExpressions(rule: GovernanceRule): string[] {
    return [rule.selector, ...checksOf(rule.subRules).map((c) => c.expression)];
}

/// The single CEL expression the tree is equivalent to. An empty "all" holds, an empty
/// "any" does not, matching && and || identities.
export function compile(combinator: Combinator, nodes: SubRule[]): string {
    if (!nodes.length) return combinator === 'all' ? 'true' : 'false';
    const parts = nodes.map((n) => (n.kind === 'check' ? n.expression.trim() || 'true' : compile(n.combinator, n.checks)));
    return parts.length === 1 ? parts[0]! : parts.map((p) => `(${p})`).join(combinatorOp[combinator]);
}

export const compileRule = (rule: GovernanceRule): string => compile(rule.combinator, rule.subRules);

export const targetOf = (rule: GovernanceRule): Target =>
    ({ type: rule.resourceType, scope: rule.resourceType === 'topic' ? rule.scope : 'both' });

export function cloneRule(rule: GovernanceRule): GovernanceRule {
    return JSON.parse(JSON.stringify(rule)) as GovernanceRule;
}
