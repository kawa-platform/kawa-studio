import { describe, expect, it } from 'vitest';
import { executablePattern, patternRows, patternsForRule, variablePatternRows } from './patterns';
import type { GovernanceVariable } from './types';

const variable = (value: string, extra: Partial<GovernanceVariable> = {}): GovernanceVariable => ({
    id: 'v', name: 'namingPattern', type: 'string', note: '', value: JSON.stringify(value), ...extra,
});

describe('patternRows', () => {
    it('derives one row per branch with forms and examples', () => {
        const rows = patternRows(
            '^(?:model\\.(?<domain>[a-z]+)(?:\\.(?<subject>[a-z]+))?|ingest\\.(?<source>[a-z]+)\\.(?<subject>[a-z]+))$',
            { samples: { domain: 'customer', subject: 'address', source: 'cdb', 'ingest.subject': 'flight' } },
        );
        expect(rows).toEqual([
            { form: 'model.<domain>[.subject]', examples: ['model.customer', 'model.customer.address'], note: undefined },
            { form: 'ingest.<source>.<subject>', examples: ['ingest.cdb.flight'], note: undefined },
        ]);
    });

    it('falls back to the group name when no sample is given', () => {
        expect(patternRows('^app\\.(?<service>[a-z]+)$')[0].examples).toEqual(['app.service']);
    });

    it('rejects constructs outside the supported subset', () => {
        expect(() => patternRows('^(?=x)a$')).toThrow();
        expect(() => patternRows('^a{2,3}$')).toThrow();
        expect(() => patternRows('^(a)\\1$')).toThrow();
    });
});

describe('executablePattern', () => {
    it('downgrades named groups so repeated names compile', () => {
        const src = executablePattern('^(?:a\\.(?<x>[a-z]+)|b\\.(?<x>[a-z]+))$');
        expect(new RegExp(src).test('b.foo')).toBe(true);
    });
});

describe('patternsForRule', () => {
    it('shows a table only for matches() on an annotated regex variable', () => {
        const vars = [variable('^app\\.(?<service>[a-z]+)$'), { ...variable('^x$'), name: 'plain' }];
        expect(patternsForRule('topic.name.matches(namingPattern)', vars)).toHaveLength(1);
        expect(patternsForRule('topic.name.matches(plain)', vars)).toHaveLength(0);
        expect(patternsForRule('topic.partitions in tiers', vars)).toHaveLength(0);
    });

    it('returns null rows for an unparseable pattern instead of throwing', () => {
        expect(variablePatternRows(variable('^(?<a>x){2}$'))).toBeNull();
    });
});
