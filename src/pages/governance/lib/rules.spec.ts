import { describe, expect, it } from 'vitest';
import { checkExpression, checkGlobalExemption, checkRule, globToCel } from './cel';
import { sampleDocument } from './mock';
import { compileRule } from './rules';
import type { GovernanceRule } from './types';

const doc = sampleDocument();

describe('rule tree', () => {
    const rule: GovernanceRule = {
        id: 'x', name: 'x', description: '', errorMessage: 'rule', resourceType: 'topic', scope: 'both', operations: ['create'],
        selector: 'true', combinator: 'all', exemptions: [],
        subRules: [
            { id: 'a', kind: 'check', name: 'a', expression: 'true' },
            { id: 'g', kind: 'group', name: 'g', combinator: 'any', checks: [
                { id: 'b', kind: 'check', name: 'b', expression: 'topic.partitions < 4' },
                { id: 'c', kind: 'check', name: 'c', expression: 'topic.name == "x"' },
            ] },
        ],
    };

    it('compiles to the equivalent CEL expression', () => {
        expect(compileRule(rule)).toBe('(true) && ((topic.partitions < 4) || (topic.name == "x"))');
    });

    it('type-checks every sample rule', () => {
        for (const r of doc.rules) {
            const c = checkRule(r, doc.variables);
            expect(c.selector.ok && c.issues.size === 0 && c.exemptions.size === 0, r.name).toBe(true);
        }
    });
});

describe('topic scope', () => {
    const physical = { type: 'topic', scope: 'physical' } as const;
    const both = { type: 'topic', scope: 'both' } as const;
    const virtualOnly = { type: 'topic', scope: 'virtual' } as const;

    it('allows one-kind fields only in scope or behind a topic.virtual guard', () => {
        expect(checkExpression('topic.partitions >= 3', [], physical).ok).toBe(true);
        expect(checkExpression('topic.partitions >= 3', [], both).ok).toBe(false);
        expect(checkExpression('!topic.virtual && topic.partitions >= 3', [], both).ok).toBe(true);
        expect(checkExpression('topic.partitions >= 3', [], both, true).ok).toBe(true);
        const r = checkExpression('topic.partitions >= 3', [], virtualOnly);
        expect(!r.ok && r.error).toContain('only exists on physical topics');
        expect(checkExpression('topic.name.startsWith("a")', [], both).ok).toBe(true);
    });

});

describe('resource types', () => {
    it('only binds the context variable of the rule\'s resource kind', () => {
        expect(checkExpression('group.id.startsWith("app.")', [], { type: 'consumer-group', scope: 'both' }).ok).toBe(true);
        const r = checkExpression('topic.name.startsWith("app.")', [], { type: 'consumer-group', scope: 'both' });
        expect(r.ok).toBe(false);
        expect(!r.ok && r.error).toContain('use group');
    });

});

describe('global exemptions', () => {
    it('type-check against every resource variable', () => {
        expect(checkGlobalExemption('group.id.startsWith("x") || topic.name == "y"', []).ok).toBe(true);
        expect(checkGlobalExemption('principal', []).ok).toBe(false);
    });

    it('build CEL from glob patterns', () => {
        expect(globToCel('principal', 'User:app-cargo')).toBe('principal == "User:app-cargo"');
        expect(globToCel('topic.name', 'legacy-*')).toBe('topic.name.startsWith("legacy-")');
        expect(globToCel('topic.name', '*.dlt')).toBe('topic.name.matches("^.*\\\\.dlt$")');
    });
});
