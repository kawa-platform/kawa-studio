import type { GroupView } from '@/api/types';
import { managedTitle } from '@/lib/managed';

export function validateUsername(username: string): string | null {
    if (!username) return 'Client name is required.';
    if (!/^[a-z0-9][a-z0-9._-]{1,63}$/.test(username)) return 'Lowercase letters, digits, dot, dash and underscore only.';
    return null;
}

export function validatePassword(password: string): string | null {
    if (!password) return 'Password is required.';
    if (password.length < 12) return 'At least 12 characters.';
    return null;
}

/// Client-side checks mirror the server's; the server stays authoritative and its
/// ApiError.field maps straight onto the same inline slots.
export function validateCreateUser(form: { username: string; password: string }): Record<string, string> {
    const errors: Record<string, string> = {};
    const usernameError = validateUsername(form.username);
    if (usernameError) errors.username = usernameError;
    const passwordError = validatePassword(form.password);
    if (passwordError) errors.password = passwordError;
    return errors;
}
/// Group choices for a client's membership. A managed group's membership can only change
/// through its owner, so it is never offered and, when the client is already in it, its chip
/// is locked with the reason.
export function groupChoices(groups: GroupView[]): { suggestions: string[]; locked: Record<string, string> } {
    const suggestions: string[] = [];
    const locked: Record<string, string> = {};
    for (const group of groups) {
        const reason = managedTitle(group.managedBy);
        if (reason) locked[group.name] = reason;
        else suggestions.push(group.name);
    }
    return { suggestions, locked };
}
