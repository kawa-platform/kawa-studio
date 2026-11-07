import { ApiError } from '@/api/error';
import type { OAuthClientAudience, OAuthClientConfigView, OAuthClientRequest } from '@/api/types';
import type { OAuthClientTemplate } from './templates';

/// The MCP specification's page on client registration: it defines Client ID Metadata Documents and pre-registration.
export const MCP_CLIENT_REGISTRATION_URL = 'https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/client-registration';

/// The gateway's own id rule (`OAuthClientConfig`).
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
/// Ids the gateway reserves for its own clients; a PUT to them is a 409.
export const RESERVED_IDS: readonly string[] = ['kawa-studio', 'kawa-operator'];

/// A loopback http URI may give `*` as its entire port, e.g. `http://localhost:*/callback`.
const LOOPBACK_PORT_WILDCARD = /^(http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])):\*([/?].*)?$/i;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export const REDIRECT_URI_RULE =
    'An absolute https URI, or http on localhost, 127.0.0.1 or [::1]. No fragment. * only as the whole port of an http loopback URI, e.g. http://localhost:*/callback.';

export interface OAuthClientDraft {
    id: string;
    name: string;
    enabled: boolean;
    audience: OAuthClientAudience;
    redirectUris: string[];
}

export function emptyDraft(): OAuthClientDraft {
    return { id: '', name: '', enabled: true, audience: 'mcp', redirectUris: [''] };
}

/// A create form prefilled from a template; enabled, as for any new client.
export function draftFromTemplate(template: OAuthClientTemplate): OAuthClientDraft {
    return {
        id: template.id,
        name: template.name,
        enabled: true,
        audience: template.audience,
        redirectUris: [...template.redirectUris],
    };
}

export function draftOf(client: OAuthClientConfigView): OAuthClientDraft {
    return {
        id: client.id,
        name: client.name ?? '',
        enabled: client.enabled,
        audience: client.audience,
        redirectUris: client.redirectUris.length ? [...client.redirectUris] : [''],
    };
}

export function validateId(id: string): string | null {
    if (!id) return 'Client ID is required.';
    if (RESERVED_IDS.includes(id)) return `“${id}” is reserved for a built-in client.`;
    if (!ID.test(id)) return 'Use lower-case letters, digits and hyphens, starting with a letter or digit (max 64).';
    return null;
}

export function validateRedirectUri(value: string): string | null {
    const uri = value.trim();
    if (!uri) return 'Enter a redirect URI.';
    if (uri.includes('#')) return 'A redirect URI must not have a fragment.';
    let parseable = uri;
    if (uri.includes('*')) {
        const match = LOOPBACK_PORT_WILDCARD.exec(uri);
        if (!match) return 'A * is only allowed as the whole port of an http loopback URI.';
        parseable = `${match[1]}:1${match[2] ?? ''}`;
    }
    let url: URL;
    try {
        url = new URL(parseable);
    } catch {
        return 'Enter an absolute URI, e.g. https://app.example.com/callback.';
    }
    if (url.protocol === 'https:') return null;
    if (url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname)) return null;
    return 'Use https, or http on localhost, 127.0.0.1 or [::1].';
}

/// The redirect URIs to send: trimmed, blank rows dropped.
export function redirectUrisOf(draft: OAuthClientDraft): string[] {
    return draft.redirectUris.map((uri) => uri.trim()).filter(Boolean);
}

/// Client-side checks mirror the gateway's, which stays authoritative. Keys: `id`, `redirectUris`
/// (no URI at all) and `redirectUris.<row>` for a bad row. The id is only checked when `checkId`.
export function validateDraft(draft: OAuthClientDraft, checkId: boolean): Record<string, string> {
    const errors: Record<string, string> = {};
    if (checkId) {
        const idError = validateId(draft.id);
        if (idError) errors.id = idError;
    }
    if (!redirectUrisOf(draft).length) errors.redirectUris = 'At least one redirect URI is required.';
    draft.redirectUris.forEach((uri, row) => {
        if (!uri.trim()) return;
        const error = validateRedirectUri(uri);
        if (error) errors[`redirectUris.${row}`] = error;
    });
    return errors;
}

/// A PUT is a full replace, so every field is always sent.
export function requestOf(draft: OAuthClientDraft): OAuthClientRequest {
    return {
        name: draft.name.trim() || null,
        enabled: draft.enabled,
        redirectUris: redirectUrisOf(draft),
        audience: draft.audience,
    };
}

/// The same client with another enabled state, as a full PUT body.
export function requestWithEnabled(client: OAuthClientConfigView, enabled: boolean): OAuthClientRequest {
    return { name: client.name, enabled, redirectUris: client.redirectUris, audience: client.audience };
}

/// Whether the gateway does not serve OAuth clients at all (no such route), as opposed to a failure.
export function isUnavailable(cause: unknown): boolean {
    return cause instanceof ApiError && cause.code === '404';
}

/// The gateway's own wording for a refusal, which already says why.
export function messageOf(cause: unknown): string {
    return cause instanceof ApiError ? cause.message : 'Request failed.';
}

export function labelOf(client: { id: string; name: string | null }): string {
    return client.name || client.id;
}

/// Whether `client` is the tool `template` describes: it accepts one of the template's callback URIs. The id is
/// not compared, since an admin may register a template under another one.
export function matchesTemplate(client: OAuthClientConfigView, template: OAuthClientTemplate): boolean {
    return client.redirectUris.some((uri) => template.redirectUris.includes(uri));
}
