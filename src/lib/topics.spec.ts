import { describe, expect, it } from 'vitest';
import type { Topic } from '@/api/types';
import { aclMatchesTopic, childrenOf, formatBytes, formatCount } from './topics';

const physical = (name: string): Topic => ({
    type: 'physical', name, partitions: 3, replicationFactor: 2, messageCount: 10, sizeBytes: 2048,
});

const logical = (name: string, physicalTopic: string): Topic => ({
    type: 'virtual', name, physicalTopic, partitions: 3, replicationFactor: 2,
    messageCount: null, sizeBytes: null, filter: null,
});

const topics: Topic[] = [
    physical('orders.v1'),
    physical('payments.v2'),
    physical('lonely.v1'),
    logical('orders', 'orders.v1'),
    logical('orders-eu', 'orders.v1'),
    logical('payments-high-value', 'payments.v2'),
];

describe('childrenOf', () => {
    it('returns virtual aliases for a physical topic only', () => {
        expect(childrenOf(topics, 'orders.v1').map((topic) => topic.name)).toEqual(['orders', 'orders-eu']);
        expect(childrenOf(topics, 'payments.v2').map((topic) => topic.name)).toEqual(['payments-high-value']);
        expect(childrenOf(topics, 'missing.v1')).toEqual([]);
    });
});

describe('aclMatchesTopic', () => {
    it('matches exact names and wildcard prefixes only', () => {
        expect(aclMatchesTopic('orders', 'orders')).toBe(true);
        expect(aclMatchesTopic('orders*', 'orders-eu')).toBe(true);
        expect(aclMatchesTopic('orders*', 'payments')).toBe(false);
        expect(aclMatchesTopic('orders', 'orders-eu')).toBe(false);
    });
});

describe('formatting', () => {
    it('renders em dashes for the nulls virtual topics report', () => {
        expect(formatCount(null)).toBe('—');
        expect(formatBytes(null)).toBe('—');
    });

    /// The gateway omits these fields rather than sending null; an undefined slipping
    /// through used to throw inside the render and blank the whole topic table.
    it('renders em dashes when the gateway omits the field entirely', () => {
        expect(formatCount(undefined)).toBe('—');
        expect(formatBytes(undefined)).toBe('—');
    });

    it('scales counts and sizes', () => {
        expect(formatCount(842)).toBe('842');
        expect(formatCount(12_403_118)).toBe('12.4 M');
        expect(formatCount(1_204_881_003)).toBe('1.2 B');
        expect(formatBytes(2048)).toBe('2.0 kB');
        expect(formatBytes(41_017_245_696)).toBe('41 GB');
    });
});
