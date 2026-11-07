import { describe, expect, it } from 'vitest';
import { OAUTH_CLIENT_TEMPLATES } from './templates';
import { emptyDraft, draftFromTemplate, requestOf, validateDraft, validateId, validateRedirectUri } from './oauthClients';

describe('validateRedirectUri', () => {
    it.each([
        'https://app.example.com/callback',
        'http://localhost:8080/callback',
        'http://127.0.0.1/callback',
        'http://[::1]:9000/cb',
        'http://localhost:*/callback',
        'http://127.0.0.1:*',
    ])('accepts %s', (uri) => {
        expect(validateRedirectUri(uri)).toBeNull();
    });

    it.each([
        ['', 'Enter a redirect URI.'],
        ['app.example.com/callback', 'Enter an absolute URI'],
        ['http://app.example.com/callback', 'Use https'],
        ['ftp://localhost/callback', 'Use https'],
        ['https://app.example.com/cb#frag', 'fragment'],
        ['https://app.example.com:*/cb', '* is only allowed'],
        ['http://localhost:80*/cb', '* is only allowed'],
        ['http://localhost/cb/*', '* is only allowed'],
        ['http://example.com:*/cb', '* is only allowed'],
    ])('rejects %s', (uri, message) => {
        expect(validateRedirectUri(uri)).toContain(message);
    });
});

describe('validateId', () => {
    it('accepts the gateway id shape', () => {
        expect(validateId('claude-code-2')).toBeNull();
    });

    it.each(['', 'Claude', '-claude', 'a b', 'a'.repeat(65), 'kawa-studio', 'kawa-operator'])('rejects "%s"', (id) => {
        expect(validateId(id)).not.toBeNull();
    });
});

describe('validateDraft', () => {
    it('requires at least one redirect URI and ignores blank rows', () => {
        const draft = { ...emptyDraft(), id: 'a', redirectUris: ['', '  '] };

        expect(validateDraft(draft, true).redirectUris).toBe('At least one redirect URI is required.');
    });

    it('points at the bad row', () => {
        const draft = { ...emptyDraft(), id: 'a', redirectUris: ['https://ok.example.com/cb', 'http://bad.example.com'] };

        expect(Object.keys(validateDraft(draft, true))).toEqual(['redirectUris.1']);
    });

    it('skips the id on edit', () => {
        const draft = { ...emptyDraft(), id: '', redirectUris: ['https://ok.example.com/cb'] };

        expect(validateDraft(draft, false)).toEqual({});
    });
});

describe('requestOf', () => {
    it('always sends every field, with an empty name as null', () => {
        const draft = { ...emptyDraft(), id: 'a', name: ' ', redirectUris: [' https://ok.example.com/cb ', ''] };

        expect(requestOf(draft)).toEqual({
            name: null, enabled: true, audience: 'mcp', redirectUris: ['https://ok.example.com/cb'],
        });
    });
});

describe('OAUTH_CLIENT_TEMPLATES', () => {
    it.each(OAUTH_CLIENT_TEMPLATES.map((template) => [template.id, template] as const))('%s is a valid client as is', (_, template) => {
        expect(validateDraft(draftFromTemplate(template), true)).toEqual({});
    });

    it('has unique ids', () => {
        const ids = OAUTH_CLIENT_TEMPLATES.map((template) => template.id);

        expect(new Set(ids).size).toBe(ids.length);
    });
});
