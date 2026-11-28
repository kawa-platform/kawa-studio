import { ApiError } from './error';
import { ADMIN_BASE } from './oauth';
import type { AdminUserView, SetupRequest, SetupStatusView } from './types';

/// First-run setup: the public `/admin/setup` routes of the admin server. Sent directly, not through
/// `fetchApi`, which would treat the 401 for a wrong setup token as an expired session.

/// Whether the gateway still waits for its first admin user. A gateway without setup support needs
/// none: it answers 404, or 401 where its auth guards every unknown admin route. No answer at all
/// fails with a `network` [ApiError].
export async function fetchSetupRequired(): Promise<boolean> {
    let response: Response;
    try {
        response = await fetch(ADMIN_BASE + '/admin/setup');
    } catch {
        throw new ApiError('network', 'Could not reach the gateway.');
    }
    if (response.status === 404 || response.status === 401) return false;
    const body = await response.json().catch(() => null) as SetupStatusView | null;
    if (!response.ok || typeof body?.required !== 'boolean') {
        throw new ApiError(String(response.status), 'Could not check whether the gateway needs setup.');
    }
    return body.required;
}

/// Creates the first admin user with the setup token. Fails with an [ApiError] whose code is the
/// status: `401` (wrong token, placed on the `token` field), `409` (an admin user exists already),
/// `400` (the gateway's validation message), or `network`.
export async function submitSetup(request: SetupRequest): Promise<AdminUserView> {
    let response: Response;
    try {
        response = await fetch(ADMIN_BASE + '/admin/setup', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(request),
        });
    } catch {
        throw new ApiError('network', 'Could not reach the gateway.');
    }
    const body = await response.json().catch(() => null);
    if (response.ok) return body as AdminUserView;
    if (response.status === 401) throw new ApiError('401', 'That setup token is not valid.', 'token');
    if (response.status === 409) throw new ApiError('409', 'An admin user already exists. Sign in with that account.');
    throw new ApiError(String(response.status), messageOf(body) ?? 'Setup failed with ' + response.status + '.');
}

/// The message of the admin server's `{"error": "…"}`, or of the `{"error": {"message": …}}` envelope.
function messageOf(body: unknown): string | null {
    const error = (body as { error?: unknown } | null)?.error;
    if (typeof error === 'string' && error) return error;
    const message = (error as { message?: unknown } | null | undefined)?.message;
    return typeof message === 'string' && message ? message : null;
}
