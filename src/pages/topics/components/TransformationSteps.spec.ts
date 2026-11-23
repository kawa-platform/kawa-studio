import { mount } from '@vue/test-utils';
import { reactive } from 'vue';
import { describe, expect, it } from 'vitest';
import type { TransformationConfig } from '@/api/types';
import CelEditor from '../../clusters/components/CelEditor.vue';
import { buildTransformations, stepsFromConfig, type StepForm } from '../lib/transformations';
import TransformationSteps from './TransformationSteps.vue';

/// Mounts the editor behind a real parent using `v-model`, so updates flow back as in the page.
function mountSteps(config: TransformationConfig[], props: Record<string, unknown> = {}) {
    const state = reactive({ steps: stepsFromConfig(config) as StepForm[], props });
    const wrapper = mount({
        components: { TransformationSteps },
        setup: () => state,
        template: '<TransformationSteps v-model="steps" v-bind="props" />',
    });
    return { wrapper, state, built: () => buildTransformations(state.steps) };
}

const types = (steps: StepForm[]) => steps.map((step) => step.type);

describe('TransformationSteps', () => {
    it('shows the empty state without steps', () => {
        const { wrapper } = mountSteps([]);

        expect(wrapper.find('.empty').exists()).toBe(true);
        expect(wrapper.findAll('.step')).toHaveLength(0);
    });

    it('adds a step from the menu and resets the menu', async () => {
        const { wrapper, state } = mountSteps([]);

        await wrapper.find('select[aria-label="Add step"]').setValue('renameField');

        expect(types(state.steps)).toEqual(['renameField']);
        expect((wrapper.find('select[aria-label="Add step"]').element as HTMLSelectElement).value).toBe('');
    });

    /// The output format is a block of its own on the page, not a step.
    it('offers no convert step', () => {
        const { wrapper } = mountSteps([]);

        expect(wrapper.find('select[aria-label="Add step"] option[value="convert"]').exists()).toBe(false);
    });

    it('reorders and removes steps', async () => {
        const { wrapper, state } = mountSteps([
            { type: 'dropFields', fields: ['a'] },
            { type: 'cel', expression: 'value' },
        ]);

        await wrapper.findAll('button[aria-label="Move down"]')[0]!.trigger('click');
        expect(types(state.steps)).toEqual(['cel', 'dropFields']);

        await wrapper.findAll('button[aria-label="Remove step"]')[0]!.trigger('click');
        expect(types(state.steps)).toEqual(['dropFields']);
    });

    it('removes every step at once', async () => {
        const { wrapper, state } = mountSteps([{ type: 'cel', expression: 'value' }]);

        await wrapper.findAll('button').find((button) => button.text().includes('Remove all'))!.trigger('click');

        expect(state.steps).toEqual([]);
    });

    it('adds drop fields as chips, comma-separated or one by one, and removes them', async () => {
        const { wrapper, built } = mountSteps([{ type: 'dropFields', fields: [] }]);
        const input = wrapper.find('input[aria-label="Field to drop"]');

        await input.setValue('customer.email, internal_risk_score');
        await input.trigger('keydown', { key: 'Enter' });
        await input.setValue('lines.internal_cost');
        await input.trigger('blur');
        expect(built()).toEqual([{ type: 'dropFields', fields: ['customer.email', 'internal_risk_score', 'lines.internal_cost'] }]);

        await wrapper.find('button[aria-label="Keep internal_risk_score"]').trigger('click');
        expect(built()).toEqual([{ type: 'dropFields', fields: ['customer.email', 'lines.internal_cost'] }]);
    });

    it('edits a rename and a default', async () => {
        const { wrapper, built } = mountSteps([
            { type: 'renameField', from: '', to: '' },
            { type: 'defaultField', field: '', value: null },
        ]);

        await wrapper.find('input[aria-label="Rename from"]').setValue('customer.name');
        await wrapper.find('input[aria-label="Rename to"]').setValue('customerName');
        await wrapper.find('input[aria-label="Default field"]').setValue('currency');
        await wrapper.find('input[aria-label="Default value"]').setValue('"EUR"');

        expect(built()).toEqual([
            { type: 'renameField', from: 'customer.name', to: 'customerName' },
            { type: 'defaultField', field: 'currency', value: 'EUR' },
        ]);
    });

    it('edits a CEL step, completing against the fields the step sees', async () => {
        const { wrapper, built } = mountSteps([{ type: 'cel', expression: '' }], { fields: [['order_id', 'lines.sku']] });
        const editor = wrapper.findComponent(CelEditor);

        expect(editor.props('fields')).toEqual(['order_id', 'lines.sku']);
        editor.vm.$emit('update:modelValue', '{"id": value.order_id}');
        await wrapper.vm.$nextTick();

        expect(built()).toEqual([{ type: 'cel', expression: '{"id": value.order_id}' }]);
    });

    it('shows each step its own errors', () => {
        const { wrapper } = mountSteps(
            [{ type: 'cel', expression: '' }, { type: 'dropFields', fields: [] }],
            { errors: [['Enter a CEL expression.'], ['Add at least one field to drop.']] },
        );

        const cards = wrapper.findAll('.step');
        expect(cards[0]!.find('.field-error').text()).toBe('Enter a CEL expression.');
        expect(cards[1]!.find('.field-error').text()).toBe('Add at least one field to drop.');
    });
});
