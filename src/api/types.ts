export type TopicType = 'virtual' | 'physical';
export type FilterKind = 'cel' | 'header';
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

export const isInternalTopic = (t: Topic) => t.name.startsWith("__")

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

export type VirtualTopicConfigFilter =
    | { type: 'headerEquals'; header: string; value: string }
    | { type: 'headerContains'; header: string; value: string }
    | { type: 'headerStartsWith'; header: string; value: string }
    | { type: 'headerMatches'; header: string; value: string }
    | { type: 'cel'; expression: string };

export interface VirtualTopicConfig {
    topic: string;
    exposePhysicalTopic: boolean;
    filter?: VirtualTopicConfigFilter;
}

export interface VirtualTopicPatch {
    name?: string;
    topic?: string;
    exposePhysicalTopic?: boolean;
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

export class ApiError extends Error {
    constructor(
        readonly code: string,
        message: string,
        readonly field?: string,
    ) {
        super(message);
        this.name = 'ApiError';
    }
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
