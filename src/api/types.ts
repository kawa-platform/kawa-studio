export type TopicType = 'virtual' | 'physical';
export type FilterKind = 'cel' | 'header' | 'headerContains' | 'headerStartsWith' | 'headerMatches';
export type ResourceType = 'topic' | 'group' | 'cluster';
export type PermissionType = 'allow' | 'deny';
export type FieldType = 'string' | 'uuid' | 'timestamp' | 'double' | 'int' | 'boolean' | 'enum';

export interface TopicFilter {
    kind: FilterKind;
    expression: string;
}

/// POST /topics body. Omitted partitions/replicationFactor mean the broker applies its
/// default (-1 on the wire). The `type` discriminator is added by the transport layer.
export interface CreatePhysicalTopicRequest {
    name: string;
    partitions?: number;
    replicationFactor?: number;
    configs?: Record<string, string>;
}

/// POST /topics response — the created topic as the broker reports it back.
export interface CreatePhysicalTopicResult {
    name: string;
    partitions: number;
    replicationFactor: number;
    configs?: Record<string, string>;
}

export interface Topic {
    type: TopicType;
    name: string;
    partitions: number;
    replicationFactor: number;
    /// Null for virtual topics: the gateway cannot attribute counts per alias.
    /// Absent entirely when the gateway does not report them at all.
    messageCount?: number | null;
    sizeBytes?: number | null;
    /// Virtual topics only.
    physicalTopic?: string;
    filter?: TopicFilter | null;
    valueFormat?: PayloadFormatConfig | null;
    /// Virtual topics only; absent from physical-topic summaries.
    exposePhysicalTopic?: boolean;
    config?: Record<string, string>;
}

export interface Client {
    username: string;
    mechanism: string;
    role: string | null;
    createdAt: string;
}

/// PUT /auth/clients/{name} body — the ClientConfig shape. The username lives in the
/// path, not the body.
export interface CreateClientRequest {
    mechanism: string;
    password: string;
    groups: string[];
}

/// PATCH /auth/clients/{name} body — a partial credential update. Omitted fields keep
/// their stored value; the password is write-only and never returned by the API.
export interface ClientConfigPatch {
    mechanism?: string;
    password?: string;
    groups?: string[];
}

export interface Acl {
    id: string;
    principal: string;
    resourceType: ResourceType;
    resourceName: string;
    operation: string;
    permissionType: PermissionType;
    host: string;
}

export type CreateAclRequest = Omit<Acl, 'id'>;

export interface SchemaField {
    name: string;
    type: FieldType;
    required: boolean;
    symbols?: string[];
    default?: string;
    doc?: string;
}

export interface SubjectSummary {
    subject: string;
    recordName: string;
    version: number;
}

export interface SchemaListing {
    physicalTopic: string;
    strategy: 'TopicRecordName';
    subjects: SubjectSummary[];
}

export interface SchemaDetail extends SubjectSummary {
    fields: SchemaField[];
}

export interface PublishRequest {
    topic: string;
    key: string | null;
    subject?: string;
    schemaVersion?: number;
    headers: Record<string, string>;
    value: unknown;
}

export interface PublishResult {
    topic: string;
    partition: number;
    offset: number;
    subject?: string;
    schemaVersion?: number;
}

export interface TopicAlias {
    name: string;
    physical: string;
    cluster: string;
    filter: TopicFilter | null;
}

export interface VirtualCluster {
    name: string;
    bootstrap: string;
    topics: number;
    state: 'live' | 'next';
}

/// The decode format for a virtual topic's record values. Only JSON exists in the gateway:
/// it decodes each payload so CEL content filters see the parsed document.
export type ValueFormat = 'json';

/// The wire representation of a record value encoding — the gateway's sealed `PayloadFormatConfig`.
export interface PayloadFormatConfig {
    type: 'json';
}

/// The single read filter of a virtual topic: one header test or one CEL expression. The
/// kinds mirror the gateway's sealed `VirtualTopicFilterConfig` exactly; CEL is the only
/// filter that inspects record values (decoded per `valueFormat`).
export type VirtualTopicConfigFilter =
    | { type: 'headerEquals'; header: string; value: string }
    | { type: 'headerContains'; header: string; value: string }
    | { type: 'headerStartsWith'; header: string; value: string }
    | { type: 'headerMatches'; header: string; value: string }
    | { type: 'cel'; expression: string };

export interface VirtualTopicConfig {
    topic: string;
    exposePhysicalTopic: boolean;
    valueFormat?: PayloadFormatConfig;
    filter?: VirtualTopicConfigFilter;
}

export interface VirtualTopicPatch {
    name?: string;
    topic?: string;
    exposePhysicalTopic?: boolean;
    valueFormat?: PayloadFormatConfig | null;
    filter?: VirtualTopicConfigFilter | null;
}

export interface Clusters {
    aliases: TopicAlias[];
    clusters: VirtualCluster[];
}

/// The one error envelope every non-2xx carries; `field` drives inline form errors.
export interface ApiErrorBody {
    error: { code: string; message: string; field?: string };
}

// ── RBAC ———————————————————————————————————————————————————————————
// Uppercase enum spellings match the admin API wire format exactly (see
// openapi.yaml in kawa-http-admin). They never share space with the
// lowercase legacy principal-based ACL types above.

