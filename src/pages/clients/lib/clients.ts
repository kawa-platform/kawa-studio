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