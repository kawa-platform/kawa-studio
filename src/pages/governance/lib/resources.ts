/// The resource kinds a rule can govern. The kind decides which context variable the
/// rule's expressions can read: a consumer-group rule sees `group`, never `topic`.
/// Topics come in two kinds, physical and virtual; a topic rule's scope says which, and
/// that decides which `topic` fields are safe to read. Everything the UI shows about
/// "what can I use here" is derived from this table.

export type ResourceType = 'topic' | 'consumer-group' | 'transactional-id';
export type TopicKind = 'physical' | 'virtual';
export type TopicScope = 'both' | TopicKind;
/// The request kinds a topic rule runs on. Alter covers config changes and adding partitions;
/// the rule sees the topic as it will be after the change. Delete sees the topic as it is.
export type Operation = 'create' | 'alter' | 'delete';

export const operationOptions: { value: Operation; label: string }[] = [
    { value: 'create', label: 'Create' },
    { value: 'alter', label: 'Alter' },
    { value: 'delete', label: 'Delete' },
];

const wireOperations = { create: 'CREATE', alter: 'ALTER', delete: 'DELETE' } as const;
export type WireOperation = (typeof wireOperations)[Operation];
export const toWireOperation = (o: Operation): WireOperation => wireOperations[o];
export const fromWireOperation = (o: string): Operation => (o === 'ALTER' ? 'alter' : o === 'DELETE' ? 'delete' : 'create');

/// What a rule targets: a resource type, and for topics which kinds.
export interface Target {
    type: ResourceType;
    scope: TopicScope;
}

export interface ResourceField {
    /// Path under the resource variable, e.g. "name" or "config".
    name: string;
    type: 'string' | 'int' | 'bool' | 'map<string, string>';
    doc: string;
    /// Topic fields that exist on one kind only.
    only?: TopicKind;
}

export interface TestField {
    key: string;
    label: string;
    kind: 'string' | 'int';
    initial: string | number;
    mono?: boolean;
    only?: TopicKind;
}

/// Raw dry-run inputs. For topics, `virtual` picks the kind.
export type TestValues = Record<string, string | number | boolean>;

export interface ResourceDef {
    type: ResourceType;
    label: string;
    singular: string;
    icon: string;
    /// The CEL variable bound for this resource.
    variable: string;
    fields: ResourceField[];
    /// Extra completions beyond the plain fields.
    snippets: { label: string; type: string; detail?: string }[];
    placeholder: string;
    /// Typical "When" conditions, offered as one-click hints.
    whenExamples: { code: string; only?: TopicKind }[];
    /// Inputs for a dry run; the first one is the resource's name.
    test: TestField[];
    /// Test inputs → the value bound to `variable`. Ints are BigInt for cel-js.
    build: (values: TestValues) => Record<string, unknown>;
}

const str = (v: string | number | boolean | undefined): string => String(v ?? '').trim();
const int = (v: string | number | boolean | undefined): bigint => BigInt(Math.trunc(Number(v ?? 0)));

