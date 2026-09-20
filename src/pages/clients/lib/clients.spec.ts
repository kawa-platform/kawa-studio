import { describe, expect, it } from 'vitest';
import { validateCreateUser, validatePassword, validateUsername } from './clients';

describe('validateUsername', () => {
    it('requires a value', () => {
        expect(validateUsername('')).toBe('Client name is required.');
    });

    it('rejects characters outside lowercase letters, digits, dot, dash and underscore', () => {
        expect(validateUsername('Svc_Orders')).toBe('Lowercase letters, digits, dot, dash and underscore only.');
    });

    it('rejects a name longer than 64 characters', () => {
        expect(validateUsername('a'.repeat(65))).toBe('Lowercase letters, digits, dot, dash and underscore only.');
    });

    it('accepts a valid lowercase name', () => {
        expect(validateUsername('svc-orders.eu_v2')).toBeNull();
    });
});

describe('validatePassword', () => {
    it('requires a value', () => {
        expect(validatePassword('')).toBe('Password is required.');
    });

    it('rejects a password shorter than 12 characters', () => {
        expect(validatePassword('short1234')).toBe('At least 12 characters.');
    });

    it('accepts a password of at least 12 characters', () => {
        expect(validatePassword('correct horse battery')).toBeNull();
    });
});

describe('validateCreateUser', () => {
    it('collects both field errors', () => {
        expect(validateCreateUser({ username: '', password: 'x'.repeat(6) })).toEqual({
            username: 'Client name is required.',
            password: 'At least 12 characters.',
        });
    });

    it('returns no errors for a valid request', () => {
        expect(validateCreateUser({ username: 'svc-invoices', password: 'correct horse battery' })).toEqual({});
    });
});