import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/error';
import type { OAuthClientConfigView } from '@/api/types';
import OAuthClientsPage from './OAuthClientsPage.vue';

const mocks = vi.hoisted(() => ({
    clients: [] as OAuthClientConfigView[] | undefined,
    error: null as Error | null,
    refetch: vi.fn(),
    upsert: vi.fn(),
    remove: vi.fn(),
    push: vi.fn(),
}));

vi.mock('vue-router', async (original) => ({
    ...await original<typeof import('vue-router')>(),
    useRouter: () => ({ push: mocks.push }),
}));

vi.mock('./queries', async () => {
    const { ref } = await import('vue');
    return {
        useOAuthClients: () => ({
            data: ref(mocks.clients),
            error: ref(mocks.error),
            isPending: ref(false),
            refetch: mocks.refetch,
        }),
        useUpsertOAuthClient: () => ({ mutateAsync: mocks.upsert }),
        useDeleteOAuthClient: () => ({ mutateAsync: mocks.remove }),
    };
});

const client = (id: string, overrides: Partial<OAuthClientConfigView> = {}): OAuthClientConfigView => ({
    id,
    name: null,
    enabled: true,
    redirectUris: ['http://localhost:*/callback'],
    audience: 'mcp',
    ...overrides,
});

const RouterLinkStub = {
    name: 'RouterLink',
    props: { to: { type: [String, Object], default: '' } },
    template: '<a :href="to"><slot /></a>',
};

const ConfirmDialogStub = {
    name: 'ConfirmDialog',
    props: ['open', 'title', 'body', 'confirmLabel', 'danger', 'pending'],
    emits: ['confirm', 'update:open'],
    template: `<div v-if="open" class="confirm-dialog">
        <p class="dialog-body">{{ body }}</p>
        <slot />
        <button class="confirm" @click="$emit('confirm')">{{ confirmLabel }}</button>
    </div>`,
};

function mountPage() {
    return mount(OAuthClientsPage, {
        global: { stubs: { RouterLink: RouterLinkStub, ConfirmDialog: ConfirmDialogStub, ClientIdMetadataSwitch: true } },
    });
}

const rowOf = (wrapper: ReturnType<typeof mountPage>, text: string) =>
    wrapper.findAll('tbody tr').find((row) => row.text().includes(text))!;

