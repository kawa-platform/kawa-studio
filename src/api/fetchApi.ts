import type {KawaApi, AclQuery} from './api';
import {ApiError} from './error';
import {
    type Acl,
    type ApiErrorBody,
    type AuthClientView,
    type Client,
    type CreatePhysicalTopicResult,
    type GovernanceDryRunView,
    type GovernanceExemptionView,
    type GovernanceRuleView,
    type GovernanceVariableView,
    type GovernanceView,
    type GroupView,
    type RoleView,
    type Topic,
    type VirtualTopicPatch,
} from './types';

/// Defaults to the gateway running on localhost:8080. Set VITE_API_BASE to point at a
/// different gateway, e.g. VITE_API_BASE=http://other-host:8080 npm run dev.
const BASE = (import.meta.env.VITE_API_BASE?.trim() || 'http://localhost:8080').replace(/\/$/, '');

async function request<T>(path: string, init?: RequestInit, base = BASE): Promise<T> {
    const response = await fetch(base + path, {
        ...init,
        headers: {'content-type': 'application/json', ...(init?.headers ?? {})},
    });
    if (response.status === 204) return undefined as T;
    const body = await response.json().catch(() => null);
    if (!response.ok) {
        const envelope = body as ApiErrorBody | null;
        throw new ApiError(
            envelope?.error.code ?? 'unknown',
            envelope?.error.message ?? 'Request failed with ' + response.status,
            envelope?.error.field,
        );
    }
    return body as T;
}

function query(params: Record<string, string | undefined>): string {
    const entries = Object.entries(params).filter(([, v]) => v);
    if (!entries.length) return '';
    return '?' + new URLSearchParams(entries as [string, string][]).toString();
}

/// The admin server serves RBAC at root paths on its own port (default 8080) and is
/// CORS-enabled for the Vite dev origin, so the UI calls it directly rather than through
/// the gateway's `/api` proxy. Unlike the gateway, failures carry a plain string envelope
/// `{"error": "string"}` — surface the message verbatim.
const ADMIN_BASE = (import.meta.env.VITE_ADMIN_API_BASE?.trim() || 'http://localhost:8080').replace(/\/$/, '');

async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(ADMIN_BASE + path, {
        ...init,
        headers: {'content-type': 'application/json', ...(init?.headers ?? {})},
    });
    if (response.status === 204) return undefined as T;
    const body = await response.json().catch(() => null);
    if (!response.ok) {
        const message =
            (body as {error?: string} | null)?.error ||
            'Request failed with ' + response.status;
        throw new ApiError(String(response.status), message);
    }
    return body as T;
}

