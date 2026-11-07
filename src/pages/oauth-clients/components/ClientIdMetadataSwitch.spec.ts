import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/error';
import type { ModuleView } from '@/api/types';
import ClientIdMetadataSwitch from './ClientIdMetadataSwitch.vue';

const mocks = vi.hoisted(() => ({
    modules: undefined as ModuleView[] | undefined,
    update: vi.fn(),
}));

vi.mock('@/pages/modules/queries', async () => {
    const { ref } = await import('vue');
    return {
        useModules: () => ({ data: ref(mocks.modules) }),
        useUpdateModule: () => ({ mutateAsync: mocks.update }),
    };
});

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

const mountSwitch = () => mount(ClientIdMetadataSwitch, {
    global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' }, ConfirmDialog: ConfirmDialogStub } },
});

const modules = (mcp: boolean, cimd: boolean): ModuleView[] => [
    { id: 'mcp', enabled: mcp },
    { id: 'mcp-cimd', enabled: cimd },
];

describe('ClientIdMetadataSwitch', () => {
    beforeEach(() => {
        mocks.modules = modules(true, true);
        mocks.update.mockReset().mockResolvedValue(undefined);
    });

    it('explains what it is, that tokens are mcp-only and that disabling revokes them', () => {
        const text = mountSwitch().text();

        expect(text).toContain('Client ID Metadata Documents');
        expect(text).toContain('CIMD');
        expect(text).toContain('Claude and VS Code');
        expect(text).toContain('only work on the MCP endpoint');
        expect(text).toContain('revokes them');
    });

    it('links to the Client ID Metadata Documents section of the MCP specification', () => {
        const link = mountSwitch().get('a[target="_blank"]');

        expect(link.attributes('href')).toBe('https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/client-registration');
        expect(link.attributes('rel')).toContain('noopener');
    });

    it('is on by default and does not show when the gateway has no such module', () => {
        expect(mountSwitch().get('[role="switch"]').attributes('aria-checked')).toBe('true');

        mocks.modules = [{ id: 'mcp', enabled: true }];
        expect(mountSwitch().find('section').exists()).toBe(false);
    });

    it('asks before switching off, then disables the mcp-cimd module', async () => {
        // given
        const wrapper = mountSwitch();

        // when
        await wrapper.get('[role="switch"]').trigger('click');

        // then
        expect(mocks.update).not.toHaveBeenCalled();
        expect(wrapper.get('.dialog-body').text()).toContain('lose access on their next request');
        await wrapper.get('.confirm').trigger('click');
        await flushPromises();
        expect(mocks.update).toHaveBeenCalledWith({ id: 'mcp-cimd', body: { enabled: false } });
        expect(wrapper.find('.confirm-dialog').exists()).toBe(false);
    });

    it('switches on straight away', async () => {
        mocks.modules = modules(true, false);
        const wrapper = mountSwitch();

        await wrapper.get('[role="switch"]').trigger('click');
        await flushPromises();

        expect(mocks.update).toHaveBeenCalledWith({ id: 'mcp-cimd', body: { enabled: true } });
        expect(wrapper.find('.confirm-dialog').exists()).toBe(false);
    });

    it('shows a refusal from the gateway in the dialog', async () => {
        mocks.update.mockRejectedValue(new ApiError('500', 'config topic unavailable'));
        const wrapper = mountSwitch();

        await wrapper.get('[role="switch"]').trigger('click');
        await wrapper.get('.confirm').trigger('click');
        await flushPromises();

        expect(wrapper.get('.confirm-dialog [role="alert"]').text()).toBe('config topic unavailable');
    });

    it('is disabled and explained while the MCP server module is off', async () => {
        // given
        mocks.modules = modules(false, true);

        // when
        const wrapper = mountSwitch();
        await wrapper.get('[role="switch"]').trigger('click');

        // then
        expect(wrapper.get('[role="switch"]').attributes('disabled')).toBeDefined();
        expect(wrapper.get('[role="note"]').text()).toContain('MCP server module is off');
        expect(wrapper.get('[role="note"] a').attributes('href')).toBe('/modules');
        expect(mocks.update).not.toHaveBeenCalled();
        expect(wrapper.find('.confirm-dialog').exists()).toBe(false);
    });
});
