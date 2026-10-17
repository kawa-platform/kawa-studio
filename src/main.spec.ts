import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('app bootstrap', () => {
    let pending: Map<string, string>;

    beforeEach(() => {
        vi.resetModules();
        document.body.innerHTML = '<div id="app"></div>';
        pending = new Map();
        vi.stubGlobal('localStorage', memoryStorage(new Map()));
        vi.stubGlobal('sessionStorage', memoryStorage(pending));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        document.body.innerHTML = '';
    });

    /// Answers every request with `status`: 401 for a gateway that requires a login, 200 for an open one.
    /// Returns the URLs requested so far.
    function gateway(status: number) {
        const fetch = vi.fn(async (_url: RequestInfo | URL) => new Response('[]', { status }));
        vi.stubGlobal('fetch', fetch);
        return () => fetch.mock.calls.map(([url]) => String(url));
    }

    async function open(path: string): Promise<void> {
        window.history.replaceState(null, '', path);
        await import('./main');
    }

    it('opens the login page without the app shell and without restarting the login', async () => {
        // given
        const requests = gateway(401);

        // when
        await open('/admin/login?login_challenge=the-challenge');
        await vi.waitFor(() => expect(document.querySelector('form')).not.toBeNull());

        // then
        expect(requests(), 'The login page called the API (the app shell rendered before the route resolved)').toEqual([]);
        // beginLogin records the login it starts before leaving the page.
        expect(pending.get('kawa.auth.pending'), 'The login page restarted the login').toBeUndefined();
    });

    it('sends a signed-out admin straight to the login without rendering the app', async () => {
        // given
        const requests = gateway(401);

        // when
        await open('/admin/topics');
        await vi.waitFor(() => expect(pending.get('kawa.auth.pending'), 'No login was started').toBeDefined());

        // then
        expect(JSON.parse(pending.get('kawa.auth.pending')!).returnTo).toBe('/topics');
        expect(requests(), 'Something besides the one login probe was requested before the login')
            .toEqual(['http://localhost:8080/modules']);
        expect(document.querySelector('#app')!.innerHTML, 'The app rendered before the login').toBe('');
    });

    it('opens the app directly on a gateway that requires no login', async () => {
        // given
        gateway(200);

        // when
        await open('/admin/topics');

        // then
        await vi.waitFor(() => expect(document.querySelector('.shell'), 'The app shell did not render').not.toBeNull());
        expect(pending.get('kawa.auth.pending'), 'An open gateway started a login').toBeUndefined();
    });
});

function memoryStorage(items: Map<string, string>) {
    return {
        getItem: (key: string) => items.get(key) ?? null,
        setItem: (key: string, value: string) => void items.set(key, value),
        removeItem: (key: string) => void items.delete(key),
    };
}
