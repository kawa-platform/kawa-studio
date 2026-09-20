import { describe, expect, it } from 'vitest';
import type { SchemaDetail } from '@/api/types';
import { assignPath, buildValue, groupFields, parseHeaders, prefill, recordNameOf, validate } from './schema';

const nested: SchemaDetail = {
    subject: 'payments.v2-PaymentAuthorized',
    recordName: 'PaymentAuthorized',
    version: 4,
    fields: [
        { name: 'amount', type: 'double', required: true },
        { name: 'method', type: 'enum', required: true, symbols: ['card', 'ideal'] },
        { name: 'instrument.brand', type: 'enum', required: true, symbols: ['visa', 'amex'] },
        { name: 'instrument.last4', type: 'string', required: true },
        { name: 'instrument.issuer.bic', type: 'string', required: false },
        { name: 'partial', type: 'boolean', required: false },
        { name: 'source', type: 'string', required: false, default: 'web' },
    ],
};

describe('recordNameOf', () => {
    it('strips the physical topic prefix — the TopicRecordName strategy', () => {
        expect(recordNameOf('orders.v1-OrderCreated', 'orders.v1')).toBe('OrderCreated');
    });

    it('leaves a subject that does not carry the prefix alone', () => {
        expect(recordNameOf('other-OrderCreated', 'orders.v1')).toBe('other-OrderCreated');
    });

    it('does not confuse a topic that is a prefix of another', () => {
        expect(recordNameOf('orders.v10-Created', 'orders.v1')).toBe('orders.v10-Created');
    });
});

describe('prefill', () => {
    it('honours schema defaults and seeds enums and booleans', () => {
        const values = prefill(nested);
        expect(values.source).toBe('web');
        expect(values.method).toBe('card');
        expect(values['instrument.brand']).toBe('visa');
        expect(values.partial).toBe('false');
        expect(values.amount).toBe('');
    });

    it('returns nothing for a schemaless topic', () => {
        expect(prefill(null)).toEqual({});
    });
});

describe('assignPath', () => {
    it('creates intermediate objects along a dotted path', () => {
        const target: Record<string, unknown> = {};
        assignPath(target, 'a.b.c', 1);
        expect(target).toEqual({ a: { b: { c: 1 } } });
    });

    it('merges siblings rather than replacing the parent', () => {
        const target: Record<string, unknown> = {};
        assignPath(target, 'a.b', 1);
        assignPath(target, 'a.c', 2);
        expect(target).toEqual({ a: { b: 1, c: 2 } });
    });
});

describe('buildValue', () => {
    it('nests dotted fields and coerces by declared type', () => {
        const value = buildValue(nested, {
            amount: '42.5',
            method: 'ideal',
            'instrument.brand': 'visa',
            'instrument.last4': '4242',
            'instrument.issuer.bic': 'ABNANL2A',
            partial: 'true',
            source: 'web',
        });
        expect(value).toEqual({
            amount: 42.5,
            method: 'ideal',
            instrument: { brand: 'visa', last4: '4242', issuer: { bic: 'ABNANL2A' } },
            partial: true,
            source: 'web',
        });
    });

    it('sends an explicit null for an empty required field and omits empty optionals', () => {
        const value = buildValue(nested, { amount: '', 'instrument.last4': '' }) as Record<string, unknown>;
        expect(value.amount).toBeNull();
        expect(value.instrument).toEqual({ brand: null, last4: null });
        expect(value).not.toHaveProperty('source');
    });
});

describe('validate', () => {
    it('reports missing required fields by full dotted path', () => {
        const errors = validate(nested, { amount: '1', 'instrument.brand': 'visa' });
        expect(Object.keys(errors)).toEqual(['method', 'instrument.last4']);
    });

    it('rejects non-numeric input for numeric fields', () => {
        const errors = validate(nested, { amount: 'twelve', method: 'card', 'instrument.brand': 'visa', 'instrument.last4': '1' });
        expect(errors.amount).toBe('Must be a number.');
    });

    it('passes a fully populated record', () => {
        expect(validate(nested, {
            amount: '1', method: 'card', 'instrument.brand': 'visa', 'instrument.last4': '4242',
        })).toEqual({});
    });
});

describe('groupFields', () => {
    it('groups fields under their parent record in schema order', () => {
        const groups = groupFields(nested);
        expect(groups.map((g) => [g.path, g.depth, g.fields.length])).toEqual([
            ['', 0, 4],
            ['instrument', 1, 2],
            ['instrument.issuer', 2, 1],
        ]);
    });

    it('labels each field by its leaf name', () => {
        const issuer = groupFields(nested).find((g) => g.path === 'instrument.issuer')!;
        expect(issuer.fields[0]!.leaf).toBe('bic');
    });
});

describe('parseHeaders', () => {
    it('parses name: value lines and ignores blanks', () => {
        expect(parseHeaders('region: eu\n\nplatform:ios\nnonsense')).toEqual({ region: 'eu', platform: 'ios' });
    });
});
