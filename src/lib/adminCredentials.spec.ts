import { describe, expect, it } from 'vitest';
import { ApiError } from '@/api/error';
import { errorsOf, validateEmail } from './adminCredentials';

describe('validateEmail', () => {
    it.each(['ops@example.com', 'admin@kawa', '  Ops@Example.com  '])('accepts %s like the gateway does', (email) => {
        expect(validateEmail(email)).toBeNull();
    });

    it.each(['', 'ops', 'ops@', 'a b@example.com', 'a@b@c'])('rejects %j', (email) => {
        expect(validateEmail(email)).not.toBeNull();
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
