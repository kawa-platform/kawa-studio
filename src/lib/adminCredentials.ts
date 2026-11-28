import { ApiError } from '@/api/error';

/// Admin-user credential checks and error placement, shared by the admin user pages and the
/// first-run setup on the login page.

/// The gateway's own check: a local part and a domain around a single `@`, no whitespace. The
/// domain needs no dot, so `admin@kawa` is valid.
const EMAIL = /^[^@\s]+@[^@\s]+$/;

export function validateEmail(email: string): string | null {
    const trimmed = email.trim();
    if (!trimmed) return 'Email is required.';
    if (!EMAIL.test(trimmed)) return 'Enter an email address, e.g. ops@example.com.';
    return null;
}

export function validatePassword(password: string, confirmation: string): Record<string, string> {
    if (!password.trim()) return { password: 'Password is required.' };
    if (password !== confirmation) return { confirmPassword: 'Passwords do not match.' };
    return {};
}

/// Maps a failed write onto inline error slots. The admin server answers with a plain
/// `{"error": "…"}` and no field, so the field is read from the message when the envelope has
/// none; anything else (a refusal such as deleting the last admin) goes to `form`.
export function errorsOf(cause: unknown): Record<string, string> {
    if (!(cause instanceof ApiError)) return { form: messageOf(cause) };
    const field = cause.field ?? fieldOf(cause.message);
    return { [field]: cause.message };
}

/// The gateway's own wording for a failed request, which already says why it was refused.
export function messageOf(cause: unknown): string {
    return cause instanceof ApiError ? cause.message : 'Request failed.';
}

function fieldOf(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes('password')) return 'password';
    if (lower.includes('email')) return 'email';
    return 'form';
}
