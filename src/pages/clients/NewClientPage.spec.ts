import {mount} from '@vue/test-utils';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import NewClientPage from './NewClientPage.vue';

const mocks = vi.hoisted(() => ({
    createClient: vi.fn(),
    groups: vi.fn(),
    push: vi.fn(),
}));

vi.mock('@/api/api', () => ({
    useApi: () => ({}),
}));

vi.mock('./queries', () => ({
    useCreateClient: () => ({mutateAsync: mocks.createClient, isPending: false}),
}));

vi.mock('../rbac/queries', () => ({
    useRbacGroups: mocks.groups,
}));

vi.mock('vue-router', () => ({
    useRouter: () => ({push: mocks.push}),
}));

function mountPage() {
    return mount(NewClientPage);
}

describe('NewClientPage', () => {
    beforeEach(() => {
        mocks.createClient.mockReset().mockResolvedValue(undefined);
        mocks.groups.mockReset().mockReturnValue({
            data: {value: [
                {name: 'producers', clients: [], roles: []},
                {name: 'admins', clients: [], roles: []},
            ]},
            error: {value: null},
            isPending: {value: false},
        });
        mocks.push.mockReset();
    });

    it('submits all selected groups when creating a client', async () => {
        // given
        const wrapper = mountPage();
        await wrapper.get('#username').setValue('alice');
        await wrapper.get('#password').setValue('a-password-long-enough');
        await wrapper.get('.chip-input').trigger('focus');
        await wrapper.findAll('.option')[0]!.trigger('click');
        await wrapper.get('.chip-input').trigger('focus');
        await wrapper.findAll('.option')[0]!.trigger('click');

        // when
        await wrapper.get('button.btn-primary').trigger('click');

        // then
        expect(mocks.createClient).toHaveBeenCalledWith({
            username: 'alice',
            req: {
                mechanism: 'PLAIN',
                password: 'a-password-long-enough',
                groups: ['producers', 'admins'],
            },
        });
    });
});
