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

describe('ModulesPage', () => {
    beforeEach(() => {
        mocks.modules = [
            { id: 'governance', enabled: true },
            { id: 'rbac', enabled: true },
        ];
        mocks.updateModule.mockReset().mockResolvedValue({ id: 'governance', enabled: false });
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
});
