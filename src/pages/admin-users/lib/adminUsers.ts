import { ApiError } from '@/api/error';
import type { AdminUser, UpdateAdminUserRequest } from '@/api/types';

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

export interface AdminUserDraft {
    email: string;
    displayName: string;
}

/// Client-side checks mirror the gateway's; the gateway stays authoritative and its refusals land
/// in the same inline slots through [errorsOf].
export function validateCreate(form: AdminUserDraft & { password: string; confirmPassword: string }): Record<string, string> {
    const errors: Record<string, string> = {};
    const emailError = validateEmail(form.email);
    if (emailError) errors.email = emailError;
    return { ...errors, ...validatePassword(form.password, form.confirmPassword) };
}

/// The PATCH body for an edit: only the fields that changed, so saving never touches the
/// password or the enabled state. An emptied display name is sent as `""`, which clears it.
export function changesOf(existing: AdminUser, draft: AdminUserDraft): UpdateAdminUserRequest {
    const patch: UpdateAdminUserRequest = {};
    const email = draft.email.trim().toLowerCase();
    if (email !== existing.email) patch.email = email;
    const displayName = draft.displayName.trim();
    if (displayName !== (existing.displayName ?? '')) patch.displayName = displayName;
    return patch;
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

/// Whether `user` is the signed-in admin. The session's username is the token's
/// `preferred_username`, which kawa sets to the admin's email.
export function isCurrentUser(user: AdminUser, sessionUsername: string | null): boolean {
    return !!sessionUsername && user.email === sessionUsername.toLowerCase();
}

export function labelOf(user: AdminUser): string {
    return user.displayName ? `${user.displayName} (${user.email})` : user.email;
}
