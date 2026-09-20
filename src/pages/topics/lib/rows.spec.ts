import { describe, expect, it } from 'vitest';
import type { Topic } from '@/api/types';
import { buildRows, groupTopics } from './rows';

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

describe('groupTopics', () => {
    it('nests virtual aliases under their physical parent', () => {
        const rows = groupTopics(topics, '', new Set());
        expect(rows.map((row) => [row.topic.name, row.depth])).toEqual([
            ['orders.v1', 0], ['orders', 1], ['orders-eu', 1],
            ['payments.v2', 0], ['payments-high-value', 1],
            ['lonely.v1', 0],
        ]);
    });

    it('reports child counts on the parent and marks the last child', () => {
        const rows = groupTopics(topics, '', new Set());
        expect(rows[0]!.childCount).toBe(2);
        expect(rows[1]!.last).toBe(false);
        expect(rows[2]!.last).toBe(true);
        expect(rows.find((row) => row.topic.name === 'lonely.v1')!.childCount).toBe(0);
    });

    it('keeps a parent whose alias matches the query, and hides the non-matching siblings', () => {
        const rows = groupTopics(topics, 'orders-eu', new Set());
        expect(rows.map((row) => row.topic.name)).toEqual(['orders.v1', 'orders-eu']);
    });

    it('keeps every alias when the parent itself matches', () => {
        const rows = groupTopics(topics, 'orders.v1', new Set());
        expect(rows.map((row) => row.topic.name)).toEqual(['orders.v1', 'orders', 'orders-eu']);
    });

    it('drops a parent with no match anywhere in its subtree', () => {
        const rows = groupTopics(topics, 'telemetry', new Set());
        expect(rows).toEqual([]);
    });

    it('emits no children for a collapsed parent', () => {
        const rows = groupTopics(topics, '', new Set(['orders.v1']));
        expect(rows.map((row) => row.topic.name)).toEqual([
            'orders.v1', 'payments.v2', 'payments-high-value', 'lonely.v1',
        ]);
    });
});

describe('groupTopics with an orphaned alias', () => {
    /// The gateway can list a virtual topic whose physical topic it does not return.
    const orphaned: Topic[] = [...topics, logical('orders.us', 'orders-v2')];

    it('lists an alias with no matching physical parent flat, rather than dropping it', () => {
        const rows = groupTopics(orphaned, '', new Set());
        const orphan = rows.find((row) => row.topic.name === 'orders.us');
        expect(orphan).toBeDefined();
        expect(orphan!.depth).toBe(0);
    });

    it('keeps every topic accounted for in the all view', () => {
        expect(groupTopics(orphaned, '', new Set())).toHaveLength(orphaned.length);
    });

    it('still filters orphans by the query', () => {
        expect(groupTopics(orphaned, 'orders.us', new Set()).map((r) => r.topic.name)).toEqual(['orders.us']);
    });
});

describe('buildRows', () => {
    it('shows only virtual topics, flat, in the virtual view', () => {
        const rows = buildRows(topics, 'virtual', '', new Set());
        expect(rows.map((row) => row.topic.name)).toEqual(['orders', 'orders-eu', 'payments-high-value']);
        expect(rows.every((row) => row.depth === 0)).toBe(true);
    });

    it('shows only physical topics in the physical view, with their fan-out count', () => {
        const rows = buildRows(topics, 'physical', '', new Set());
        expect(rows.map((row) => [row.topic.name, row.childCount])).toEqual([
            ['orders.v1', 2], ['payments.v2', 1], ['lonely.v1', 0],
        ]);
    });

    it('filters case-insensitively by name fragment', () => {
        expect(buildRows(topics, 'virtual', 'EU', new Set()).map((row) => row.topic.name)).toEqual(['orders-eu']);
    });
});
