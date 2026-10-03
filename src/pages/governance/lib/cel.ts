import { Environment } from '@marcbachmann/cel-js';
import type { GovernanceRule, GovernanceVariable, SubRule, VariableType } from './types';
import { inScope, requestFields, resourceDef, resources, resourceVariables, targetLabel, type ResourceType, type Target } from './resources';
import { targetOf } from './rules';

/// Thin adapter over @marcbachmann/cel-js, used only to type-check expressions while they are
/// typed. Evaluation is the gateway's job (POST /governance/dry-run, see dryRun.ts); the types
/// below are the shape the pages render its answer in.

export type CheckResult = { ok: true; type: string } | { ok: false; error: string };

/// "exempted": one of the rule's own exemptions matched, so the rule was not evaluated.
export type RuleOutcome = 'pass' | 'fail' | 'skipped' | 'error' | 'exempted';

/// Outcome of one sub-rule. "skipped" means short-circuited: an earlier sibling already
/// decided the group.
export interface NodeTrace {
    node: SubRule;
    outcome: RuleOutcome;
    detail?: string;
    children?: NodeTrace[];
}

export interface RuleTrace {
    rule: GovernanceRule;
    outcome: RuleOutcome;
    detail?: string;
    /// On exempted: the rule exemption that matched.
    exemptedBy?: string;
    nodes: NodeTrace[];
    /// On fail: the sub-rule names leading to the decisive failure.
    path?: string[];
    /// On fail: the most specific error message along that path.
    message?: string;
}

export interface GovernanceResult {
    status: 201 | 403;
    exemptedBy?: string;
    failed?: RuleTrace;
    error?: string;
    trace: RuleTrace[];
}

const message = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x);

/// Parses a variable's authored literal and converts it to the value CEL expects.
/// CEL ints are BigInt in this library.
export function parseLiteral(raw: string, type: VariableType): unknown {
    let v: unknown;
    try {
        v = JSON.parse(raw);
    } catch {
        throw new Error('Not a valid literal. Strings take double quotes; lists use [ ].');
    }
    const fail = (): never => { throw new Error(`Value is not a ${type}.`); };
    switch (type) {
        case 'string': return typeof v === 'string' ? v : fail();
        case 'int': return isInt(v) ? BigInt(v) : fail();
        case 'double': return typeof v === 'number' ? v : fail();
        case 'bool': return typeof v === 'boolean' ? v : fail();
        case 'list<string>':
            return Array.isArray(v) && v.every((x) => typeof x === 'string') ? v : fail();
        case 'list<int>':
            return Array.isArray(v) && v.every(isInt) ? v.map((x) => BigInt(x)) : fail();
    }
}

/// Binds only the context variable of the given resource kind, so a consumer-group rule
/// that reads `topic` fails the type check, exactly as it would in the gateway. `'any'`
/// declares every resource variable, for global exemptions that span resource kinds.
function environment(variables: GovernanceVariable[], type: ResourceType | 'any'): Environment {
    const env = new Environment();
    for (const r of resources) if (type === 'any' || r.type === type) env.registerVariable(r.variable, 'map');
    for (const f of requestFields) env.registerVariable(f.name, f.type);
    const seen = new Set<string>(resourceVariables);
    for (const v of variables) {
        if (seen.has(v.name)) continue;
        seen.add(v.name);
        try {
            env.registerVariable(v.name, v.type);
        } catch {
            env.registerVariable(v.name, v.type.startsWith('list') ? 'list' : 'dyn');
        }
    }
    return env;
}

const stripStrings = (expression: string): string => expression.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');

/// True when the expression reads variable.field, e.g. topic.partitions.
export function referencesField(expression: string, variable: string, field: string): boolean {
    return new RegExp(`(^|[^.\\w])${variable}\\s*\\.\\s*${field}(?!\\w)`).test(stripStrings(expression));
}

