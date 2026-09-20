import type { Topic } from '@/api/types';
import { childrenOf } from '@/lib/topics';

export type TopicView = 'virtual' | 'physical' | 'all';

export const isTopicView = (value: unknown): value is TopicView =>
    value === 'virtual' || value === 'physical' || value === 'all';

export interface TreeRow {
    topic: Topic;
    depth: number;
    childCount: number;
    last: boolean;
}

const matches = (name: string, query: string): boolean =>
    !query || name.toLowerCase().includes(query.trim().toLowerCase());

export function filterTopics(topics: Topic[], view: TopicView, query: string): Topic[] {
    return topics.filter((topic) => (view === 'all' || topic.type === view) && matches(topic.name, query));
}

/// A virtual topic whose physicalTopic is absent from the list has no parent to nest
/// under. It is still a real topic, so the all view lists it flat rather than dropping it
/// — silently hiding a row made the count in the header disagree with the table.
const isOrphan = (topic: Topic, physicalNames: Set<string>): boolean =>
    topic.type === 'virtual' && (!topic.physicalTopic || !physicalNames.has(topic.physicalTopic));

export function groupTopics(topics: Topic[], query: string, collapsed: Set<string>): TreeRow[] {
    const rows: TreeRow[] = [];
    const physicalNames = new Set(topics.filter((t) => t.type === 'physical').map((t) => t.name));
    for (const parent of topics.filter((topic) => topic.type === 'physical')) {
        const kids = childrenOf(topics, parent.name);
        const parentHit = matches(parent.name, query);
        const shown = parentHit ? kids : kids.filter((kid) => matches(kid.name, query));
        if (!parentHit && shown.length === 0) continue;

        rows.push({ topic: parent, depth: 0, childCount: kids.length, last: false });
        if (collapsed.has(parent.name)) continue;
        shown.forEach((kid, index) => {
            rows.push({ topic: kid, depth: 1, childCount: 0, last: index === shown.length - 1 });
        });
    }
    for (const orphan of topics.filter((t) => isOrphan(t, physicalNames) && matches(t.name, query))) {
        rows.push({ topic: orphan, depth: 0, childCount: 0, last: false });
    }
    return rows;
}

export function buildRows(topics: Topic[], view: TopicView, query: string, collapsed: Set<string>): TreeRow[] {
    if (view === 'all') return groupTopics(topics, query, collapsed);
    return filterTopics(topics, view, query).map((topic) => ({
        topic,
        depth: 0,
        childCount: topic.type === 'physical' ? childrenOf(topics, topic.name).length : 0,
        last: false,
    }));
}
