import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/error';
import type { OAuthClientConfigView } from '@/api/types';
import OAuthClientEditorPage from './OAuthClientEditorPage.vue';

const mocks = vi.hoisted(() => ({
    params: {} as Record<string, string>,
    clients: { value: [] as OAuthClientConfigView[] },
    upsert: vi.fn(),
    push: vi.fn(),
}));

vi.mock('./queries', () => ({
    useOAuthClients: () => ({ data: mocks.clients, error: { value: null }, isPending: { value: false } }),
    useUpsertOAuthClient: () => ({ mutateAsync: mocks.upsert }),
}));

vi.mock('vue-router', () => ({
    useRoute: () => ({ params: mocks.params }),
    useRouter: () => ({ push: mocks.push }),
}));

const claude: OAuthClientConfigView = {
    id: 'claude-code',
    name: 'Claude Code',
    enabled: true,
    redirectUris: ['http://localhost:*/callback'],
    audience: 'mcp',
};

function mountPage() {
    return mount(OAuthClientEditorPage, { global: { stubs: { RouterLink: true } } });
}

const save = (wrapper: ReturnType<typeof mountPage>) => wrapper.get('button.btn-primary').trigger('click');

describe('OAuthClientEditorPage', () => {
    beforeEach(() => {
        mocks.params = {};
        mocks.clients.value = [claude];
        mocks.upsert.mockReset().mockResolvedValue(claude);
        mocks.push.mockReset();
    });

    it('creates a client with every field and returns to the list', async () => {
        // given
        const wrapper = mountPage();
        await wrapper.get('#client-id').setValue('cursor');
        await wrapper.get('[aria-label="Redirect URI 1"]').setValue('https://cursor.example.com/callback');

        // when
        await save(wrapper);
        await flushPromises();

        // then
        expect(mocks.upsert).toHaveBeenCalledWith({
            id: 'cursor',
            body: { name: null, enabled: true, redirectUris: ['https://cursor.example.com/callback'], audience: 'mcp' },
        });
        expect(mocks.push).toHaveBeenCalledWith('/oauth-clients');
    });

    it('does not send a client with an invalid redirect URI', async () => {
        // given
        const wrapper = mountPage();
        await wrapper.get('#client-id').setValue('cursor');
        await wrapper.get('[aria-label="Redirect URI 1"]').setValue('http://cursor.example.com/callback');

        // when
        await save(wrapper);

        // then
        expect(mocks.upsert).not.toHaveBeenCalled();
        expect(wrapper.text()).toContain('Use https, or http on localhost');
    });

    it('requires an id and a redirect URI', async () => {
        const wrapper = mountPage();

        await save(wrapper);

        expect(mocks.upsert).not.toHaveBeenCalled();
        expect(wrapper.text()).toContain('Client ID is required.');
        expect(wrapper.text()).toContain('At least one redirect URI is required.');
    });

    it('blocks the reserved kawa-studio id before sending', async () => {
        const wrapper = mountPage();
        await wrapper.get('#client-id').setValue('kawa-studio');
        await wrapper.get('[aria-label="Redirect URI 1"]').setValue('https://a.example.com/cb');

        await save(wrapper);

        expect(mocks.upsert).not.toHaveBeenCalled();
        expect(wrapper.text()).toContain('reserved');
    });

    it('shows the gateway 409 next to the form', async () => {
        // given
        mocks.upsert.mockRejectedValue(new ApiError('409', "OAuth client id 'kawa-studio' is reserved"));
        const wrapper = mountPage();
        await wrapper.get('#client-id').setValue('cursor');
        await wrapper.get('[aria-label="Redirect URI 1"]').setValue('https://a.example.com/cb');

        // when
        await save(wrapper);
        await flushPromises();

        // then
        expect(wrapper.get('[role="alert"]').text()).toBe("OAuth client id 'kawa-studio' is reserved");
        expect(mocks.push).not.toHaveBeenCalled();
    });

    it('has no audience section, and keeps the existing audience when saving', async () => {
        // given
        mocks.clients.value = [{ ...claude, audience: 'admin' }];
        mocks.params = { id: 'claude-code' };
        const wrapper = mountPage();

        // then
        expect(wrapper.text()).not.toContain('Audience');
        expect(wrapper.find('input[name="audience"]').exists()).toBe(false);

        // when
        await save(wrapper);
        await flushPromises();

        // then
        expect(mocks.upsert).toHaveBeenCalledWith({ id: 'claude-code', body: expect.objectContaining({ audience: 'admin' }) });
    });

    it('edits an existing client with the id read-only and sends the id from the path', async () => {
        // given
        mocks.params = { id: 'claude-code' };
        const wrapper = mountPage();
        const id = wrapper.get('#client-id');
        expect(id.attributes('readonly')).toBeDefined();
        expect((id.element as HTMLInputElement).value).toBe('claude-code');

        // when
        await id.setValue('hijacked');
        await wrapper.get('#client-name').setValue('Claude');
        await save(wrapper);
        await flushPromises();

        // then
        expect(mocks.upsert).toHaveBeenCalledWith({
            id: 'claude-code',
            body: { name: 'Claude', enabled: true, redirectUris: ['http://localhost:*/callback'], audience: 'mcp' },
        });
        expect(mocks.push).toHaveBeenCalledWith('/oauth-clients');
    });

    it('warns that tokens stop working when disabling a client', async () => {
        // given
        mocks.params = { id: 'claude-code' };
        const wrapper = mountPage();
        expect(wrapper.text()).not.toContain('stops its existing tokens');

        // when
        await wrapper.get('#client-enabled').trigger('click');

        // then
        expect(wrapper.get('[role="note"]').text()).toContain('Disabling this client stops its existing tokens');
    });

    it('prefills the form from a template, keeps every field editable and sends nothing until save', async () => {
        // given
        const wrapper = mountPage();

        // when
        await wrapper.get('[data-template="claude"]').trigger('click');

        // then
        expect((wrapper.get('#client-id').element as HTMLInputElement).value).toBe('claude');
        expect((wrapper.get('#client-name').element as HTMLInputElement).value).toBe('Claude');
        expect((wrapper.get('[aria-label="Redirect URI 1"]').element as HTMLInputElement).value).toBe('https://claude.ai/api/mcp/auth_callback');
        expect((wrapper.get('[aria-label="Redirect URI 2"]').element as HTMLInputElement).value).toBe('https://claude.com/api/mcp/auth_callback');
        expect(mocks.upsert).not.toHaveBeenCalled();

        // and the admin can still change it before saving
        await wrapper.get('#client-id').setValue('claude-team');
        await wrapper.get('[aria-label="Redirect URI 2"]').setValue('https://claude.com/other');
        await save(wrapper);
        await flushPromises();
        expect(mocks.upsert).toHaveBeenCalledWith({
            id: 'claude-team',
            body: {
                name: 'Claude', enabled: true, audience: 'mcp',
                redirectUris: ['https://claude.ai/api/mcp/auth_callback', 'https://claude.com/other'],
            },
        });
    });

    it('flags a template whose id already exists and does not apply it', async () => {
        // given: claude-code is already registered
        const wrapper = mountPage();
        const taken = wrapper.get('[data-template="claude-code"]');

        // then
        expect(taken.attributes('disabled')).toBeDefined();
        expect(taken.text()).toContain('already exists');
        expect(wrapper.get('[data-template="vscode"]').attributes('disabled')).toBeUndefined();
        await taken.trigger('click');
        expect((wrapper.get('#client-id').element as HTMLInputElement).value).toBe('');
    });

    it('offers no templates when editing', () => {
        mocks.params = { id: 'claude-code' };

        expect(mountPage().find('.templates').exists()).toBe(false);
    });
});