/// Type-checks an expression against one target's context and the declared variables.
/// Reading another resource's variable, or a topic field the target's topics don't have,
/// gets a message that says what to use instead. `guarded` means an enclosing condition
/// already tests topic.virtual.
export function checkExpression(expression: string, variables: GovernanceVariable[], target: Target, guarded = false): CheckResult {
    if (!expression.trim()) return { ok: false, error: 'Expression is empty.' };
    const def = resourceDef(target.type);
    const label = targetLabel(target);
    const foreign = resources.find((r) => r.type !== target.type && referencesVariable(expression, r.variable));
    if (foreign) {
        return { ok: false, error: `${foreign.variable} is not available on ${label} rules; use ${def.variable}.` };
    }
    const guards = guarded || referencesField(expression, def.variable, 'virtual');
    for (const f of def.fields) {
        if (!f.only || !referencesField(expression, def.variable, f.name)) continue;
        const path = `${def.variable}.${f.name}`;
        if (!inScope(target.scope, f.only)) {
            return { ok: false, error: `${path} only exists on ${f.only} topics; this rule applies to ${target.scope} topics.` };
        }
        if (target.scope === 'both' && !guards) {
            const guard = f.only === 'physical' ? '!topic.virtual' : 'topic.virtual';
            return { ok: false, error: `${path} only exists on ${f.only} topics. Set the scope to ${f.only} only, or guard with ${guard} && …` };
        }
    }
    try {
        const result = environment(variables, target.type).check(expression);
        if (!result.valid) return { ok: false, error: message(result.error) };
        const t = String(result.type);
        if (t !== 'bool' && t !== 'dyn') return { ok: false, error: `Must return bool; returns ${t}.` };
        return { ok: true, type: t };
    } catch (cause) {
        return { ok: false, error: message(cause) };
    }
}

export function referencesVariable(expression: string, name: string): boolean {
    const code = expression.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^.\\w])${escaped}(?!\\w)`).test(code);
}

/// Type-checks a global exemption. It may read any resource variable; at evaluation time
/// only the requested resource's variable is bound, so reading another one makes the
/// exemption error, and an erroring exemption does not apply.
export function checkGlobalExemption(expression: string, variables: GovernanceVariable[]): CheckResult {
    if (!expression.trim()) return { ok: false, error: 'Expression is empty.' };
    try {
        const result = environment(variables, 'any').check(expression);
        if (!result.valid) return { ok: false, error: message(result.error) };
        const t = String(result.type);
        if (t !== 'bool' && t !== 'dyn') return { ok: false, error: `Must return bool; returns ${t}.` };
        return { ok: true, type: t };
    } catch (cause) {
        return { ok: false, error: message(cause) };
    }
}

/// CEL for "subject matches this glob": == without *, startsWith for one trailing *,
/// otherwise a regex. Used by the global exemption quick fill.
export function globToCel(subject: string, pattern: string): string {
    const p = pattern.trim();
    if (!p.includes('*')) return `${subject} == ${JSON.stringify(p)}`;
    if (p.indexOf('*') === p.length - 1) return `${subject}.startsWith(${JSON.stringify(p.slice(0, -1))})`;
    const source = p.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
    return `${subject}.matches(${JSON.stringify(`^${source}$`)})`;
}

/// Flattens a trace to sub-rule id → outcome, for badges in the editor.
export function outcomesOf(nodes: NodeTrace[], into = new Map<string, RuleOutcome>()): Map<string, RuleOutcome> {
    for (const n of nodes) {
        into.set(n.node.id, n.outcome);
        if (n.children) outcomesOf(n.children, into);
    }
    return into;
}

/// Type-checks every sub-rule. Returns sub-rule id → problem; empty means the tree is valid.
export function checkSubRules(
    nodes: SubRule[], variables: GovernanceVariable[], target: Target, guarded = false, into = new Map<string, string>(),
): Map<string, string> {
    for (const n of nodes) {
        if (!n.name.trim()) into.set(n.id, 'Name the sub-rule.');
        else if (n.kind === 'group' && !n.checks.length) into.set(n.id, 'Add at least one check.');
        else if (n.kind === 'check') {
            const r = checkExpression(n.expression, variables, target, guarded);
            if (!r.ok) into.set(n.id, r.error);
        }
        if (n.kind === 'group') checkSubRules(n.checks, variables, target, guarded, into);
    }
    return into;
}

/// Checks a whole rule against its target. A selector that tests topic.virtual guards
/// every sub-rule below it.
export function checkRule(rule: GovernanceRule, variables: GovernanceVariable[]): {
    selector: CheckResult;
    issues: Map<string, string>;
    /// Rule exemption id → problem.
    exemptions: Map<string, string>;
} {
    const target = targetOf(rule);
    const exemptions = new Map<string, string>();
    for (const e of rule.exemptions) {
        if (!e.name.trim()) { exemptions.set(e.id, 'Name the exemption.'); continue; }
        // Guarded: a one-kind field that is missing makes the exemption error, and an
        // erroring exemption simply does not apply.
        const r = checkExpression(e.expression, variables, target, true);
        if (!r.ok) exemptions.set(e.id, r.error);
    }
    return {
        selector: checkExpression(rule.selector.trim() || 'true', variables, target),
        issues: checkSubRules(rule.subRules, variables, target, referencesField(rule.selector, 'topic', 'virtual')),
        exemptions,
    };
}
