import type { Topic } from '@/api/types';

export const childrenOf = (topics: Topic[], physicalName: string): Topic[] =>
    topics.filter((t) => t.type === 'virtual' && t.physicalTopic === physicalName);

/// ACLs that govern a topic, wildcard suffixes included.
export const aclMatchesTopic = (resourceName: string, topicName: string): boolean =>
    resourceName === topicName
    || (resourceName.endsWith('*') && topicName.startsWith(resourceName.slice(0, -1)));

const UNITS = ['B', 'kB', 'MB', 'GB', 'TB', 'PB'];

export function formatBytes(bytes: number | null | undefined): string {
    if (bytes == null) return '—';
    let value = bytes;
    let unit = 0;
    while (value >= 1000 && unit < UNITS.length - 1) {
        value /= 1000;
        unit++;
    }
    return (value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value).toString()) + ' ' + UNITS[unit];
}

export function formatCount(count: number | null | undefined): string {
    if (count == null) return '—';
    if (count < 1000) return count.toString();
    const units: [number, string][] = [[1e9, ' B'], [1e6, ' M'], [1e3, ' k']];
    for (const [scale, suffix] of units) {
        if (count >= scale) {
            const scaled = count / scale;
            const precise = scaled < 100;
            return (precise ? scaled.toFixed(1).replace(/\.0$/, '') : Math.round(scaled).toString()) + suffix;
        }
    }
    return count.toString();
}
