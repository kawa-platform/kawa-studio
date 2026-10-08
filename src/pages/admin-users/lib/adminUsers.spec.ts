import { describe, expect, it } from 'vitest';
import { ApiError } from '@/api/error';
import type { AdminUser } from '@/api/types';
import { changesOf, errorsOf, isCurrentUser, validateCreate, validateEmail } from './adminUsers';

const user = (overrides: Partial<AdminUser> = {}): AdminUser => ({
    id: '6f1c0e1a-0000-4000-8000-000000000001',
    email: 'ops@example.com',
    displayName: 'Ops',
    enabled: true,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
});

describe('validateEmail', () => {
    it.each(['ops@example.com', 'admin@kawa', '  Ops@Example.com  '])('accepts %s like the gateway does', (email) => {
        expect(validateEmail(email)).toBeNull();
    });

    it.each(['', 'ops', 'ops@', 'a b@example.com', 'a@b@c'])('rejects %j', (email) => {
        expect(validateEmail(email)).not.toBeNull();
    });
});

describe('validateCreate', () => {
    it('requires a password and its confirmation to match', () => {
        expect(validateCreate({ email: 'ops@example.com', displayName: '', password: '', confirmPassword: '' }))
            .toEqual({ password: 'Password is required.' });
        expect(validateCreate({ email: 'ops@example.com', displayName: '', password: 'secret', confirmPassword: 'other' }))
            .toEqual({ confirmPassword: 'Passwords do not match.' });
    });

    it('passes a complete form', () => {
        expect(validateCreate({ email: 'ops@example.com', displayName: '', password: 'secret', confirmPassword: 'secret' }))
            .toEqual({});
    });
});

describe('changesOf', () => {
    it('sends nothing when nothing changed, so a save never touches the password', () => {
        expect(changesOf(user(), { email: 'ops@example.com', displayName: 'Ops' })).toEqual({});
    });

    it('sends only the changed fields, with the email in lower case', () => {
        expect(changesOf(user(), { email: 'New@Example.com', displayName: 'Ops' })).toEqual({ email: 'new@example.com' });
    });

    it('clears the display name with an empty string', () => {
        expect(changesOf(user(), { email: 'ops@example.com', displayName: '  ' })).toEqual({ displayName: '' });
    });

    it('treats a missing display name as empty', () => {
        expect(changesOf(user({ displayName: null }), { email: 'ops@example.com', displayName: '' })).toEqual({});
    });
});

describe('errorsOf', () => {
    it('uses the field the envelope names', () => {
        expect(errorsOf(new ApiError('400', 'bad', 'displayName'))).toEqual({ displayName: 'bad' });
    });

    it('places an email conflict on the email field', () => {
        expect(errorsOf(new ApiError('409', "admin user email 'ops@example.com' is already in use")))
            .toEqual({ email: "admin user email 'ops@example.com' is already in use" });
    });

    it('keeps a refusal that names no field on the form, in the gateway\'s words', () => {
        expect(errorsOf(new ApiError('409', 'cannot delete the last enabled admin user')))
            .toEqual({ form: 'cannot delete the last enabled admin user' });
    });

    it('falls back to a generic message for anything that is not an ApiError', () => {
        expect(errorsOf(new TypeError('Failed to fetch'))).toEqual({ form: 'Request failed.' });
    });
});

describe('isCurrentUser', () => {
    it('matches the signed-in admin by email, ignoring case', () => {
        expect(isCurrentUser(user(), 'OPS@example.com')).toBe(true);
        expect(isCurrentUser(user(), 'someone@example.com')).toBe(false);
        expect(isCurrentUser(user(), null)).toBe(false);
    });
});
