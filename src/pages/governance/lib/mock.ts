import type { GovernanceDocument } from './types';

/// Sample document until GET /governance exists. Every value is illustrative: rules,
/// variables and the naming convention are whatever the operator authors.

const namingPattern = '^(?:' + [
    'model\\.(?<domain>[a-z0-9-]+)(?:\\.(?<subject>[a-z0-9-]+))?',
    'event\\.(?<domain>[a-z0-9-]+)(?:\\.(?<subject>[a-z0-9-]+))?',
    'app\\.(?<service>[a-z0-9-]+)(?:\\.(?<subject>[a-z0-9-]+))?(?:\\.dlt)?',
    'app\\.(?<service>[a-z0-9-]+)-(?<store>[a-z0-9-]+)-changelog',
    'ingest\\.(?<source>[a-z0-9-]+)\\.(?<subject>[a-z0-9-]+)',
    'egress\\.(?<destination>[a-z0-9-]+)(?:\\.(?<subject>[a-z0-9-]+))?',
].join('|') + ')$';

const compacted = '["compact", "compact,delete", "delete,compact"]';

export function sampleDocument(): GovernanceDocument {
    return {
        variables: [
            {
                id: 'v1', name: 'namingPattern', type: 'string',
                note: 'Accepted topic-name forms, as one alternation.',
                value: JSON.stringify(namingPattern),
                samples: {
                    domain: 'customer', subject: 'address', service: 'cargo', store: 'flights',
                    source: 'cdb', destination: 'mail',
                    'app.subject': 'flight', 'ingest.subject': 'flight', 'egress.subject': 'retry',
                },
                notes: { 'ingest.<source>.<subject>': 'no DLT on this pattern' },
                extraExamples: { 'egress.<destination>[.subject]': ['egress.dwh.s3'] },
            },
            { id: 'v2', name: 'compactPolicies', type: 'list<string>', note: 'cleanup.policy values that count as compacted.', value: compacted },
            { id: 'v3', name: 'cleanupPolicies', type: 'list<string>', note: 'Every cleanup.policy value the platform allows.', value: '["compact", "delete", "compact,delete", "delete,compact"]' },
            { id: 'v4', name: 'partitionTiers', type: 'list<int>', note: 'single, low, medium, high.', value: '[1, 4, 6, 12]' },
            { id: 'v5', name: 'retentionTiers', type: 'list<int>', note: '1 day, 3 days, 7 days, 40 days, 90 days, infinite.', value: '[86400000, 259200000, 604800000, 3456000000, 7776000000, -1]' },
            { id: 'v6', name: 'minReplicationFactor', type: 'int', note: 'Cluster-wide durability floor.', value: '3' },
        ],
        rules: [
            {
                id: 'r1', name: 'topic-naming-convention', selector: 'true',
                expression: 'topic.name.matches(namingPattern)',
                message: 'Topic names must follow one of the defined naming conventions.',
            },
            {
                id: 'r2', name: 'model-topics-compacted', selector: 'topic.name.startsWith("model.")',
                expression: '"cleanup.policy" in topic.config && topic.config["cleanup.policy"] in compactPolicies',
                message: 'All topics starting with model. must use compaction. Valid cleanup.policy values: compact, compact,delete, delete,compact.',
            },
            {
                id: 'r3', name: 'model-topics-infinite-retention', selector: 'topic.name.startsWith("model.")',
                expression: '"retention.ms" in topic.config && int(topic.config["retention.ms"]) == -1',
                message: 'All topics starting with model. must have infinite retention.',
            },
            {
                id: 'r4', name: 'changelog-compaction', selector: 'topic.name.endsWith("-changelog")',
                expression: '"cleanup.policy" in topic.config && topic.config["cleanup.policy"] in compactPolicies',
                message: 'Kafka Streams changelog topics must be compacted: compact, compact,delete or delete,compact.',
            },
            {
                id: 'r5', name: 'cleanup-policy-allowed', selector: 'true',
                expression: '"cleanup.policy" in topic.config && topic.config["cleanup.policy"] in cleanupPolicies',
                message: 'cleanup.policy must be one of compact, delete, compact,delete or delete,compact.',
            },
            {
                id: 'r6', name: 'partition-tier', selector: 'true',
                expression: 'topic.partitions in partitionTiers',
                message: 'Partition count must match a defined tier: single (1), low (4), medium (6), high (12).',
            },
            {
                id: 'r7', name: 'retention-tier', selector: 'true',
                expression: '"retention.ms" in topic.config && int(topic.config["retention.ms"]) in retentionTiers',
                message: 'retention.ms must match a defined tier: 1 day, 3 days, 7 days, 40 days, 90 days or infinite (-1).',
            },
            {
                id: 'r8', name: 'egress-no-dlt', selector: 'topic.name.startsWith("egress.")',
                expression: '!topic.name.endsWith(".dlt") && !topic.name.contains(".dlt.")',
                message: 'Egress topics must not contain dlt as a name segment.',
            },
            {
                id: 'r9', name: 'min-replication-factor', selector: 'true',
                expression: 'topic.replicationFactor >= minReplicationFactor',
                message: 'Replication factor must be at least 3.',
            },
        ],
        exemptions: [
            { id: 'e1', name: 'unconventional-legacy', principalPattern: 'User:platform-*', topicPattern: 'legacy-*' },
            { id: 'e2', name: 'connect-internal', principalPattern: 'User:kafka-connect', topicPattern: 'connect-*' },
            { id: 'e3', name: 'cargo-scratch', principalPattern: 'User:app-cargo', topicPattern: 'scratch.cargo.*' },
        ],
    };
}