export type PatternType = 'UNKNOWN' | 'ANY' | 'MATCH' | 'LITERAL' | 'PREFIXED';
export type ResourceKind = 'UNKNOWN' | 'ANY' | 'TOPIC' | 'GROUP' | 'CLUSTER' | 'TRANSACTIONAL_ID' | 'DELEGATION_TOKEN' | 'USER';
export type AclOperation = 'UNKNOWN' | 'ANY' | 'ALL' | 'READ' | 'WRITE' | 'CREATE' | 'DELETE' | 'ALTER' | 'DESCRIBE' | 'CLUSTER_ACTION' | 'DESCRIBE_CONFIGS' | 'ALTER_CONFIGS' | 'IDEMPOTENT_WRITE';
export type Permission = 'ALLOW' | 'DENY';

export interface RbacResourceConfig {
    type: ResourceKind;
    /** Null for CLUSTER: the config record coerces any supplied pattern to null. */
    pattern?: string | null;
    patternType?: PatternType | null;
}

export interface RbacAclConfig {
    resource: RbacResourceConfig;
    operation: AclOperation;
    permission?: Permission | null;
}

export interface RoleView {
    name: string;
    acls: RbacAclConfig[];
}

export interface RoleConfig {
    acls: RbacAclConfig[];
}

export interface GroupView {
    name: string;
    clients: string[];
    roles: string[];
}

export interface GroupConfig {
    clients: string[];
    roles: string[];
}

export interface GroupConfigPatch {
    name: string;
}

export interface AuthClientView {
    username: string;
    mechanism: string;
    password: string;
}

// ── Governance (admin server, /governance/*) ──
// Wire shapes of the gateway's governance section. The governance pages convert them to their
// own model in pages/governance/lib/apiMapper.ts.

export interface GovernanceExpression {
    type: 'CEL';
    value: string;
}

export type GovernanceResourceType = 'TOPIC' | 'GROUP' | 'TRANSACTIONAL_ID';
export type GovernanceTopicScope = 'BOTH' | 'PHYSICAL' | 'VIRTUAL';
export type GovernanceMatch = 'ALL' | 'ANY';

export interface GovernanceSelector {
    resourceType: GovernanceResourceType;
    /// null selects every resource of the type.
    expression: GovernanceExpression | null;
    scope?: GovernanceTopicScope;
    operations?: ('CREATE' | 'ALTER' | 'DELETE')[];
}

export interface GovernanceCheck {
    kind: 'check';
    name: string;
    errorMessage: string | null;
    expression: GovernanceExpression;
}

export interface GovernanceGroup {
    kind: 'group';
    name: string;
    errorMessage: string | null;
    match: GovernanceMatch;
    checks: GovernanceCheck[];
}

export type GovernanceSubRule = GovernanceCheck | GovernanceGroup;

export interface GovernanceExemptionView {
    name: string;
    description: string | null;
    expression: GovernanceExpression;
}

/// GET /governance/rules/{name}, and the PUT body (name optional there).
export interface GovernanceRuleView {
    name: string;
    errorMessage: string;
    description: string | null;
    selector: GovernanceSelector;
    match: GovernanceMatch;
    subRules: GovernanceSubRule[];
    exemptions: GovernanceExemptionView[];
}

export type GovernanceVariableType = 'string' | 'int' | 'double' | 'bool' | 'list<string>' | 'list<int>';

/// GET/PUT /governance/variables/{name}. `value` is the literal in JSON syntax.
export interface GovernanceVariableView {
    name: string;
    type: GovernanceVariableType;
    value: string;
    note: string | null;
    samples?: Record<string, string>;
    notes?: Record<string, string>;
    extraExamples?: Record<string, string[]>;
}

/// GET /governance/rules: the whole section.
export interface GovernanceView {
    rules: GovernanceRuleView[];
    exemptions: GovernanceExemptionView[];
    variables: GovernanceVariableView[];
}

/// POST /governance/dry-run. `rule` evaluates that unsaved rule alone instead of the stored ones.
export interface GovernanceDryRunRequest {
    resourceType: GovernanceResourceType;
    operation?: 'CREATE' | 'ALTER' | 'DELETE';
    virtual?: boolean;
    resource: Record<string, unknown>;
    principal: string;
    service: string;
    rule?: GovernanceRuleView;
}

export type GovernanceTraceOutcome = 'PASS' | 'FAIL' | 'ERROR' | 'SKIPPED' | 'EXEMPTED';

export interface GovernanceNodeTraceView {
    name: string;
    outcome: GovernanceTraceOutcome;
    detail: string | null;
    checks: GovernanceNodeTraceView[];
}

export interface GovernanceRuleTraceView {
    rule: string;
    outcome: GovernanceTraceOutcome;
    detail: string | null;
    exemptedBy: string | null;
    path: string[];
    message: string | null;
    subRules: GovernanceNodeTraceView[];
}

export interface GovernanceDryRunView {
    allowed: boolean;
    exemptedBy: string | null;
    rules: GovernanceRuleTraceView[];
}

// ── Admin authentication (OAuth token endpoint) ———————————————————————

/// The admin server's `POST /oauth/token` success response (RFC 6749 §5.1).
export interface TokenResponse {
    access_token: string;
    token_type: 'Bearer';
    /// Access token lifetime in seconds.
    expires_in: number;
    refresh_token: string;
}

/// The admin server's `POST /oauth/token` error response (RFC 6749 §5.2).
export interface TokenErrorBody {
    error: string;
    error_description?: string;
}
