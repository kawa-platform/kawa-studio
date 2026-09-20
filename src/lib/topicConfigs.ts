/// The Kafka topic-level configs an operator might set, used as autocomplete
/// suggestions on the physical topic form. `values` is present only for configs with a
/// small, well-known domain; everything else accepts free text.
export interface TopicConfigSuggestion {
    key: string;
    values?: string[];
}

export const TOPIC_CONFIGS: TopicConfigSuggestion[] = [
    { key: 'cleanup.policy', values: ['delete', 'compact'] },
    { key: 'compression.type', values: ['producer', 'uncompressed', 'gzip', 'snappy', 'lz4', 'zstd'] },
    { key: 'delete.retention.ms' },
    { key: 'file.delete.delay.ms' },
    { key: 'flush.messages' },
    { key: 'flush.ms' },
    { key: 'follower.replication.throttled.rate' },
    { key: 'follower.replication.throttled.replicas' },
    { key: 'index.interval.bytes' },
    { key: 'leader.replication.throttled.rate' },
    { key: 'leader.replication.throttled.replicas' },
    { key: 'max.compaction.lag.ms' },
    { key: 'max.message.bytes' },
    { key: 'message.downconversion.enable', values: ['true', 'false'] },
    { key: 'message.format.version' },
    { key: 'message.timestamp.difference.max.ms' },
    { key: 'message.timestamp.type', values: ['CreateTime', 'LogAppendTime'] },
    { key: 'min.cleanable.dirty.ratio' },
    { key: 'min.compaction.lag.ms' },
    { key: 'min.insync.replicas' },
    { key: 'preallocate', values: ['true', 'false'] },
    { key: 'remote.storage.enable', values: ['true', 'false'] },
    { key: 'retention.bytes' },
    { key: 'retention.ms' },
    { key: 'segment.bytes' },
    { key: 'segment.index.bytes' },
    { key: 'segment.jitter.ms' },
    { key: 'segment.ms' },
    { key: 'unclean.leader.election.enable', values: ['true', 'false'] },
];

export const TOPIC_CONFIG_KEYS: string[] = TOPIC_CONFIGS.map((entry) => entry.key);

export function configValuesFor(key: string): string[] | undefined {
    return TOPIC_CONFIGS.find((entry) => entry.key === key)?.values;
}