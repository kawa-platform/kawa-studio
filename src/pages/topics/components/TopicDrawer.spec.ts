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
            },
            attachTo: document.body,
        });

        await nextTick();

        expect(document.body.textContent).not.toContain('Delete virtual topic');
        wrapper.unmount();
    });

    it('disables deletion of a topic managed by the operator', async () => {
        const managed: Topic = { ...virtualTopic, managedBy: { principal: 'kawa-operator' } };
        const wrapper = mount(TopicDrawer, {
            props: {
                open: true,
                topic: managed,
                topics: [managed],
            },
            attachTo: document.body,
        });

        await nextTick();

        const button = [...document.body.querySelectorAll('button')]
            .find((b) => b.textContent?.includes('Delete virtual topic'));
        expect(button?.disabled).toBe(true);
        expect(button?.title).toBe('Managed by kawa-operator, change it through Kubernetes');
        wrapper.unmount();
    });
});
