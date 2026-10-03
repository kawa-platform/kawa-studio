import { inject, type InjectionKey } from 'vue';
import type {
    Acl, AuthClientView, Client, CreateAclRequest, CreateClientRequest,
    CreatePhysicalTopicRequest, CreatePhysicalTopicResult,
    GovernanceDryRunRequest, GovernanceDryRunView,
    GovernanceExemptionView, GovernanceRuleView, GovernanceVariableView, GovernanceView,
    GroupConfig, GroupConfigPatch, GroupView, PublishRequest, PublishResult, RoleConfig, RoleView,
    SchemaDetail, SchemaListing, Topic, TopicType, ClientConfigPatch, Clusters,
    VirtualTopicConfig, VirtualTopicPatch,
} from './types';

export interface AclQuery {
    principal?: string;
    resource?: string;
}

/// The whole backend surface the UI depends on. One implementation (fetchApi.ts), a fetch
/// client proxied to the gateway.
export interface KawaApi {
    listTopics(): Promise<Topic[]>;
    getTopic(name: string, type: TopicType): Promise<Topic>;

    listSchemas(topic: string): Promise<SchemaListing>;
    getSchema(subject: string, version: number): Promise<SchemaDetail>;
    publish(request: PublishRequest): Promise<PublishResult>;

    listClients(): Promise<Client[]>;
    upsertClient(username: string, request: CreateClientRequest): Promise<Client>;
    patchClient(username: string, request: ClientConfigPatch): Promise<Client>;
    resetPassword(username: string, password: string): Promise<void>;
    deleteClient(username: string): Promise<void>;

    /** RBAC — talks directly to the admin server (root paths via CORS), not the `/api` proxy. */
    listRbacRoles(): Promise<RoleView[]>;
    upsertRbacRole(name: string, request: RoleConfig): Promise<RoleView>;
    deleteRbacRole(name: string): Promise<void>;
    listRbacGroups(): Promise<GroupView[]>;
    upsertRbacGroup(name: string, request: GroupConfig): Promise<GroupView>;
    renameRbacGroup(name: string, request: GroupConfigPatch): Promise<GroupView>;
    deleteRbacGroup(name: string): Promise<void>;
    listAuthClients(): Promise<AuthClientView[]>;

    listAcls(query?: AclQuery): Promise<Acl[]>;
    createAcl(request: CreateAclRequest): Promise<Acl>;
    deleteAcl(id: string): Promise<void>;

    getClusters(): Promise<Clusters>;
    upsertVirtualTopic(name: string, request: VirtualTopicConfig): Promise<VirtualTopicConfig>;
    patchVirtualTopic(name: string, request: VirtualTopicPatch): Promise<VirtualTopicConfig>;
    deleteVirtualTopic(name: string): Promise<void>;
    createPhysicalTopic(request: CreatePhysicalTopicRequest): Promise<CreatePhysicalTopicResult>;

    /** Governance — admin server. Each write is applied by the gateway on its own. */
    getGovernance(): Promise<GovernanceView>;
    upsertGovernanceRule(name: string, request: GovernanceRuleView): Promise<GovernanceRuleView>;
    deleteGovernanceRule(name: string): Promise<void>;
    upsertGovernanceExemption(name: string, request: GovernanceExemptionView): Promise<GovernanceExemptionView>;
    deleteGovernanceExemption(name: string): Promise<void>;
    upsertGovernanceVariable(name: string, request: GovernanceVariableView): Promise<GovernanceVariableView>;
    deleteGovernanceVariable(name: string): Promise<void>;
    dryRunGovernance(request: GovernanceDryRunRequest): Promise<GovernanceDryRunView>;
}

export const apiKey: InjectionKey<KawaApi> = Symbol('kawa-api');

export function useApi(): KawaApi {
    const api = inject(apiKey);
    if (!api) throw new Error('No KawaApi provided — did main.ts call app.provide(apiKey, …)?');
    return api;
}
