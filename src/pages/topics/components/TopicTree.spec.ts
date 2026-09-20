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
});
