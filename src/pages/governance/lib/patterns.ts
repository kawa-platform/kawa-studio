import type { GovernanceVariable } from './types';

/// A naming convention is authored once, as a regex with named groups. The display table
/// (forms and worked examples) is parsed out of that same string, so the table can never
/// drift from what the gateway enforces.
///
/// Supported subset: literals, escapes, character classes, named / non-capturing groups,
/// ?, +, *, and alternation. Lookaround, backreferences and {n,m} throw, and the caller
/// shows no table for that variable.

type PatternNode =
    | { t: 'lit'; v: string }
    | { t: 'var'; name: string }
    | { t: 'seq'; nodes: PatternNode[] }
    | { t: 'opt'; child: PatternNode }
    | { t: 'alt'; branches: PatternNode[][] };

export interface PatternRow {
    form: string;
    examples: string[];
    note?: string;
}

export interface RulePatterns {
    variable: string;
    rows: PatternRow[];
}

const NAMED_GROUP = /\(\?<(?![=!])[A-Za-z0-9_]+>/;
const CLASS_ESCAPES = 'dDwWsS';

export function hasNamedGroups(src: string): boolean {
    return NAMED_GROUP.test(src);
}

/// JS and RE2 both reject a group name used twice, so the pattern bound into evaluation
/// downgrades every named group to a non-capturing one.
export function executablePattern(src: string): string {
    return src.replace(new RegExp(NAMED_GROUP.source, 'g'), '(?:');
}

export function parsePattern(src: string): PatternNode[] {
    let i = src.startsWith('^') ? 1 : 0;
    const end = src.endsWith('$') && !src.endsWith('\\$') ? src.length - 1 : src.length;

    const unsupported = (what: string): never => {
        throw new Error(`Unsupported regex construct at position ${i}: ${what}.`);
    };

    const quantify = (node: PatternNode): PatternNode => {
        const q = src.charAt(i);
        if (q === '?') { i++; return { t: 'opt', child: node }; }
        if (q === '+' || q === '*') { i++; return node; }
        if (q === '{') unsupported('{n,m}');
        return node;
    };

    const seq = (): PatternNode[] => {
        let current: PatternNode[] = [];
        const alts: PatternNode[][] = [current];
        const push = (n: PatternNode): void => { current.push(n); };
        while (i < end) {
            const c = src.charAt(i);
            if (c === ')') break;
            if (c === '|') { i++; current = []; alts.push(current); continue; }
            if (c === '{') unsupported('{n,m}');
            if (c === '\\') {
                const e = src.charAt(i + 1);
                if (e === '') unsupported('trailing backslash');
                if (/[1-9k]/.test(e)) unsupported('backreference');
                i += 2;
                push(quantify(CLASS_ESCAPES.includes(e) ? { t: 'var', name: 'value' } : { t: 'lit', v: e }));
                continue;
            }
            if (c === '[') {
                const close = src.indexOf(']', i + 1);
                if (close < 0) unsupported('unclosed character class');
                i = close + 1;
                push(quantify({ t: 'var', name: 'value' }));
                continue;
            }
            if (c === '(') {
                let name: string | null = null;
                if (src.startsWith('(?<', i) && src[i + 3] !== '=' && src[i + 3] !== '!') {
                    const j = src.indexOf('>', i);
                    name = src.slice(i + 3, j);
                    i = j + 1;
                } else if (src.startsWith('(?:', i)) {
                    i += 3;
                } else if (src[i + 1] === '?') {
                    unsupported('lookaround or inline flag');
                } else {
                    i += 1;
                }
                const inner = seq();
                if (src.charAt(i) !== ')') unsupported('unclosed group');
                i++;
                const only = inner.length === 1 ? inner[0] : undefined;
                const node: PatternNode = name
                    ? { t: 'var', name }
                    : only?.t === 'alt' ? only : { t: 'seq', nodes: inner };
                push(quantify(node));
                continue;
            }
            if (c === '.') { i++; push(quantify({ t: 'var', name: 'value' })); continue; }
            i++;
            push(quantify({ t: 'lit', v: c }));
        }
        return alts.length === 1 ? current : [{ t: 'alt', branches: alts }];
    };

    const nodes = seq();
    if (i < end) unsupported('unbalanced )');
    return nodes;
}

function branchesOf(nodes: PatternNode[]): PatternNode[][] {
    let top = nodes;
    for (;;) {
        const only = top.length === 1 ? top[0] : undefined;
        if (only?.t === 'seq') {
            top = only.nodes;
            continue;
        }
        return only?.t === 'alt' ? only.branches : [top];
    }
}

const kids = (n: PatternNode): PatternNode[] => (n.t === 'seq' ? n.nodes : [n]);

/// Named groups print as <name>; inside brackets the brackets already say "optional",
/// so the name goes bare.
function formOf(nodes: PatternNode[], bare: boolean): string {
    return nodes.map((n): string => {
        switch (n.t) {
            case 'lit': return n.v;
            case 'var': return bare ? n.name : `<${n.name}>`;
            case 'seq': return formOf(n.nodes, bare);
            case 'opt': return `[${formOf(kids(n.child), true)}]`;
            case 'alt': return n.branches.map((b) => formOf(b, bare)).join('|');
        }
    }).join('');
}

function renderOf(nodes: PatternNode[], include: PatternNode[], prefix: string, samples: Record<string, string>): string {
    return nodes.map((n): string => {
        switch (n.t) {
            case 'lit': return n.v;
            case 'var': return samples[`${prefix}.${n.name}`] ?? samples[n.name] ?? n.name;
            case 'seq': return renderOf(n.nodes, include, prefix, samples);
            case 'opt': return include.includes(n) ? renderOf(kids(n.child), include, prefix, samples) : '';
            case 'alt': return renderOf(n.branches[0] ?? [], include, prefix, samples);
        }
    }).join('');
}

function optionalsOf(nodes: PatternNode[]): PatternNode[] {
    return nodes.flatMap((n) => (n.t === 'opt' ? [n] : n.t === 'seq' ? optionalsOf(n.nodes) : []));
}

function prefixOf(nodes: PatternNode[]): string {
    let s = '';
    for (const n of nodes) {
        if (n.t !== 'lit') break;
        s += n.v;
    }
    return s.split('.')[0] ?? '';
}

/// One row per alternation branch: an example with no optional segments, then one per
/// optional segment.
export function patternRows(
    src: string,
    hints: Pick<GovernanceVariable, 'samples' | 'notes' | 'extraExamples'> = {},
): PatternRow[] {
    const samples = hints.samples ?? {};
    return branchesOf(parsePattern(src)).map((branch) => {
        const form = formOf(branch, false);
        const prefix = prefixOf(branch);
        const examples = [
            renderOf(branch, [], prefix, samples),
            ...optionalsOf(branch).map((o) => renderOf(branch, [o], prefix, samples)),
            ...(hints.extraExamples?.[form] ?? []),
        ];
        return { form, examples: [...new Set(examples)], note: hints.notes?.[form] };
    });
}

const MATCHES_VARIABLE = /(?:\.matches\(\s*|\bmatches\(\s*[^,()]+,\s*)([A-Za-z_]\w*)\s*\)/g;
const MATCHES_LITERAL = /\.matches\(\s*"((?:[^"\\]|\\.)*)"\s*\)/g;

