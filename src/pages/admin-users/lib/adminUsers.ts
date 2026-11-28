import type { AdminUserView, UpdateAdminUserRequest } from '@/api/types';
import { validateEmail, validatePassword } from '@/lib/adminCredentials';

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
export function changesOf(existing: AdminUserView, draft: AdminUserDraft): UpdateAdminUserRequest {
    const patch: UpdateAdminUserRequest = {};
    const email = draft.email.trim().toLowerCase();
    if (email !== existing.email) patch.email = email;
    const displayName = draft.displayName.trim();
    if (displayName !== (existing.displayName ?? '')) patch.displayName = displayName;
    return patch;
}

/// Whether `user` is the signed-in admin. The session's username is the token's
/// `preferred_username`, which kawa sets to the admin's email.
export function isCurrentUser(user: AdminUserView, sessionUsername: string | null): boolean {
    return !!sessionUsername && user.email === sessionUsername.toLowerCase();
}

export function labelOf(user: AdminUserView): string {
    return user.displayName ? `${user.displayName} (${user.email})` : user.email;
}
