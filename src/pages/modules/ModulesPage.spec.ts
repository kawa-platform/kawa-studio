import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/error';
import type { ModuleView } from '@/api/types';
import ModulesPage from './ModulesPage.vue';

const mocks = vi.hoisted(() => ({
    modules: [] as ModuleView[],
    updateModule: vi.fn(),
}));

vi.mock('./queries', async () => {
    const { ref } = await import('vue');
    return {
        useModules: () => ({ data: ref(mocks.modules) }),
        useUpdateModule: () => ({ mutateAsync: mocks.updateModule }),
    };
});

/// Renders the dialog inline while open, with its slot and a confirm button.
const ConfirmDialogStub = {
    name: 'ConfirmDialog',
    props: ['open', 'title', 'body', 'confirmLabel', 'danger', 'pending'],
    emits: ['confirm', 'update:open'],
    template: `<div v-if="open" class="confirm-dialog">
        <slot />
        <button class="confirm" @click="$emit('confirm')">{{ confirmLabel }}</button>
    </div>`,
};

function mountPage() {
    return mount(ModulesPage, {
        global: { stubs: { ConfirmDialog: ConfirmDialogStub, AppToast: true, RouterLink: true } },
    });
}

const switchOf = (wrapper: ReturnType<typeof mountPage>, name: string) =>
    wrapper.get(`[aria-label$="${name}"]`);

const cardOf = (wrapper: ReturnType<typeof mountPage>, id: string) =>
    wrapper.findAll('article.module').find((card) => card.find('.module-id').text() === id)!;

const PUBLIC_URL_MISSING = 'set admin.publicUrl, the URL agents connect to';

describe('ModulesPage', () => {
    beforeEach(() => {
        mocks.modules = [
            { id: 'governance', enabled: true, available: true },
            { id: 'rbac', enabled: true, available: true },
            { id: 'mcp', enabled: false, available: true },
        ];
        mocks.updateModule.mockReset().mockResolvedValue({ id: 'governance', enabled: false, available: true });
    });

    it('disables a module with PUT /modules/{id} once confirmed', async () => {
        // given
        const wrapper = mountPage();
        await switchOf(wrapper, 'Governance').trigger('click');

        // when
        await wrapper.get('.confirm-dialog .confirm').trigger('click');
        await flushPromises();

        // then
        expect(mocks.updateModule).toHaveBeenCalledWith({ id: 'governance', body: { enabled: false } });
        expect(wrapper.find('.confirm-dialog').exists()).toBe(false);
    });

    it('keeps the dialog open with the gateway refusal when the switch fails', async () => {
        // given
        mocks.updateModule.mockRejectedValue(new ApiError('500', 'config write failed'));
        const wrapper = mountPage();
        await switchOf(wrapper, 'Governance').trigger('click');

        // when
        await wrapper.get('.confirm-dialog .confirm').trigger('click');
        await flushPromises();

        // then
        expect(wrapper.get('.confirm-dialog [role="alert"]').text()).toBe('config write failed');
    });

    it('does not send an access control switch until its identifier is typed', async () => {
        // given
        const wrapper = mountPage();
        await switchOf(wrapper, 'Access control').trigger('click');

        // when
        await wrapper.get('.confirm-dialog .confirm').trigger('click');

        // then
        expect(mocks.updateModule).not.toHaveBeenCalled();
        expect(wrapper.text()).toContain('Type rbac to confirm.');

        // and once typed
        await wrapper.get('#confirm-module').setValue('rbac');
        await wrapper.get('.confirm-dialog .confirm').trigger('click');
        await flushPromises();
        expect(mocks.updateModule).toHaveBeenCalledWith({ id: 'rbac', body: { enabled: false } });
    });

    describe('MCP card', () => {
        it('explains MCP and links the OAuth clients page and the MCP documentation', () => {
            // when
            const card = cardOf(mountPage(), 'mcp');

            // then
            expect(card.text()).toContain('Lets AI agents such as Claude Code inspect kawa. Read-only');
            expect(card.find('[aria-label="Enable MCP server"]').exists()).toBe(true);
            expect(card.find('router-link-stub[to="/oauth-clients"]').exists()).toBe(true);
            expect(card.get('a[href="https://kawa-platform.github.io/kawa-docs/docs/modules/mcp"]').attributes('target')).toBe('_blank');
        });

        it('shows MCP off on a fresh install while the other modules stay on', () => {
            // when
            const wrapper = mountPage();

            // then
            expect(switchOf(wrapper, 'MCP server').attributes('data-state')).toBe('unchecked');
            expect(switchOf(wrapper, 'Governance').attributes('data-state')).toBe('checked');
            expect(switchOf(wrapper, 'Access control').attributes('data-state')).toBe('checked');
        });

        it('shows the connect URL the gateway reports only while MCP is on', () => {
            // given
            const wrapper = mountPage();
            expect(cardOf(wrapper, 'mcp').text()).not.toContain('Connect URL');

            // when
            mocks.modules = [{ id: 'mcp', enabled: true, available: true, connectUrl: 'https://kawa.example.com/mcp' }];
            const on = mountPage();

            // then
            expect(cardOf(on, 'mcp').get('.connect-url').text()).toBe('https://kawa.example.com/mcp');
        });

        it('switches MCP on and off through the confirmation dialog', async () => {
            // given
            mocks.updateModule.mockResolvedValue({ id: 'mcp', enabled: true, available: true, connectUrl: 'https://kawa.example.com/mcp' });
            const wrapper = mountPage();

            // when
            await switchOf(wrapper, 'MCP server').trigger('click');
            await wrapper.get('.confirm-dialog .confirm').trigger('click');
            await flushPromises();

            // then
            expect(mocks.updateModule).toHaveBeenCalledWith({ id: 'mcp', body: { enabled: true } });
            expect(wrapper.find('.confirm-dialog').exists()).toBe(false);
        });

        it('shows the gateway refusal in the dialog and keeps MCP off when admin.publicUrl is not set', async () => {
            // given
            const refusal = `module 'mcp': ${PUBLIC_URL_MISSING}, before switching it on`;
            mocks.updateModule.mockRejectedValue(new ApiError('409', refusal));
            const wrapper = mountPage();
            await switchOf(wrapper, 'MCP server').trigger('click');

            // when
            await wrapper.get('.confirm-dialog .confirm').trigger('click');
            await flushPromises();

            // then
            expect(wrapper.get('.confirm-dialog [role="alert"]').text()).toBe(refusal);
            expect(switchOf(wrapper, 'MCP server').attributes('data-state')).toBe('unchecked');
        });

        it('marks MCP unavailable with the reason, without a connect URL, and still lets it be switched off', async () => {
            // given
            mocks.modules = [{ id: 'mcp', enabled: true, available: false, unavailableReason: PUBLIC_URL_MISSING }];
            const wrapper = mountPage();
            const card = cardOf(wrapper, 'mcp');

            // then
            expect(card.get('.module-unavailable').text()).toBe('Unavailable');
            expect(card.get('[role="note"]').text()).toBe(`Unavailable: ${PUBLIC_URL_MISSING}`);
            expect(card.find('.connect-url').exists()).toBe(false);

            // and when switched off
            await switchOf(wrapper, 'MCP server').trigger('click');
            await wrapper.get('.confirm-dialog .confirm').trigger('click');
            await flushPromises();
            expect(mocks.updateModule).toHaveBeenCalledWith({ id: 'mcp', body: { enabled: false } });
        });
    });
});
