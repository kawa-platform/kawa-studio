import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { ApiError } from '@/api/error';
import { authorizeUrl, createPkce, fetchLoginChallenge, randomToken, requestCodeTokens, requestRefreshedTokens } from '@/api/oauth';
import type { TokenResponse } from '@/api/types';

/// The admin session when the gateway runs with `admin.auth.type: oauth`. Without a session the
/// UI sends no `Authorization` header, which is all an open gateway (`type: none`) needs.
interface Session {
    accessToken: string;
    refreshToken: string;
    /// Epoch millis at which the access token expires.
    accessExpiresAt: number;
    /// The signed-in admin, decoded from the token for display only — never trusted.
    username: string;
}

const STORAGE_KEY = 'kawa.auth';

/// The login started in this tab and not yet completed: the PKCE verifier, the `state` that the
/// callback must echo, and where to return afterwards. Kept per tab (sessionStorage).
interface PendingLogin {
    verifier: string;
    state: string;
    returnTo: string;
}

const PENDING_KEY = 'kawa.auth.pending';

/// Refresh this long before the access token expires, so requests never race its expiry.
const REFRESH_MARGIN_MS = 30_000;

export const useAuthStore = defineStore('auth', () => {
    const session = ref<Session | null>(readSession());
    /// Bumped whenever the gateway demands a login (a 401 that no refresh could fix); the app
    /// shell watches it and routes to the login page.
    const loginRequests = ref(0);
    let refreshing: Promise<boolean> | null = null;

    watch(session, writeSession, { deep: true });

    const isAuthenticated = computed(() => session.value !== null);
    const accessToken = computed(() => session.value?.accessToken ?? null);
    const username = computed(() => session.value?.username ?? null);

    /// Starts a login: sends the browser to the authorization server, which shows the login page and
    /// comes back to the callback. `returnTo` is the in-app path to open once logged in.
    async function beginLogin(returnTo: string): Promise<void> {
        const pkce = await createPkce();
        const state = randomToken();
        writePending({ verifier: pkce.verifier, state, returnTo });
        window.location.assign(authorizeUrl(pkce.challenge, state));
    }

    /// Renews the login in place, for a login page whose challenge expired: a new PKCE pair and
    /// `state`, and a fresh login challenge for them, fetched without leaving the page.
    async function renewLogin(returnTo: string): Promise<string> {
        const pkce = await createPkce();
        const state = randomToken();
        const challenge = await fetchLoginChallenge(pkce.challenge, state);
        writePending({ verifier: pkce.verifier, state, returnTo });
        return challenge;
    }

    /// Finishes the login on the callback: checks `state` and redeems the code. Resolves to the
    /// `returnTo` the login was started with (unchecked: the caller decides whether to follow it).
    async function completeLogin(code: string, state: string): Promise<string> {
        const pending = readPending();
        clearPending();
        if (!pending || pending.state !== state) {
            throw new ApiError('invalid_state', 'This sign-in was not started here. Start again.');
        }
        session.value = toSession(await requestCodeTokens(code, pending.verifier));
        return pending.returnTo;
    }

    /// Where the pending login, if any, should return to.
    function pendingReturnTo(): string | null {
        return readPending()?.returnTo ?? null;
    }

    /// Exchanges the refresh token for new tokens. Concurrent callers share one request. Resolves
    /// `false` (and drops the session) when the session cannot be continued.
    function refresh(): Promise<boolean> {
        const current = session.value;
        if (!current) return Promise.resolve(false);
        refreshing ??= requestRefreshedTokens(current.refreshToken)
            .then((tokens) => {
                session.value = toSession(tokens);
                return true;
            })
            .catch(() => {
                session.value = null;
                return false;
            })
            .finally(() => {
                refreshing = null;
            });
        return refreshing;
    }

    /// Whether the access token is about to expire and should be refreshed before use.
    function expiresSoon(now = Date.now()): boolean {
        return session.value !== null && session.value.accessExpiresAt - now < REFRESH_MARGIN_MS;
    }

    function logout(): void {
        session.value = null;
    }

    /// The gateway rejected the request and no refresh helped: drop the session and ask for a login.
    function requireLogin(): void {
        session.value = null;
        loginRequests.value++;
    }

    return {
        isAuthenticated, accessToken, username, loginRequests,
        beginLogin, renewLogin, completeLogin, pendingReturnTo, refresh, expiresSoon, logout, requireLogin,
    };
});

function toSession(tokens: TokenResponse, now = Date.now()): Session {
    return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        accessExpiresAt: now + tokens.expires_in * 1000,
        username: usernameOf(tokens.access_token) ?? 'admin',
    };
}

/// The signed-in admin's name from a JWT, read without verification (display only): the
/// `preferred_username` claim (their email), or `sub` for a token without one. kawa identifies
/// stored admin users by an id in `sub`, which is not meant to be shown.
function usernameOf(jwt: string): string | null {
    try {
        const payload = jwt.split('.')[1] ?? '';
        const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
        const claims = JSON.parse(json) as { sub?: unknown; preferred_username?: unknown };
        if (typeof claims.preferred_username === 'string') return claims.preferred_username;
        return typeof claims.sub === 'string' ? claims.sub : null;
    } catch {
        return null;
    }
}

function readSession(): Session | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<Session>;
        if (typeof parsed.accessToken !== 'string' || typeof parsed.refreshToken !== 'string'
            || typeof parsed.accessExpiresAt !== 'number' || typeof parsed.username !== 'string') {
            return null;
        }
        return parsed as Session;
    } catch {
        return null;
    }
}

function writeSession(session: Session | null): void {
    try {
        if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        else localStorage.removeItem(STORAGE_KEY);
    } catch {
        // storage unavailable (private mode, quota): the session just won't survive a reload
    }
}

function readPending(): PendingLogin | null {
    try {
        const raw = sessionStorage.getItem(PENDING_KEY);
        return raw ? JSON.parse(raw) as PendingLogin : null;
    } catch {
        return null;
    }
}

function writePending(pending: PendingLogin): void {
    try {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    } catch {
        // storage unavailable: the callback will ask to start again
    }
}

function clearPending(): void {
    try {
        sessionStorage.removeItem(PENDING_KEY);
    } catch {
        // nothing to clear
    }
}
