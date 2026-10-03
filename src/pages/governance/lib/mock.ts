import type { Operation, ResourceType, TopicScope } from './resources';
import type { GovernanceDocument, GovernanceRule, RuleExemption, SubRuleCheck } from './types';

/// Sample document until GET /governance exists. Every value is illustrative: rules,
/// variables and the naming convention are whatever the operator authors.

/// A check whose expression is name.matches(<regex>), with the regex authored raw.
const matches = (name: string, regex: string, subject = 'topic.name'): SubRuleCheck => ({
    id: 'c-' + name, kind: 'check', name, expression: `${subject}.matches(${JSON.stringify(regex)})`,
});
const seg = (group: string): string => `(?<${group}>[a-z0-9-]+)`;
const opt = (group: string): string => String.raw`(?:\.` + seg(group) + ')?';

/// Rules that are one standalone check.
const single = (
    id: string, name: string, description: string, errorMessage: string, selector: string, expression: string,
    target: { resourceType?: ResourceType; scope?: TopicScope; operations?: Operation[]; exemptions?: RuleExemption[] } = {},
): GovernanceRule => ({
    id, name, description, errorMessage, resourceType: target.resourceType ?? 'topic', scope: target.scope ?? 'both',
    operations: target.operations ?? ['create'], selector, combinator: 'all',
    subRules: [{ id: id + '-1', kind: 'check', name, expression }], exemptions: target.exemptions ?? [],
});

const compacted = '["compact", "compact,delete", "delete,compact"]';

