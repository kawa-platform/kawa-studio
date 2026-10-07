import { describe, expect, it } from 'vitest';
import { router } from './index';

describe('router', () => {
    it('resolves a role name to the read-only role detail page', () => {
        const route = router.resolve('/rbac/roles/reader');

        expect(route.name).toBe('rbac-role-details');
        expect(route.params.name).toBe('reader');
    });

    it('resolves a client name to the read-only client detail page', () => {
        const route = router.resolve('/clients/alice');

        expect(route.name).toBe('client-details');
        expect(route.params.name).toBe('alice');
    });

    it('resolves a group name to the read-only group detail page', () => {
        const route = router.resolve('/rbac/groups/b2c-order/');

        expect(route.name).toBe('rbac-group-details');
        expect(route.params.name).toBe('b2c-order');
    });

    it('resolves the public login page outside the app shell', () => {
        const route = router.resolve('/login?redirect=/rbac/roles');

        expect(route.name).toBe('login');
        expect(route.meta.public).toBe(true);
        expect(route.meta.bare).toBe(true);
    });

    it('resolves the public OAuth callback outside the app shell', () => {
        const route = router.resolve('/auth/callback?code=abc&state=xyz');

        expect(route.name).toBe('auth-callback');
        expect(route.meta.public).toBe(true);
        expect(route.meta.bare).toBe(true);
    });

    it('lets the login page through the feature-flag guard', async () => {
        await router.push('/login');

        expect(router.currentRoute.value.name).toBe('login');
    });

    it('resolves the topics destination used after editing', () => {
        expect(router.resolve({ name: 'topics' }).fullPath).toBe('/topics');
    });
});
