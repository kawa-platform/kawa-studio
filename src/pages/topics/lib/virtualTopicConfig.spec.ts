import { describe, expect, it } from 'vitest';
import type { Topic } from '@/api/types';
import { buildVirtualTopicConfig, virtualTopicFormFromTopic } from './virtualTopicConfig';

describe('buildVirtualTopicConfig', () => {
    it('builds a header-equals filter from trimmed form values', () => {
        expect(buildVirtualTopicConfig({
            topic: 'orders-v2',
            exposePhysicalTopic: false,
            filterType: 'headerEquals',
            header: ' region ',
            value: ' eu ',
            expression: '',
        })).toEqual({
            topic: 'orders-v2',
            exposePhysicalTopic: false,
            filter: { type: 'headerEquals', header: 'region', value: 'eu' },
        });
    });

    it('builds a CEL filter from a trimmed expression', () => {
        expect(buildVirtualTopicConfig({
            topic: 'orders-v2',
            exposePhysicalTopic: true,
            filterType: 'cel',
            header: '',
            value: '',
            expression: ' value.contains("error") ',
        })).toEqual({
            topic: 'orders-v2',
            exposePhysicalTopic: true,
            filter: { type: 'cel', expression: 'value.contains("error")' },
        });
    });

    it.each([
        ['headerContains', 'contains'],
        ['headerStartsWith', 'startsWith'],
        ['headerMatches', 'matches'],
    ] as const)('builds a %s filter from trimmed header and value', (filterType, sample) => {
        expect(buildVirtualTopicConfig({
            topic: 'orders-v2',
            exposePhysicalTopic: false,
            filterType,
            header: ' region ',
            value: ` ${sample} `,
            expression: '',
        })).toEqual({
            topic: 'orders-v2',
            exposePhysicalTopic: false,
            filter: { type: filterType, header: 'region', value: sample },
        });
    });

    it('omits the filter when filtering is disabled', () => {
        expect(buildVirtualTopicConfig({
            topic: 'orders-v2',
            exposePhysicalTopic: false,
            filterType: 'none',
            header: 'ignored',
            value: 'ignored',
            expression: 'ignored',
        })).toEqual({ topic: 'orders-v2', exposePhysicalTopic: false });
    });
});

describe('virtualTopicFormFromTopic', () => {
    it('maps a header-filtered topic into editable form values', () => {
        const topic: Topic = {
            type: 'virtual',
            name: 'orders-eu',
            physicalTopic: 'orders',
            partitions: 3,
            replicationFactor: 2,
            filter: { kind: 'header', expression: 'region=eu' },
            config: {
                filterType: 'headerEquals',
                filterHeader: 'region',
                filterValue: 'eu',
                exposePhysicalTopic: 'true',
            },
        };

        expect(virtualTopicFormFromTopic(topic)).toEqual({
            name: 'orders-eu',
            topic: 'orders',
            exposePhysicalTopic: true,
            filterType: 'headerEquals',
            header: 'region',
            value: 'eu',
            expression: '',
        });
    });

    it('maps an unfiltered topic to the empty-filter form', () => {
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
            filterType: 'none',
            header: '',
            value: '',
            expression: '',
        });
    });
});
