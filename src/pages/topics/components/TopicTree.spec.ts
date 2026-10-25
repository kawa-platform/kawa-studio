import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { Topic } from '@/api/types';
import TopicTree from './TopicTree.vue';

const virtualTopic: Topic = {
    type: 'virtual',
    name: 'orders-eu',
    physicalTopic: 'orders',
    partitions: 3,
    replicationFactor: 2,
};

describe('TopicTree', () => {
    it('offers edit and delete actions for virtual topics', async () => {
        const wrapper = mount(TopicTree, {
            props: {
                rows: [{ topic: virtualTopic, depth: 0, childCount: 0, last: true }],
                collapsed: new Set<string>(),
                view: 'virtual',
            },
        });

        expect(wrapper.text()).not.toContain('Messages');
        expect(wrapper.text()).not.toContain('Size');
        expect(wrapper.find('button[title="Edit orders-eu"]').exists()).toBe(true);
        expect(wrapper.find('button[title="Delete orders-eu"]').exists()).toBe(true);

        await wrapper.find('button[title="Edit orders-eu"]').trigger('click');
        expect(wrapper.emitted('edit')?.[0]).toEqual([virtualTopic]);

        await wrapper.find('button[title="Edit orders-eu"]').trigger('keydown.enter');
        expect(wrapper.emitted('open')).toBeUndefined();

        await wrapper.find('button[title="Delete orders-eu"]').trigger('click');
        expect(wrapper.emitted('delete')?.[0]).toEqual([virtualTopic]);
    });

    it('locks edit and delete of a topic managed by the operator', async () => {
        const managed: Topic = { ...virtualTopic, managedBy: { principal: 'kawa-operator' } };
        const wrapper = mount(TopicTree, {
            props: {
                rows: [{ topic: managed, depth: 0, childCount: 0, last: true }],
                collapsed: new Set<string>(),
                view: 'virtual',
            },
        });

        const buttons = wrapper.findAll('.actions button');
        expect(buttons).toHaveLength(2);
        for (const button of buttons) {
            expect(button.attributes('disabled')).toBeDefined();
            expect(button.attributes('title')).toBe('Managed by kawa-operator, change it through Kubernetes');
            await button.trigger('click');
        }
        expect(wrapper.emitted('edit')).toBeUndefined();
        expect(wrapper.emitted('delete')).toBeUndefined();
        expect(wrapper.text()).toContain('Managed by kawa-operator');
    });
});
