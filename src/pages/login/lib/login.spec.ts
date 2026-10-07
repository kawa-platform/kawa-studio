import { describe, expect, it } from 'vitest';
import { safeRedirect, validateLogin } from './login';

describe('validateLogin', () => {
    it('requires a username and a password', () => {
        expect(validateLogin({ username: ' ', password: '' })).toEqual({
            username: 'Enter your username.',
            password: 'Enter your password.',
        });
    });

    it('accepts a filled-in form', () => {
        expect(validateLogin({ username: 'admin', password: 's3cret' })).toEqual({});
    });
});

describe('safeRedirect', () => {
    it('follows an in-app path', () => {
        expect(safeRedirect('/rbac/roles?tab=all')).toBe('/rbac/roles?tab=all');
    });

    it.each([undefined, '', 'topics', '//evil.example/admin', 'https://evil.example', '/login', '/login?redirect=/x'])(
        'falls back to the topics page for %s',
        (target) => {
            expect(safeRedirect(target)).toBe('/topics');
        },
    );
});
