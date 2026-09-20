import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { describe, expect, it } from 'vitest';
import type { Topic } from '@/api/types';
import TopicDrawer from './TopicDrawer.vue';

const virtualTopic: Topic = {
    type: 'virtual',
    name: 'orders',
    physicalTopic: 'orders.v1',
    partitions: 3,
    replicationFactor: 2,
};

describe('TopicDrawer', () => {
    it('offers deletion for a virtual topic', async () => {
        const wrapper = mount(TopicDrawer, {
            props: {
                open: true,
                topic: virtualTopic,
                topics: [virtualTopic],
                acls: [],
            },
            attachTo: document.body,
        });

        await nextTick();

        expect(document.body.textContent).toContain('Delete virtual topic');
        wrapper.unmount();
    });

    it('does not offer deletion for a physical topic', async () => {
        const physicalTopic: Topic = {
            type: 'physical',
            name: 'orders.v1',
            partitions: 3,
            replicationFactor: 2,
        };
        const wrapper = mount(TopicDrawer, {
            props: {
                open: true,
                topic: physicalTopic,
                topics: [physicalTopic],
                acls: [],
            },
            attachTo: document.body,
        });

        await nextTick();

        expect(document.body.textContent).not.toContain('Delete virtual topic');
        wrapper.unmount();
    });
});
