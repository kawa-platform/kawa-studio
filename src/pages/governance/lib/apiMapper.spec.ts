import { describe, expect, it } from 'vitest';
import type { GovernanceRuleView } from '@/api/types';
import { fromRule, toRule } from './apiMapper';
import { sampleDocument } from './mock';

const strip = (v: unknown): unknown => JSON.parse(JSON.stringify(v, (k, x) => (k === 'id' ? undefined : x)));

describe('governance api mapper', () => {
    it('round-trips every sample rule through the wire format', () => {
        for (const rule of sampleDocument().rules) {
            const back = toRule(fromRule(rule));
            expect(strip(back)).toEqual(strip({ ...rule, id: rule.name }));
        }
    });

    it('maps the wire shape to the UI model', () => {
        const view: GovernanceRuleView = {
            name: 'naming', errorMessage: 'msg', description: null,
            selector: { resourceType: 'GROUP', expression: null, scope: 'BOTH', operations: ['CREATE'] },
            match: 'ANY',
            subRules: [
                { kind: 'check', name: 'connect', errorMessage: null, expression: { type: 'CEL', value: 'group.id.startsWith("connect-")' } },
                {
                    kind: 'group', name: 'app', errorMessage: 'App groups', match: 'ALL',
                    checks: [{ kind: 'check', name: 'prefix', errorMessage: null, expression: { type: 'CEL', value: 'group.id.startsWith("app.")' } }],
                },
            ],
            exemptions: [],
        };
        const rule = toRule(view);
        expect(rule.resourceType).toBe('consumer-group');
        expect(rule.selector).toBe('true');
        expect(rule.combinator).toBe('any');
        expect(rule.subRules[1]).toMatchObject({ kind: 'group', combinator: 'all', checks: [{ name: 'prefix' }] });
        expect(fromRule(rule)).toEqual(view);
    });
});

describe('governance variable mapping', () => {
    it('round-trips every sample variable', async () => {
        const { toVariable, fromVariable } = await import('./apiMapper');
        for (const v of sampleDocument().variables) {
            expect(toVariable(fromVariable(v))).toEqual({ ...v, id: v.name });
        }
    });
});
