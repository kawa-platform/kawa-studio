import { describe, expect, it } from 'vitest';
import type { Topic } from '@/api/types';
import { buildVirtualTopicConfig, buildVirtualTopicPatch, clauseFromSummary, virtualTopicFormFromTopic } from './virtualTopicConfig';

describe('buildVirtualTopicConfig', () => {
    it('omits the filter and value format when there is no clause', () => {
        expect(buildVirtualTopicConfig({
            topic: 'orders-v2',
            exposePhysicalTopic: false,
            valueFormat: null,
            filters: { clause: null },
        })).toEqual({
            topic: 'orders-v2',
            exposePhysicalTopic: false,
        });
    });

    it('builds a single header-equals clause from trimmed form values', () => {
        expect(buildVirtualTopicConfig({
            topic: 'orders-v2',
            exposePhysicalTopic: false,
            valueFormat: null,
            filters: { clause: { type: 'headerEquals', header: ' region ', value: ' eu ' } },
        })).toEqual({
            topic: 'orders-v2',
            exposePhysicalTopic: false,
            filter: { type: 'headerEquals', header: 'region', value: 'eu' },
        });
    });

    it('builds a CEL clause from a trimmed expression', () => {
        expect(buildVirtualTopicConfig({
            topic: 'orders-v2',
            exposePhysicalTopic: true,
            valueFormat: null,
            filters: { clause: { type: 'cel', expression: ' value.contains("error") ' } },
        })).toEqual({
            topic: 'orders-v2',
            exposePhysicalTopic: true,
            filter: { type: 'cel', expression: 'value.contains("error")' },
        });
    });

    it('carries the JSON value format as the gateway payload-format object', () => {
        expect(buildVirtualTopicConfig({
            topic: 'orders-v2',
            exposePhysicalTopic: false,
            valueFormat: 'json',
            filters: { clause: { type: 'cel', expression: 'value.amount > 100' } },
        })).toEqual({
            topic: 'orders-v2',
            exposePhysicalTopic: false,
            valueFormat: { type: 'json' },
            filter: { type: 'cel', expression: 'value.amount > 100' },
        });
    });
});

describe('buildVirtualTopicPatch', () => {
    it('clears the filter and value format explicitly when the form is empty', () => {
        expect(buildVirtualTopicPatch({
            topic: 'orders-v2',
            exposePhysicalTopic: false,
            valueFormat: null,
            filters: { clause: null },
        }, 'orders-eu')).toEqual({
            name: 'orders-eu',
            topic: 'orders-v2',
            exposePhysicalTopic: false,
            filter: null,
            valueFormat: null,
        });
    });

    it('carries a clause and the JSON value format through to the patch', () => {
        expect(buildVirtualTopicPatch({
            topic: 'orders-v2',
            exposePhysicalTopic: true,
            valueFormat: 'json',
            filters: { clause: { type: 'cel', expression: 'value.amount > 100' } },
        }, 'orders-eu')).toEqual({
            name: 'orders-eu',
            topic: 'orders-v2',
            exposePhysicalTopic: true,
            filter: { type: 'cel', expression: 'value.amount > 100' },
            valueFormat: { type: 'json' },
        });
    });

    it('clears a previously set value format while keeping a header clause', () => {
        expect(buildVirtualTopicPatch({
            topic: 'orders-v2',
            exposePhysicalTopic: false,
            valueFormat: null,
            filters: { clause: { type: 'headerEquals', header: 'region', value: 'eu' } },
        }, 'orders-eu')).toEqual({
            name: 'orders-eu',
            topic: 'orders-v2',
            exposePhysicalTopic: false,
            filter: { type: 'headerEquals', header: 'region', value: 'eu' },
            valueFormat: null,
        });
    });
});

describe('clauseFromSummary', () => {
    it('parses the header-equals summary template', () => {
        expect(clauseFromSummary({ kind: 'header', expression: 'region=eu' }))
            .toEqual({ type: 'headerEquals', header: 'region', value: 'eu' });
    });

    it('keeps the value intact when it contains an equals sign', () => {
        expect(clauseFromSummary({ kind: 'header', expression: 'token=a=b' }))
            .toEqual({ type: 'headerEquals', header: 'token', value: 'a=b' });
    });

    it('parses the contains, starts-with and matches summary templates', () => {
        expect(clauseFromSummary({ kind: 'headerContains', expression: 'tenant contains acm' }))
            .toEqual({ type: 'headerContains', header: 'tenant', value: 'acm' });
        expect(clauseFromSummary({ kind: 'headerStartsWith', expression: 'tenant starts with ac' }))
            .toEqual({ type: 'headerStartsWith', header: 'tenant', value: 'ac' });
        expect(clauseFromSummary({ kind: 'headerMatches', expression: 'tenant matches eu.*' }))
            .toEqual({ type: 'headerMatches', header: 'tenant', value: 'eu.*' });
    });

    it('passes a CEL summary through as the expression', () => {
        expect(clauseFromSummary({ kind: 'cel', expression: 'headers.tenant == "acme"' }))
            .toEqual({ type: 'cel', expression: 'headers.tenant == "acme"' });
    });

    it('returns null for no filter and for an unparseable header summary', () => {
        expect(clauseFromSummary(null)).toBeNull();
        expect(clauseFromSummary({ kind: 'headerContains', expression: 'no separator here' })).toBeNull();
    });
});

describe('virtualTopicFormFromTopic', () => {
    it('rehydrates a header-equals filter from the topic summary', () => {
        const topic: Topic = {
            type: 'virtual',
            name: 'orders-eu',
            physicalTopic: 'orders',
            partitions: 3,
            replicationFactor: 2,
            filter: { kind: 'header', expression: 'region=eu' },
        };

        expect(virtualTopicFormFromTopic(topic)).toEqual({
            name: 'orders-eu',
            topic: 'orders',
            exposePhysicalTopic: false,
            valueFormat: null,
            filters: { clause: { type: 'headerEquals', header: 'region', value: 'eu' } },
        });
    });

    it('rehydrates a CEL filter and the JSON value format', () => {
        const topic: Topic = {
            type: 'virtual',
            name: 'orders',
            physicalTopic: 'orders.v1',
            partitions: 3,
            replicationFactor: 2,
            filter: { kind: 'cel', expression: 'value.amount > 100' },
            valueFormat: { type: 'json' },
        };

        expect(virtualTopicFormFromTopic(topic)).toEqual({
            name: 'orders',
            topic: 'orders.v1',
            exposePhysicalTopic: false,
            valueFormat: 'json',
            filters: { clause: { type: 'cel', expression: 'value.amount > 100' } },
        });
    });

    it('maps an unfiltered topic to the empty filter form', () => {
        const topic: Topic = {
            type: 'virtual',
            name: 'orders',
            physicalTopic: 'orders.v1',
            partitions: 3,
            replicationFactor: 2,
            filter: null,
        };

        expect(virtualTopicFormFromTopic(topic)).toEqual({
            name: 'orders',
            topic: 'orders.v1',
            exposePhysicalTopic: false,
            valueFormat: null,
            filters: { clause: null },
        });
    });
});