/// Sample document for tests; the pages load the real one from the gateway.
export function sampleDocument(): GovernanceDocument {
    return {
        variables: [
            { id: 'v2', name: 'compactPolicies', type: 'list<string>', note: 'cleanup.policy values that count as compacted.', value: compacted },
            { id: 'v3', name: 'cleanupPolicies', type: 'list<string>', note: 'Every cleanup.policy value the platform allows.', value: '["compact", "delete", "compact,delete", "delete,compact"]' },
            { id: 'v4', name: 'partitionTiers', type: 'list<int>', note: 'single, low, medium, high.', value: '[1, 4, 6, 12]' },
            { id: 'v5', name: 'retentionTiers', type: 'list<int>', note: '1 day, 3 days, 7 days, 40 days, 90 days, infinite.', value: '[86400000, 259200000, 604800000, 3456000000, 7776000000, -1]' },
            { id: 'v6', name: 'minReplicationFactor', type: 'int', note: 'Cluster-wide durability floor.', value: '3' },
        ],
        rules: [
            {
                id: 'r1', name: 'topic-naming-convention', resourceType: 'topic', scope: 'both', operations: ['create'], selector: 'true', combinator: 'any',
                description: 'Every topic name follows one of the accepted forms, one sub-rule per form.',
                errorMessage: 'Topic names must follow one of the defined naming conventions.',
                subRules: [
                    matches('model', String.raw`^model\.` + seg('domain') + opt('subject') + '$'),
                    matches('event', String.raw`^event\.` + seg('domain') + opt('subject') + '$'),
                    {
                        id: 'g-app', kind: 'group', name: 'app', combinator: 'any',
                        checks: [
                            matches('standard', String.raw`^app\.` + seg('service') + opt('subject') + String.raw`(?:\.dlt)?$`),
                            matches('changelog', String.raw`^app\.` + seg('service') + '-' + seg('store') + '-changelog$'),
                        ],
                    },
                    matches('ingest', String.raw`^ingest\.` + seg('source') + String.raw`\.` + seg('subject') + '$'),
                    matches('egress', String.raw`^egress\.` + seg('destination') + opt('subject') + '$'),
                ],
                exemptions: [{
                    id: 'x-connect', name: 'kafka-connect-internals',
                    description: 'Kafka Connect creates its own config, offset and status topics.',
                    expression: 'principal == "User:kafka-connect" && topic.name.startsWith("connect-")',
                }],
            },
            single('r2', 'model-topics-compacted', 'Model topics hold the latest state per key.',
                'All topics starting with model. must use compaction. Valid cleanup.policy values: compact, compact,delete, delete,compact.',
                'topic.name.startsWith("model.")',
                '"cleanup.policy" in topic.configs && topic.configs["cleanup.policy"] in compactPolicies', { scope: 'physical' }),
            single('r3', 'model-topics-infinite-retention', 'Model topics are never truncated by time.',
                'All topics starting with model. must have infinite retention.',
                'topic.name.startsWith("model.")',
                '"retention.ms" in topic.configs && int(topic.configs["retention.ms"]) == -1', { scope: 'physical' }),
            single('r4', 'changelog-compaction', 'Kafka Streams state stores rebuild from compacted changelogs.',
                'Kafka Streams changelog topics must be compacted: compact, compact,delete or delete,compact.',
                'topic.name.endsWith("-changelog")',
                '"cleanup.policy" in topic.configs && topic.configs["cleanup.policy"] in compactPolicies', { scope: 'physical' }),
            single('r5', 'cleanup-policy-allowed', 'Only the cleanup policies the platform supports.',
                'cleanup.policy must be one of compact, delete, compact,delete or delete,compact.',
                'true',
                '"cleanup.policy" in topic.configs && topic.configs["cleanup.policy"] in cleanupPolicies', { scope: 'physical' }),
            single('r6', 'partition-tier', 'Partition counts come in fixed tiers.',
                'Partition count must match a defined tier: single (1), low (4), medium (6), high (12).',
                'true',
                'topic.partitions in partitionTiers', {
                    scope: 'physical',
                    exemptions: [{
                        id: 'x-platform', name: 'platform-team',
                        description: 'The platform team sizes infrastructure topics by hand.',
                        expression: 'principal.startsWith("User:platform-")',
                    }],
                }),
            single('r7', 'retention-tier', 'Retention comes in fixed tiers.',
                'retention.ms must match a defined tier: 1 day, 3 days, 7 days, 40 days, 90 days or infinite (-1).',
                'true',
                '"retention.ms" in topic.configs && int(topic.configs["retention.ms"]) in retentionTiers', { scope: 'physical' }),
            single('r8', 'egress-no-dlt', 'Egress topics leave the platform; dead letters stay inside.',
                'Egress topics must not contain dlt as a name segment.',
                'topic.name.startsWith("egress.")',
                '!topic.name.endsWith(".dlt") && !topic.name.contains(".dlt.")'),
            single('r9', 'min-replication-factor', 'Durability floor for every topic.',
                'Replication factor must be at least 3.',
                'true',
                'topic.replicationFactor >= minReplicationFactor', { scope: 'physical' }),
            {
                id: 'r10', name: 'consumer-group-naming', resourceType: 'consumer-group', scope: 'both', operations: ['create'], selector: 'true', combinator: 'any',
                description: 'Consumer groups are owned by an app, or are Kafka Connect internals.',
                errorMessage: 'Consumer group ids must be app.<service>[.<purpose>] or connect-<connector>.',
                subRules: [
                    matches('app', String.raw`^app\.` + seg('service') + opt('purpose') + '$', 'group.id'),
                    { id: 'c-connect', kind: 'check', name: 'connect', expression: 'group.id.startsWith("connect-")' },
                ],
                exemptions: [],
            },
            single('r11', 'transactional-id-naming', 'Transactional ids carry the owning service, so fencing stays per app.',
                'Transactional ids must be app.<service>.tx[.<instance>].',
                'true',
                `transaction.id.matches(${JSON.stringify(String.raw`^app\.` + seg('service') + String.raw`\.tx` + opt('instance') + '$')})`,
                { resourceType: 'transactional-id' }),
        ],
        exemptions: [
            {
                id: 'e1', name: 'unconventional-legacy', description: 'Pre-convention topics the platform team still maintains.',
                expression: 'principal.startsWith("User:platform-") && topic.name.startsWith("legacy-")',
            },
            {
                id: 'e3', name: 'cargo-scratch', description: 'Scratch space for the cargo team; never shared.',
                expression: 'principal == "User:app-cargo" && topic.name.startsWith("scratch.cargo.")',
            },
        ],
    };
}
