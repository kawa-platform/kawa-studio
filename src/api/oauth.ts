import { ApiError } from './error';
import type { TokenErrorBody, TokenResponse } from './types';

/// The admin server, which is the OAuth authorization server when `admin.auth.type` is `oauth`.
const ADMIN_BASE = (import.meta.env.VITE_ADMIN_API_BASE?.trim() || 'http://localhost:8080').replace(/\/$/, '');

/// kawa studio's OAuth client id (`admin.auth.settings.clientId` on the gateway).
export const CLIENT_ID = 'kawa-studio';

/// Where the authorization server sends the browser back with a code; must be one of the gateway's
/// `admin.auth.settings.redirectUris`.
export function redirectUri(): string {
    return window.location.origin + import.meta.env.BASE_URL + 'auth/callback';
}

/// A PKCE pair (RFC 7636): the secret `verifier` stays in this tab, the `challenge` goes to the server.
export interface Pkce {
    verifier: string;
    challenge: string;
}

export async function createPkce(): Promise<Pkce> {
    const verifier = randomToken(32);
    return { verifier, challenge: await pkceChallenge(verifier) };
}

/// The S256 code challenge for `verifier`: base64url(SHA-256(verifier)).
export async function pkceChallenge(verifier: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return base64Url(new Uint8Array(digest));
}

/// A random, URL-safe token of `bytes` random bytes (used for the PKCE verifier and `state`).
export function randomToken(bytes = 16): string {
    return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/// The authorization endpoint URL that starts the login.
export function authorizeUrl(challenge: string, state: string): string {
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        redirect_uri: redirectUri(),
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state,
    });
    return ADMIN_BASE + '/oauth/authorize?' + params.toString();
}

/// Starts an authorization request without leaving the page and returns its login challenge: asked
/// for JSON, `/oauth/authorize` answers in place instead of redirecting to the login page. Used to
/// replace a challenge that expired while the login page was open (or that a gateway restart
/// invalidated). A gateway without this support still redirects, which fails here.
export async function fetchLoginChallenge(challenge: string, state: string): Promise<string> {
    let response: Response;
    try {
        response = await fetch(authorizeUrl(challenge, state), { headers: { accept: 'application/json' }, redirect: 'manual' });
    } catch {
        throw new ApiError('network', 'Could not reach the gateway.');
    }
    const json = await response.json().catch(() => null) as { login_challenge?: unknown } | null;
    if (!response.ok || typeof json?.login_challenge !== 'string') {
        throw new ApiError('invalid_challenge', messageFor({ error: 'invalid_challenge' }));
    }
    return json.login_challenge;
}

/// Logs in for the pending authorization request in `loginChallenge`; resolves to the URL to send the
/// browser to next (the callback with a code).
export async function submitLogin(loginChallenge: string, username: string, password: string): Promise<string> {
    const body = await post('/oauth/login', 'application/json',
        JSON.stringify({ login_challenge: loginChallenge, username, password }));
    return (body as { redirect_to: string }).redirect_to;
}

/// Redeems the authorization code from the callback; the response starts a session.
export function requestCodeTokens(code: string, verifier: string): Promise<TokenResponse> {
    return requestTokens({
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        code,
        redirect_uri: redirectUri(),
        code_verifier: verifier,
    });
}

/// Continues a session with its refresh token; the response rotates the refresh token.
export function requestRefreshedTokens(refreshToken: string): Promise<TokenResponse> {
    return requestTokens({ grant_type: 'refresh_token', refresh_token: refreshToken });
}

/// The token endpoint takes a form-encoded body, not JSON, so it does not go through the JSON
/// request helpers in `fetchApi.ts`.
async function requestTokens(form: Record<string, string>): Promise<TokenResponse> {
    return await post('/oauth/token', 'application/x-www-form-urlencoded',
        new URLSearchParams(form).toString()) as TokenResponse;
}

async function post(path: string, contentType: string, body: string): Promise<unknown> {
    let response: Response;
    try {
        response = await fetch(ADMIN_BASE + path, { method: 'POST', headers: { 'content-type': contentType }, body });
    } catch {
        throw new ApiError('network', 'Could not reach the gateway.');
    }
    if (response.status === 404) {
        throw new ApiError('404', 'Authentication is not enabled on this gateway.');
    }
    const json = await response.json().catch(() => null);
    if (!response.ok) {
        const error = json as TokenErrorBody | null;
        throw new ApiError(error?.error ?? String(response.status), messageFor(error));
    }
    return json;
}

function messageFor(error: TokenErrorBody | null): string {
    switch (error?.error) {
        case 'invalid_credentials':
            return 'Invalid username or password.';
        case 'invalid_challenge':
            return 'This sign-in took too long. Start again.';
        case 'invalid_grant':
            return 'Your session has expired. Sign in again.';
        default:
            return error?.error_description ?? 'Sign-in failed.';
    }
}

function base64Url(bytes: Uint8Array): string {
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
