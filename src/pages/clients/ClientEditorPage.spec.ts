import {mount} from '@vue/test-utils';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {ref} from 'vue';
import ClientEditorPage from './ClientEditorPage.vue';

const mocks = vi.hoisted(() => ({
    clients: vi.fn(),
    groups: vi.fn(),
    patchClient: vi.fn(),
    push: vi.fn(),
}));

vi.mock('@/api/api', () => ({}));

vi.mock('./queries', () => ({
    useClients: mocks.clients,
    usePatchClient: () => ({mutateAsync: mocks.patchClient, isPending: {value: false}}),
}));

vi.mock('../rbac/queries', () => ({
    useRbacGroups: mocks.groups,
}));

vi.mock('vue-router', () => ({
    useRoute: () => ({params: {name: 'alice'}}),
    useRouter: () => ({push: mocks.push}),
}));

function mountPage() {
    return mount(ClientEditorPage, {
        global: {
            stubs: {RouterLink: true, AppToast: true},
        },
    });
}

describe('ClientEditorPage', () => {
    beforeEach(() => {
        mocks.clients.mockReset().mockReturnValue({
            data: {value: [{username: 'alice', mechanism: 'PLAIN'}]},
            error: {value: null},
            isPending: ref(false),
        });
        mocks.groups.mockReset().mockReturnValue({
            data: {value: [
                {name: 'producers', clients: ['alice'], roles: []},
                {name: 'admins', clients: [], roles: []},
            ]},
            error: {value: null},
            isPending: {value: false},
        });
        mocks.patchClient.mockReset().mockResolvedValue(undefined);
        mocks.push.mockReset();
    });

    it('replaces the client groups when editing', async () => {
        // given
        const wrapper = mountPage();
        await wrapper.get('.remove').trigger('click');
        await wrapper.get('.chip-input').trigger('focus');
        await wrapper.findAll('.option').find((option) => option.text() === 'admins')!.trigger('click');

        // when
        await wrapper.get('form').trigger('submit');

        // then
        expect(mocks.patchClient).toHaveBeenCalledWith({
            username: 'alice',
            body: {mechanism: 'PLAIN', groups: ['admins']},
        });
    });
});
