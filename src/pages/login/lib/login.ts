/// Where the login page goes when there is no (safe) redirect target.
export const DEFAULT_LANDING = '/topics';

/// Field errors for the login form, keyed by field; empty when the form can be submitted.
export function validateLogin(input: { username: string; password: string }): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!input.username.trim()) errors.username = 'Enter your username.';
    if (!input.password) errors.password = 'Enter your password.';
    return errors;
}

/// The in-app path to return to after logging in. Only same-app paths are followed (`/topics`,
/// not `//evil.example` or `https://…`), and never the login page itself.
export function safeRedirect(target: unknown): string {
    if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//')) return DEFAULT_LANDING;
    if (target === '/login' || target.startsWith('/login?')) return DEFAULT_LANDING;
    return target;
}
