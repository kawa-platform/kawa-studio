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

export interface GovernanceRule {
    id: string;
    name: string;
    /// CEL; the rule is evaluated only when this is true. "true" means every topic.
    selector: string;
    /// CEL; false refuses the request with 403, the rule name and the message.
    expression: string;
    message: string;
}

export interface GovernanceExemption {
    id: string;
    name: string;
    principalPattern: string;
    topicPattern: string;
}

export interface GovernanceDocument {
    variables: GovernanceVariable[];
    rules: GovernanceRule[];
    exemptions: GovernanceExemption[];
}

export interface TopicInput {
    name: string;
    partitions: number;
    replicationFactor: number;
    config: Record<string, string>;
}
