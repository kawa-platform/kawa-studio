import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ClientDetailsPage from './ClientDetailsPage.vue';

const { clientsMock, groupsMock, routeMock } = vi.hoisted(() => ({
    clientsMock: vi.fn(),
    groupsMock: vi.fn(),
    routeMock: { params: { name: 'alice' } },
}));

vi.mock('vue-router', async () => ({
    ...await vi.importActual<typeof import('vue-router')>('vue-router'),
    useRoute: () => routeMock,
}));

vi.mock('./queries', () => ({
    useClients: clientsMock,
}));

vi.mock('../rbac/queries', () => ({
    useRbacGroups: groupsMock,
}));

const RouterLinkStub = {
    name: 'RouterLink',
    props: { to: { type: [String, Object], default: '' } },
    template: '<a :href="typeof to === \'string\' ? to : \'/admin/\'"><slot /></a>',
};

function mountPage() {
    return mount(ClientDetailsPage, {
        global: {
            stubs: { RouterLink: RouterLinkStub },
        },
    });
}

describe('ClientDetailsPage', () => {
    beforeEach(() => {
        routeMock.params.name = 'alice';
        clientsMock.mockReturnValue({
            data: { value: [{ username: 'alice', mechanism: 'SCRAM-SHA-256' }] },
            error: { value: null },
            isPending: { value: false },
        });
        groupsMock.mockReturnValue({
            data: { value: [
                { name: 'producers', clients: ['alice'], roles: [] },
                { name: 'admins', clients: [], roles: [] },
            ] },
            error: { value: null },
            isPending: { value: false },
        });
    });

    it('shows the client details and links to its edit page', () => {
        const wrapper = mountPage();

        expect(wrapper.get('h1').text()).toBe('alice');
        expect(wrapper.text()).toContain('SCRAM-SHA-256');
        expect(wrapper.text()).toContain('producers');
        expect(wrapper.get('a[href="/clients/alice/edit"]').text()).toContain('Edit client');
        expect(wrapper.find('form').exists()).toBe(false);
        expect(wrapper.find('input').exists()).toBe(false);
        expect(wrapper.find('select').exists()).toBe(false);
    });

    it('reports a missing client without offering edit', () => {
        clientsMock.mockReturnValue({
            data: { value: [] },
            error: { value: null },
            isPending: { value: false },
        });

        const wrapper = mountPage();

        expect(wrapper.text()).toContain('Client “alice” does not exist.');
        expect(wrapper.find('a[href="/clients/alice/edit"]').exists()).toBe(false);
    });
});