/// A rule gets a pattern table when an expression calls matches() with a variable whose
/// value is an annotated regex, or with an inline string literal that has named groups.
/// Inline rows from every expression merge into one table captioned with `label`.
/// Nothing is attached to the rule by hand.
export function patternsFor(expressions: string[], variables: GovernanceVariable[], label = 'sub-rules'): RulePatterns[] {
    const names = new Set<string>();
    const inline: PatternRow[] = [];
    for (const expression of expressions) {
        for (const m of expression.matchAll(MATCHES_VARIABLE)) names.add(m[1]!);
        for (const m of expression.matchAll(MATCHES_LITERAL)) {
            try {
                const src = JSON.parse(`"${m[1]}"`) as string;
                if (hasNamedGroups(src)) inline.push(...patternRows(src));
            } catch {
                // not a parseable pattern; no table
            }
        }
    }

    const out: RulePatterns[] = [];
    for (const name of names) {
        const variable = variables.find((v) => v.name === name && v.type === 'string');
        if (!variable) continue;
        const rows = variablePatternRows(variable);
        if (rows) out.push({ variable: name, rows });
    }
    if (inline.length) out.push({ variable: label, rows: inline });
    return out;
}

/// Null when the value is not an annotated regex, or uses a construct the parser does not
/// support.
export function variablePatternRows(variable: GovernanceVariable): PatternRow[] | null {
    try {
        const src: unknown = JSON.parse(variable.value);
        if (typeof src !== 'string' || !hasNamedGroups(src)) return null;
        return patternRows(src, variable);
    } catch {
        return null;
    }
}
