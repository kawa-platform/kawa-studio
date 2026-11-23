import { mount } from '@vue/test-utils';
import { reactive } from 'vue';
import { describe, expect, it } from 'vitest';
import type { PayloadFormatConfig } from '@/api/types';
import ValueFormatFields from './ValueFormatFields.vue';

/// Mounts the editor behind a real parent using `v-model`, so updates flow back as in the page.
function mountFields(format: PayloadFormatConfig | null, extra: Record<string, unknown> = {}) {
    const state = reactive({ format, props: { label: 'Record value format', noneLabel: 'No value format', ...extra } });
    const wrapper = mount({
        components: { ValueFormatFields },
        setup: () => state,
        template: '<ValueFormatFields v-model="format" id-prefix="vf" v-bind="props" />',
    });
    return { wrapper, state };
}

const select = (wrapper: ReturnType<typeof mountFields>['wrapper'], id: string) =>
    wrapper.find(`#${id}`).element as HTMLSelectElement;

describe('ValueFormatFields', () => {
    it('offers No value format as a first-class option for a topic', () => {
        const { wrapper } = mountFields(null);

        expect(wrapper.find('#vf-type').text()).toContain('No value format');
        expect(select(wrapper, 'vf-type').value).toBe('');
        expect(wrapper.find('#vf-on-decode-error').exists()).toBe(false);
    });

    it('names the "none" option as the caller asks, for the output format block', () => {
        const { wrapper } = mountFields(null, { label: 'Deliver values as', noneLabel: 'Same as the value format', output: true });

        expect(wrapper.find('label[for="vf-type"]').text()).toBe('Deliver values as');
        expect(wrapper.find('#vf-type option[value=""]').text()).toBe('Same as the value format');
    });

    it('sets and clears the format', async () => {
        const { wrapper, state } = mountFields(null);

        await wrapper.find('#vf-type').setValue('json');
        expect(state.format).toEqual({ type: 'json' });

        await wrapper.find('#vf-type').setValue('');
        expect(state.format).toBeNull();
    });

    it('shows skip as the decode-error default without writing it', () => {
        const { wrapper, state } = mountFields({ type: 'json' });

        expect(select(wrapper, 'vf-on-decode-error').value).toBe('skip');
        expect(state.format).toEqual({ type: 'json' });
    });

    it('keeps the decode-error choice when switching format, and starts the new fields empty', async () => {
        const { wrapper, state } = mountFields({ type: 'avro', onDecodeError: 'fail', subject: 'orders-value' });

        await wrapper.find('#vf-type').setValue('xml');

        expect(state.format).toEqual({ type: 'xml', onDecodeError: 'fail' });
    });

    it('edits the Avro subject and version, omitting them when emptied', async () => {
        const { wrapper, state } = mountFields({ type: 'avro' });

        await wrapper.find('#vf-subject').setValue('orders-value');
        await wrapper.find('#vf-version').setValue('3');
        expect(state.format).toEqual({ type: 'avro', subject: 'orders-value', version: 3 });

        await wrapper.find('#vf-version').setValue('');
        await wrapper.find('#vf-subject').setValue('');
        expect(state.format).toEqual({ type: 'avro' });
    });

    it('edits the XML root', async () => {
        const { wrapper, state } = mountFields({ type: 'xml' });

        await wrapper.find('#vf-root').setValue('order');

        expect(state.format).toEqual({ type: 'xml', root: 'order' });
        expect(wrapper.find('#vf-subject').exists()).toBe(false);
    });

    it('shows the errors it is given', () => {
        const { wrapper } = mountFields({ type: 'xml' }, { errors: ['XML output needs a root element.'] });

        expect(wrapper.find('.field-error').text()).toBe('XML output needs a root element.');
    });
});
