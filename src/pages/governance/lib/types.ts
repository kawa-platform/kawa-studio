import type { Operation, ResourceType, TestValues, TopicScope } from './resources';

/// Governance document shapes. Feature-local while the page runs on mock data; move them
/// into src/api/types.ts when the page is wired to GET/PUT /governance.

export type VariableType = 'string' | 'int' | 'double' | 'bool' | 'list<string>' | 'list<int>';

export const variableTypes: VariableType[] = ['string', 'int', 'double', 'bool', 'list<string>', 'list<int>'];

export interface GovernanceVariable {
    id: string;
    name: string;
    type: VariableType;
    /// A CEL literal as authored: "\"^app\\..+$\"", "[1, 4, 6, 12]", "3".
    value: string;
    note: string;
    /// Pattern-table hints for annotated regex values. Keys are a group name, or
    /// prefix.group to override it for one branch (e.g. "app.subject").
    samples?: Record<string, string>;
    /// Text appended to one pattern row, keyed by its displayed form.
    notes?: Record<string, string>;
    /// Further examples for one pattern row, keyed by its displayed form.
    extraExamples?: Record<string, string[]>;
}

/// How a group combines its sub-rules: all must hold (AND) or any one must (OR).
export type Combinator = 'all' | 'any';

interface SubRuleBase {
    id: string;
    name: string;
    /// Optional; when empty the nearest ancestor's message is returned.
    errorMessage?: string;
}

/// A standalone CEL check.
export interface SubRuleCheck extends SubRuleBase {
    kind: 'check';
    expression: string;
}

/// A combination of standalone checks. Groups nest one level only: a group never
/// contains another group.
export interface SubRuleGroup extends SubRuleBase {
    kind: 'group';
    combinator: Combinator;
    checks: SubRuleCheck[];
}

export type SubRule = SubRuleCheck | SubRuleGroup;

/// A named case one rule does not apply to: when its expression is true for a request,
/// that rule is skipped. An exemption that fails to evaluate does not apply.
export interface RuleExemption {
    id: string;
    name: string;
    description: string;
    /// CEL over the same context as the rule (principal, service, the resource).
    expression: string;
}

/// A rule has no expression of its own: it combines one or more sub-rules.
export interface GovernanceRule {
    id: string;
    name: string;
    description: string;
    errorMessage: string;
    /// Which kind of resource the rule governs; decides the context variable its
    /// expressions can read (topic, group, …).
    resourceType: ResourceType;
    /// Topic rules only: physical topics, virtual topics, or both. Ignored for other types.
    scope: TopicScope;
    /// Topic rules only: any of create, alter (config changes, CreatePartitions) and delete. Ignored for other types.
    operations: Operation[];
    /// CEL; the rule is evaluated only when this is true. "true" means every resource of
    /// that type.
    selector: string;
    combinator: Combinator;
    subRules: SubRule[];
    /// Cases this rule alone is skipped for. Global exemptions live on the document.
    exemptions: RuleExemption[];
}

/// Skips every rule for a request when its expression is true. Same shape as a rule
/// exemption; it may read any resource variable, plus principal and service.
export type GovernanceExemption = RuleExemption;

export interface GovernanceDocument {
    variables: GovernanceVariable[];
    rules: GovernanceRule[];
    exemptions: GovernanceExemption[];
}

/// A resource as a dry run sees it: its kind plus the raw test inputs.
export interface ResourceInput {
    type: ResourceType;
    /// Topics only; create by default.
    operation?: Operation;
    values: TestValues;
    principal?: string;
    service?: string;
}