export const resources: ResourceDef[] = [
    {
        type: 'topic', label: 'Topic', singular: 'topic', icon: 'ph-stack', variable: 'topic',
        fields: [
            { name: 'name', type: 'string', doc: 'Topic name, as clients see it.' },
            { name: 'virtual', type: 'bool', doc: 'True for a virtual topic, false for a physical one.' },
            { name: 'partitions', type: 'int', doc: 'Partition count.', only: 'physical' },
            { name: 'replicationFactor', type: 'int', doc: 'Replicas per partition.', only: 'physical' },
            { name: 'configs', type: 'map<string, string>', doc: 'Topic configs set on the request, e.g. cleanup.policy.', only: 'physical' },
            { name: 'physicalTopic', type: 'string', doc: 'The physical topic it maps onto.', only: 'virtual' },
        ],
        snippets: [
            { label: 'topic.configs["cleanup.policy"]', type: 'variable', detail: 'string · physical only' },
            { label: '"retention.ms" in topic.configs', type: 'variable', detail: 'key present · physical only' },
            { label: 'topic.name.startsWith("")', type: 'function', detail: 'bool' },
            { label: 'topic.name.matches()', type: 'function', detail: 'regex' },
            { label: '!topic.virtual && ', type: 'keyword', detail: 'guard: physical topics' },
        ],
        placeholder: 'topic.name.matches("^app\\\\..+$")',
        whenExamples: [
            { code: 'topic.name.startsWith("model.")' },
            { code: 'topic.name.endsWith("-changelog")' },
            { code: '!topic.virtual' },
            { code: 'topic.virtual' },
        ],
        test: [
            { key: 'name', label: 'Topic name', kind: 'string', initial: '', mono: true },
            { key: 'physicalTopic', label: 'Physical topic', kind: 'string', initial: 'app.cargo.flight', mono: true, only: 'virtual' },
            { key: 'partitions', label: 'Partitions', kind: 'int', initial: 12, only: 'physical' },
            { key: 'replicationFactor', label: 'Replication', kind: 'int', initial: 3, only: 'physical' },
            { key: 'cleanup.policy', label: 'cleanup.policy', kind: 'string', initial: 'delete', mono: true, only: 'physical' },
            { key: 'retention.ms', label: 'retention.ms', kind: 'string', initial: '604800000', mono: true, only: 'physical' },
        ],
        build: (v) => {
            if (v.virtual === true) return { name: str(v.name), virtual: true, physicalTopic: str(v.physicalTopic) };
            const config: Record<string, string> = {};
            for (const key of ['cleanup.policy', 'retention.ms']) if (str(v[key])) config[key] = str(v[key]);
            return {
                name: str(v.name), virtual: false,
                partitions: int(v.partitions), replicationFactor: int(v.replicationFactor), configs: config,
            };
        },
    },
    {
        type: 'consumer-group', label: 'Consumer group', singular: 'consumer group', icon: 'ph-users-three', variable: 'group',
        fields: [{ name: 'id', type: 'string', doc: 'Consumer group id.' }],
        snippets: [
            { label: 'group.id.startsWith("")', type: 'function', detail: 'bool' },
            { label: 'group.id.matches()', type: 'function', detail: 'regex' },
        ],
        placeholder: 'group.id.matches("^app\\\\..+$")',
        whenExamples: [{ code: 'group.id.startsWith("app.")' }, { code: '!group.id.startsWith("connect-")' }],
        test: [{ key: 'id', label: 'Group id', kind: 'string', initial: '', mono: true }],
        build: (v) => ({ id: str(v.id) }),
    },
    {
        type: 'transactional-id', label: 'Transactional id', singular: 'transactional id', icon: 'ph-arrows-left-right', variable: 'transaction',
        fields: [{ name: 'id', type: 'string', doc: 'Producer transactional.id.' }],
        snippets: [{ label: 'transaction.id.matches()', type: 'function', detail: 'regex' }],
        placeholder: 'transaction.id.matches("^app\\\\..+\\\\.tx$")',
        whenExamples: [{ code: 'transaction.id.startsWith("app.")' }],
        test: [{ key: 'id', label: 'Transactional id', kind: 'string', initial: '', mono: true }],
        build: (v) => ({ id: str(v.id) }),
    },
];

export const topicScopes: { value: TopicScope; label: string }[] = [
    { value: 'both', label: 'Physical and virtual' },
    { value: 'physical', label: 'Physical only' },
    { value: 'virtual', label: 'Virtual only' },
];

export const resourceDef = (type: ResourceType): ResourceDef => resources.find((r) => r.type === type) ?? resources[0]!;

/// Who is asking, bound on every rule and exemption regardless of resource kind.
export const requestFields: { name: string; type: 'string'; doc: string }[] = [
    { name: 'principal', type: 'string', doc: 'Authenticated principal making the request, e.g. User:app-cargo.' },
    { name: 'service', type: 'string', doc: 'Service the request came through.' },
];

/// Context variable names of every resource kind plus the request fields; reserved, so no
/// declared variable can shadow them.
export const resourceVariables = [...resources.map((r) => r.variable), ...requestFields.map((f) => f.name)];

export const kindsOf = (scope: TopicScope): TopicKind[] => (scope === 'both' ? ['physical', 'virtual'] : [scope]);
export const inScope = (scope: TopicScope, kind: TopicKind): boolean => scope === 'both' || scope === kind;

/// "topic", "physical topic", "consumer group", …
export function targetLabel(t: Target): string {
    if (t.type !== 'topic' || t.scope === 'both') return resourceDef(t.type).singular;
    return `${t.scope} topic`;
}

/// Fields an expression on this target can see. Under "both", one-kind fields stay in the
/// list (tagged by `only`) because a guard on topic.virtual makes them safe.
export const fieldsFor = (t: Target): ResourceField[] =>
    resourceDef(t.type).fields.filter((f) => !f.only || inScope(t.scope, f.only));

/// Fields that never exist for this target.
export const missingFieldsFor = (t: Target): ResourceField[] =>
    resourceDef(t.type).fields.filter((f) => f.only && !inScope(t.scope, f.only));

export const testFieldsFor = (type: ResourceType, kind: TopicKind): TestField[] =>
    resourceDef(type).test.filter((f) => !f.only || f.only === kind);

/// What the expression editor completes for one target, declared variables appended by
/// the caller.
export function resourceCompletions(t: Target): { label: string; type: string; detail?: string }[] {
    const def = resourceDef(t.type);
    const shown = new Set(fieldsFor(t).map((f) => f.name));
    return [
        ...fieldsFor(t).map((f) => ({
            label: `${def.variable}.${f.name}`, type: 'variable',
            detail: f.only && t.scope === 'both' ? `${f.type} · ${f.only} only` : f.type,
        })),
        ...def.snippets.filter((s) => {
            const m = s.label.match(/topic\.(\w+)/);
            return !m || shown.has(m[1]!);
        }),
        ...requestFields.map((f) => ({ label: f.name, type: 'variable', detail: f.type })),
    ];
}

export const initialTestValues = (type: ResourceType): TestValues =>
    Object.fromEntries(resourceDef(type).test.map((f) => [f.key, f.initial]));