/// Real client. List endpoints return bare JSON arrays, not a named envelope.
export const fetchApi: KawaApi = {
    listTopics: () => request<Topic[]>('/topics'),
    getTopic: (name, type) => request('/topics/' + encodeURIComponent(name) + query({type})),

    listSchemas: (topic) => request('/schemas' + query({topic})),
    getSchema: (subject, version) =>
        request('/schemas/' + encodeURIComponent(subject) + '/versions/' + version),
    publish: (body) => request('/publish', {method: 'POST', body: JSON.stringify(body)}),

    // Auth clients live on the admin server under /auth/clients (like /rbac/*), served
    // at root paths, so they bypass the gateway '/api' proxy just like the RBAC
    // endpoints do.
    listClients: () => adminRequest<Client[]>('/auth/clients'),
    upsertClient: (username, body) =>
        adminRequest<Client>(`/auth/clients/${encodeURIComponent(username)}`, {
            method: 'PUT',
            body: JSON.stringify(body),
        }),
    patchClient: (username, body) =>
        adminRequest<Client>(`/auth/clients/${encodeURIComponent(username)}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),
    resetPassword: (username, password) =>
        adminRequest<void>(`/auth/clients/${encodeURIComponent(username)}`, {
            method: 'PATCH',
            body: JSON.stringify({password}),
        }),
    deleteClient: (username) =>
        adminRequest<void>(`/auth/clients/${encodeURIComponent(username)}`, {method: 'DELETE'}),

    listAcls: (q?: AclQuery) =>
        request<Acl[]>('/acls' + query({principal: q?.principal, resource: q?.resource})),
    createAcl: (body) => request('/acls', {method: 'POST', body: JSON.stringify(body)}),
    deleteAcl: (id) => request('/acls/' + encodeURIComponent(id), {method: 'DELETE'}),

    getClusters: () => request('/clusters'),
    // Virtual-topic config lives on the admin server alongside RBAC and auth users.
    upsertVirtualTopic: (name, body) =>
        adminRequest(`/topics/${encodeURIComponent(name)}`, {
            method: 'PUT',
            body: JSON.stringify({type: 'virtual', ...body}),
        }),
    patchVirtualTopic: (name, body: VirtualTopicPatch) =>
        adminRequest(`/topics/${encodeURIComponent(name)}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),
    deleteVirtualTopic: (name) =>
        adminRequest<void>(`/topics/${encodeURIComponent(name)}`, {method: 'DELETE'}),
    // Physical topics are provisioned on the Kafka cluster itself via the admin API.
    createPhysicalTopic: (request) =>
        adminRequest<CreatePhysicalTopicResult>('/topics', {
            method: 'POST',
            body: JSON.stringify({type: 'physical', ...request}),
        }),

    // RBAC — admin server, root paths, CORS.
    listRbacRoles: () => adminRequest<RoleView[]>('/rbac/roles'),
    upsertRbacRole: (name, body) =>
        adminRequest<RoleView>(`/rbac/roles/${encodeURIComponent(name)}`, {
            method: 'PUT',
            body: JSON.stringify(body),
        }),
    deleteRbacRole: (name) =>
        adminRequest<void>(`/rbac/roles/${encodeURIComponent(name)}`, {method: 'DELETE'}),
    listRbacGroups: () => adminRequest<GroupView[]>('/rbac/groups'),
    upsertRbacGroup: (name, body) =>
        adminRequest<GroupView>(`/rbac/groups/${encodeURIComponent(name)}`, {
            method: 'PUT',
            body: JSON.stringify(body),
        }),
    renameRbacGroup: (name, body) =>
        adminRequest<GroupView>(`/rbac/groups/${encodeURIComponent(name)}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),
    deleteRbacGroup: (name) =>
        adminRequest<void>(`/rbac/groups/${encodeURIComponent(name)}`, {method: 'DELETE'}),
    listAuthClients: () => adminRequest<AuthClientView[]>('/auth/clients'),

    // Governance writes wait until the gateway applied them, so the list re-read right after
    // already shows the change.
    getGovernance: () => adminRequest<GovernanceView>('/governance/rules'),
    upsertGovernanceRule: (name, body) =>
        adminRequest<GovernanceRuleView>(`/governance/rules/${encodeURIComponent(name)}?consistency=applied`, {
            method: 'PUT',
            body: JSON.stringify(body),
        }),
    deleteGovernanceRule: (name) =>
        adminRequest<void>(`/governance/rules/${encodeURIComponent(name)}?consistency=applied`, {method: 'DELETE'}),
    upsertGovernanceExemption: (name, body) =>
        adminRequest<GovernanceExemptionView>(`/governance/exemptions/${encodeURIComponent(name)}?consistency=applied`, {
            method: 'PUT',
            body: JSON.stringify(body),
        }),
    deleteGovernanceExemption: (name) =>
        adminRequest<void>(`/governance/exemptions/${encodeURIComponent(name)}?consistency=applied`, {method: 'DELETE'}),
    upsertGovernanceVariable: (name, body) =>
        adminRequest<GovernanceVariableView>(`/governance/variables/${encodeURIComponent(name)}?consistency=applied`, {
            method: 'PUT',
            body: JSON.stringify(body),
        }),
    deleteGovernanceVariable: (name) =>
        adminRequest<void>(`/governance/variables/${encodeURIComponent(name)}?consistency=applied`, {method: 'DELETE'}),
    dryRunGovernance: (body) =>
        adminRequest<GovernanceDryRunView>('/governance/dry-run', {method: 'POST', body: JSON.stringify(body)}),
};
