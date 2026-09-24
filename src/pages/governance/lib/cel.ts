import { Environment } from '@marcbachmann/cel-js';
import { executablePattern, hasNamedGroups } from './patterns';
import type {
    GovernanceDocument, GovernanceRule, GovernanceVariable, TopicInput, VariableType,
} from './types';

/// Thin adapter over @marcbachmann/cel-js so the rest of the feature never touches the
/// library directly. The backend binds variables the same way: declared in the environment,
/// passed at evaluation time, never pasted into the expression text.

export type CheckResult = { ok: true; type: string } | { ok: false; error: string };

export type RuleOutcome = 'pass' | 'fail' | 'skipped' | 'error';

export interface RuleTrace {
    rule: GovernanceRule;
    outcome: RuleOutcome;
    detail?: string;
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

function environment(variables: GovernanceVariable[]): Environment {
    const env = new Environment().registerVariable('topic', 'map');
    const seen = new Set<string>(['topic']);
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

function context(variables: GovernanceVariable[], topic: TopicInput): Record<string, unknown> {
    const ctx: Record<string, unknown> = {
        topic: {
            name: topic.name,
            partitions: BigInt(topic.partitions),
            replicationFactor: BigInt(topic.replicationFactor),
            config: topic.config,
        },
    };
    for (const v of variables) {
        const value = parseLiteral(v.value, v.type);
        ctx[v.name] = typeof value === 'string' && hasNamedGroups(value) ? executablePattern(value) : value;
    }
    return ctx;
}

/// Type-checks an expression against the topic context and the declared variables.
export function checkExpression(expression: string, variables: GovernanceVariable[]): CheckResult {
    if (!expression.trim()) return { ok: false, error: 'Expression is empty.' };
    try {
        const result = environment(variables).check(expression);
        if (!result.valid) return { ok: false, error: message(result.error) };
        const type = String(result.type);
        if (type !== 'bool' && type !== 'dyn') return { ok: false, error: `Must return bool; returns ${type}.` };
        return { ok: true, type };
    } catch (cause) {
        return { ok: false, error: message(cause) };
    }
}

export function referencesVariable(expression: string, name: string): boolean {
    const code = expression.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^.\\w])${escaped}(?!\\w)`).test(code);
}

export function globMatch(pattern: string, value: string): boolean {
    const source = pattern.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
    return new RegExp(`^${source}$`).test(value);
}

function evalBool(env: Environment, expression: string, ctx: Record<string, unknown>): boolean {
    const result = env.evaluate(expression, ctx);
    if (typeof result !== 'boolean') throw new Error(`Returned ${typeof result}, not bool.`);
    return result;
}

/// Dry run of what the gateway does on physical topic creation: an exemption skips every
/// rule; otherwise each rule whose selector holds is evaluated, and the first failure or
/// evaluation error refuses the request.
export function runGovernance(document: GovernanceDocument, topic: TopicInput, principal: string): GovernanceResult {
    const exemption = document.exemptions.find((e) =>
        globMatch(e.principalPattern, principal) && globMatch(e.topicPattern, topic.name));
    if (exemption) return { status: 201, exemptedBy: exemption.name, trace: [] };

    let env: Environment;
    let ctx: Record<string, unknown>;
    try {
        env = environment(document.variables);
        ctx = context(document.variables, topic);
    } catch (cause) {
        return { status: 403, error: message(cause), trace: [] };
    }

    const trace = document.rules.map((rule): RuleTrace => {
        try {
            if (!evalBool(env, rule.selector.trim() || 'true', ctx)) return { rule, outcome: 'skipped' };
            return { rule, outcome: evalBool(env, rule.expression, ctx) ? 'pass' : 'fail' };
        } catch (cause) {
            return { rule, outcome: 'error', detail: message(cause) };
        }
    });
    const failed = trace.find((t) => t.outcome === 'fail' || t.outcome === 'error');
    return { status: failed ? 403 : 201, failed, trace };
}
