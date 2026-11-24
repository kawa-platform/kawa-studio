import { describe, expect, it } from 'vitest';
import type { PayloadFormatConfig, Topic, TransformationConfig } from '@/api/types';
import { stepsFromConfig } from './transformations';
import {
    buildVirtualTopicConfig,
    buildVirtualTopicPatch,
    clauseFromSummary,
    virtualTopicFormFromTopic,
    type VirtualTopicConfigForm,
} from './virtualTopicConfig';

describe('buildVirtualTopicConfig', () => {
    it('omits the filter and value format when there is no clause', () => {
        expect(buildVirtualTopicConfig({
            topic: 'orders-v2',
            exposePhysicalTopic: false,
            valueFormat: null,
            filters: { clause: null },
            transformations: [],
            outputFormat: null,
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
            transformations: [],
            outputFormat: null,
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
            transformations: [],
            outputFormat: null,
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
            valueFormat: { type: 'json' },
            filters: { clause: { type: 'cel', expression: 'value.amount > 100' } },
            transformations: [],
            outputFormat: null,
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
            transformations: [],
            outputFormat: null,
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
            valueFormat: { type: 'json' },
            filters: { clause: { type: 'cel', expression: 'value.amount > 100' } },
            transformations: [],
            outputFormat: null,
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
            transformations: [],
            outputFormat: null,
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
            transformations: [],
            outputFormat: null,
            outputErrorHeader: true,
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
            valueFormat: { type: 'json' },
            filters: { clause: { type: 'cel', expression: 'value.amount > 100' } },
            transformations: [],
            outputFormat: null,
            outputErrorHeader: true,
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
            transformations: [],
            outputFormat: null,
            outputErrorHeader: true,
        });
    });
});
describe('transformations and value formats', () => {
    const steps: TransformationConfig[] = [
        { type: 'dropFields', fields: ['internal_risk_score', 'customer.email'] },
        { type: 'renameField', from: 'customer.name', to: 'customerName' },
        { type: 'defaultField', field: 'currency', value: 'EUR' },
        { type: 'cel', expression: '{"id": value.order_id}' },
        { type: 'convert', format: { type: 'avro', subject: 'orders-value', version: 3 } },
    ];

    const form = (overrides: Partial<VirtualTopicConfigForm> = {}): VirtualTopicConfigForm => ({
        topic: 'orders-v2',
        exposePhysicalTopic: false,
        valueFormat: { type: 'json' },
        filters: { clause: null },
        transformations: [],
        outputFormat: null,
        ...overrides,
    });

    const topic = (overrides: Partial<Topic> = {}): Topic => ({
        type: 'virtual',
        name: 'orders',
        physicalTopic: 'orders.v1',
        partitions: 3,
        replicationFactor: 2,
        filter: null,
        valueFormat: { type: 'json' },
        transformations: [],
        ...overrides,
    });

    it('sends the steps on create, the output format as the trailing convert, and omits them when there are none', () => {
        const created = buildVirtualTopicConfig(form({
            transformations: stepsFromConfig(steps),
            outputFormat: { type: 'avro', subject: 'orders-value', version: 3 },
        }));

        expect(created.transformations).toEqual(steps);
        expect(buildVirtualTopicConfig(form())).not.toHaveProperty('transformations');
    });

    it('sends an output format alone as a single convert step', () => {
        expect(buildVirtualTopicConfig(form({ outputFormat: { type: 'xml', root: 'order' } })).transformations)
            .toEqual([{ type: 'convert', format: { type: 'xml', root: 'order' } }]);
    });

    it('splits a stored convert off into the output format', () => {
        const loaded = virtualTopicFormFromTopic(topic({ transformations: steps }));

        expect(loaded.outputFormat).toEqual({ type: 'avro', subject: 'orders-value', version: 3 });
        expect(loaded.transformations.map((step) => step.type)).toEqual(['dropFields', 'renameField', 'defaultField', 'cel']);
    });

    it('sends the list when only the output format was removed', () => {
        const loaded = virtualTopicFormFromTopic(topic({ transformations: steps }));

        expect(buildVirtualTopicPatch({ ...loaded, outputFormat: null }, 'orders', steps).transformations)
            .toEqual(steps.slice(0, -1));
    });

    it('leaves transformations out of the PATCH when the steps did not change', () => {
        const loaded = virtualTopicFormFromTopic(topic({ transformations: steps }));

        expect(buildVirtualTopicPatch(loaded, 'orders', steps)).not.toHaveProperty('transformations');
    });

    it('leaves transformations out of the PATCH for a topic that has none', () => {
        const loaded = virtualTopicFormFromTopic(topic());

        expect(buildVirtualTopicPatch(loaded, 'orders', [])).toEqual({
            name: 'orders',
            topic: 'orders.v1',
            exposePhysicalTopic: false,
            filter: null,
            valueFormat: { type: 'json' },
        });
    });

    it('ignores the key order of the stored steps when deciding they are unchanged', () => {
        const stored = [{ format: { version: 3, subject: 'orders-value', type: 'avro' }, type: 'convert' }] as TransformationConfig[];
        const loaded = virtualTopicFormFromTopic(topic({ transformations: stored }));

        expect(buildVirtualTopicPatch(loaded, 'orders', stored)).not.toHaveProperty('transformations');
    });

    it('sends [] to remove every step', () => {
        const loaded = virtualTopicFormFromTopic(topic({ transformations: steps }));

        expect(buildVirtualTopicPatch({ ...loaded, transformations: [], outputFormat: null }, 'orders', steps).transformations)
            .toEqual([]);
    });

    it('sends the whole list when a step changed', () => {
        const loaded = virtualTopicFormFromTopic(topic({ transformations: steps }));
        const edited = loaded.transformations.slice(1);

        expect(buildVirtualTopicPatch({ ...loaded, transformations: edited }, 'orders', steps).transformations)
            .toEqual(steps.slice(1));
    });

    it('round-trips Avro and XML value formats instead of dropping them', () => {
        const avro: PayloadFormatConfig = { type: 'avro', onDecodeError: 'fail', subject: 'orders-value', version: 3 };
        const xml: PayloadFormatConfig = { type: 'xml', onDecodeError: 'include', root: 'order' };

        expect(buildVirtualTopicPatch(virtualTopicFormFromTopic(topic({ valueFormat: avro })), 'orders').valueFormat).toEqual(avro);
        expect(buildVirtualTopicPatch(virtualTopicFormFromTopic(topic({ valueFormat: xml })), 'orders').valueFormat).toEqual(xml);
    });

    it('trims the format fields and omits blank ones', () => {
        expect(buildVirtualTopicConfig(form({ valueFormat: { type: 'xml', root: ' order ' } })).valueFormat)
            .toEqual({ type: 'xml', root: 'order' });
        expect(buildVirtualTopicConfig(form({ valueFormat: { type: 'avro', subject: '' } })).valueFormat)
            .toEqual({ type: 'avro' });
    });
});

describe('error headers', () => {
    const listed: Topic = {
        type: 'virtual',
        name: 'orders',
        partitions: 1,
        replicationFactor: 1,
        physicalTopic: 'orders.v1',
        filter: { kind: 'cel', expression: 'value.paid', errorHeader: false },
        valueFormat: { type: 'json', onDecodeError: 'include' },
        transformations: [
            { type: 'renameField', from: 'a', to: 'b', errorHeader: false },
            { type: 'dropFields', fields: ['c'] },
            { type: 'convert', format: { type: 'xml', root: 'order' }, errorHeader: false },
        ],
    };

    it('keeps error headers turned off through an edit that does not touch them', () => {
        const form = virtualTopicFormFromTopic(listed);

        const patch = buildVirtualTopicPatch(form, 'orders', listed.transformations ?? []);

        expect(patch.filter).toEqual({ type: 'cel', expression: 'value.paid', errorHeader: false });
        expect(patch).not.toHaveProperty('transformations');
    });

    it('sends the steps when only an error header changed', () => {
        const form = virtualTopicFormFromTopic(listed);
        form.transformations[1] = { ...form.transformations[1]!, errorHeader: false };
        form.outputErrorHeader = true;

        const patch = buildVirtualTopicPatch(form, 'orders', listed.transformations ?? []);

        expect(patch.transformations).toEqual([
            { type: 'renameField', from: 'a', to: 'b', errorHeader: false },
            { type: 'dropFields', fields: ['c'], errorHeader: false },
            { type: 'convert', format: { type: 'xml', root: 'order' } },
        ]);
    });

    it('leaves the default out of the request', () => {
        const config = buildVirtualTopicConfig({
            topic: 'orders.v1',
            exposePhysicalTopic: false,
            valueFormat: { type: 'json', onDecodeError: 'include' },
            filters: { clause: { type: 'cel', expression: 'value.paid', errorHeader: true } },
            transformations: stepsFromConfig([{ type: 'cel', expression: 'value' }]),
            outputFormat: { type: 'json' },
        });

        expect(JSON.stringify(config)).not.toContain('errorHeader');
    });

    it('carries a header filter\'s error header from the listing', () => {
        expect(clauseFromSummary({ kind: 'header', expression: 'region=eu', errorHeader: false }))
            .toEqual({ type: 'headerEquals', header: 'region', value: 'eu', errorHeader: false });
    });
});