describe('OAuthClientsPage', () => {
    beforeEach(() => {
        mocks.clients = [];
        mocks.error = null;
        mocks.refetch.mockReset();
        mocks.upsert.mockReset().mockResolvedValue(undefined);
        mocks.remove.mockReset().mockResolvedValue(undefined);
        mocks.push.mockReset();
    });

    it('lists clients with name or id, audience, first redirect URI and the rest as a count', () => {
        // given
        mocks.clients = [
            client('claude-code', { name: 'Claude Code', redirectUris: ['http://localhost:*/callback', 'https://a.example.com/cb', 'https://b.example.com/cb'] }),
            client('ops-tool', { audience: 'admin', enabled: false }),
        ];

        // when
        const wrapper = mountPage();

        // then
        const claude = rowOf(wrapper, 'claude-code');
        expect(claude.text()).toContain('Claude Code');
        expect(claude.text()).toContain('mcp');
        expect(claude.text()).toContain('http://localhost:*/callback');
        expect(claude.text()).toContain('+2');
        const ops = rowOf(wrapper, 'ops-tool');
        expect(ops.text()).toContain('admin');
        expect(ops.text()).not.toContain('+');
        expect(ops.get('[role="switch"]').attributes('aria-checked')).toBe('false');
    });

    it('keeps pre-registered clients in their own section, apart from client ID metadata documents', () => {
        // given
        mocks.clients = [client('claude-code')];

        // when
        const wrapper = mountPage();

        // then
        const section = wrapper.get('section.registered');
        expect(section.get('h2').text()).toBe('Pre-registered clients');
        expect(section.text()).toContain('without a Client ID Metadata Document');
        expect(section.get('a[target="_blank"]').attributes('href')).toBe('https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/client-registration');
        expect(section.get('a[target="_blank"]').text()).toContain('Pre-registration');
        expect(section.find('table').exists()).toBe(true);
        expect(wrapper.get('h1').text()).toBe('MCP settings');
        expect(wrapper.findComponent({ name: 'ClientIdMetadataSwitch' }).exists()).toBe(true);
    });

    it('copies the client id', async () => {
        // given
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
        mocks.clients = [client('claude-code')];
        const wrapper = mountPage();

        // when
        await wrapper.get('[aria-label="Copy client ID claude-code"]').trigger('click');

        // then
        expect(writeText).toHaveBeenCalledWith('claude-code');
    });

    it('explains what OAuth clients are when there are none, and points at the create button', () => {
        const wrapper = mountPage();

        expect(wrapper.text()).toContain('No OAuth clients yet');
        expect(wrapper.find('table').exists()).toBe(false);
        expect(wrapper.get('.empty').text()).toContain('New client');
        expect(wrapper.get('section.registered .registered-head button.btn-primary').text()).toContain('New client');
    });

    it('explains instead of failing when the gateway does not serve OAuth clients', () => {
        // given
        mocks.clients = undefined;
        mocks.error = new ApiError('404', 'not found');

        // when
        const wrapper = mountPage();

        // then
        expect(wrapper.get('[role="status"]').text()).toContain('OAuth clients are not available');
        expect(wrapper.find('[role="alert"]').exists()).toBe(false);
        expect(wrapper.find('button.btn-primary').exists()).toBe(false);
    });

    it('shows other load failures with a retry', async () => {
        mocks.clients = undefined;
        mocks.error = new ApiError('500', 'config topic unavailable');

        const wrapper = mountPage();
        await wrapper.get('.load-error button').trigger('click');

        expect(wrapper.get('[role="alert"]').text()).toContain('config topic unavailable');
        expect(mocks.refetch).toHaveBeenCalled();
    });

    it('toggles enabled with a full PUT body that keeps the other fields', async () => {
        // given
        mocks.clients = [client('claude-code', { name: 'Claude Code', redirectUris: ['https://a.example.com/cb', 'https://b.example.com/cb'], audience: 'admin' })];
        const wrapper = mountPage();

        // when
        await wrapper.get('[role="switch"]').trigger('click');
        await flushPromises();

        // then
        expect(mocks.upsert).toHaveBeenCalledWith({
            id: 'claude-code',
            body: { name: 'Claude Code', enabled: false, redirectUris: ['https://a.example.com/cb', 'https://b.example.com/cb'], audience: 'admin' },
        });
    });

    it('rolls the toggle back and shows the refusal when the gateway rejects it', async () => {
        // given
        mocks.clients = [client('claude-code')];
        let reject!: (cause: unknown) => void;
        mocks.upsert.mockReturnValue(new Promise((_, fail) => { reject = fail; }));
        const wrapper = mountPage();

        // when
        await wrapper.get('[role="switch"]').trigger('click');
        await flushPromises();

        // then: shown as switched off while the request is in flight
        expect(wrapper.get('[role="switch"]').attributes('aria-checked')).toBe('false');
        reject(new ApiError('400', 'invalid OAuth client body'));
        await flushPromises();
        expect(wrapper.get('[role="switch"]').attributes('aria-checked')).toBe('true');
        expect(wrapper.get('.form-error').text()).toBe('invalid OAuth client body');
    });

    it('deletes a client only after confirmation, saying its tokens stop working', async () => {
        // given
        mocks.clients = [client('claude-code')];
        const wrapper = mountPage();

        // when
        await rowOf(wrapper, 'claude-code').findAll('button').find((b) => b.text() === 'Delete')!.trigger('click');

        // then
        expect(mocks.remove).not.toHaveBeenCalled();
        expect(wrapper.get('.dialog-body').text()).toContain('tokens stop working immediately');
        await wrapper.get('.confirm-dialog .confirm').trigger('click');
        await flushPromises();
        expect(mocks.remove).toHaveBeenCalledWith('claude-code');
        expect(wrapper.find('.confirm-dialog').exists()).toBe(false);
    });

    it('shows a refused delete inside the dialog', async () => {
        mocks.clients = [client('claude-code')];
        mocks.remove.mockRejectedValue(new ApiError('404', 'OAuth client not found'));
        const wrapper = mountPage();

        await rowOf(wrapper, 'claude-code').findAll('button').find((b) => b.text() === 'Delete')!.trigger('click');
        await wrapper.get('.confirm-dialog .confirm').trigger('click');
        await flushPromises();

        expect(wrapper.get('.confirm-dialog [role="alert"]').text()).toBe('OAuth client not found');
    });

    it('opens the create form from the new client button', async () => {
        mocks.clients = [client('claude-code')];
        const wrapper = mountPage();

        await wrapper.get('section.registered .registered-head button.btn-primary').trigger('click');

        expect(mocks.push).toHaveBeenCalledWith('/oauth-clients/new');
    });
});
