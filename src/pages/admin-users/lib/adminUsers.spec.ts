import { describe, expect, it } from 'vitest';
import type { AdminUserView } from '@/api/types';
import { changesOf, isCurrentUser, validateCreate } from './adminUsers';

const user = (overrides: Partial<AdminUserView> = {}): AdminUserView => ({
    id: '6f1c0e1a-0000-4000-8000-000000000001',
    email: 'ops@example.com',
    displayName: 'Ops',
    enabled: true,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
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

describe('isCurrentUser', () => {
    it('matches the signed-in admin by email, ignoring case', () => {
        expect(isCurrentUser(user(), 'OPS@example.com')).toBe(true);
        expect(isCurrentUser(user(), 'someone@example.com')).toBe(false);
        expect(isCurrentUser(user(), null)).toBe(false);
    });
});
