import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import type { PayloadFormatConfig, TransformationConfig } from '@/api/types';
import { stepsFromConfig } from '../lib/transformations';
import TransformationPreview from './TransformationPreview.vue';

const api = vi.hoisted(() => ({
    listSchemas: vi.fn(),
    getSchema: vi.fn(),
}));

vi.mock('@/api/api', () => ({ useApi: () => api }));

/// `v-model:sample` is wired back into the props, as a parent would.
function mountPreview(
    sample: string,
    steps: TransformationConfig[],
    valueFormat: PayloadFormatConfig | null = { type: 'json' },
    outputFormat: PayloadFormatConfig | null = null,
) {
    const wrapper: VueWrapper = mount(TransformationPreview, {
        props: {
            sample,
            'onUpdate:sample': (value: string) => { void wrapper.setProps({ sample: value }); },
            steps: stepsFromConfig(steps),
            valueFormat,
            outputFormat,
            physicalTopic: 'orders.v1',
        },
    });
    return wrapper;
}

const order = JSON.stringify({ order_id: 'o-1', customer: { name: 'Ada', email: 'a@x' } });

describe('TransformationPreview', () => {
    it('shows the resolved input and output formats', () => {
        const wrapper = mountPreview('', [], { type: 'json' }, { type: 'xml', root: 'order' });

        expect(wrapper.find('.formats').text()).toContain('JSON');
        expect(wrapper.find('.formats').text()).toContain('XML (<order>)');
    });

    it('marks dropped, renamed and added fields of the sample', () => {
        const wrapper = mountPreview(order, [
            { type: 'dropFields', fields: ['customer.email'] },
            { type: 'renameField', from: 'customer.name', to: 'customerName' },
            { type: 'defaultField', field: 'currency', value: 'EUR' },
        ]);

        expect(wrapper.find('.row-dropped').text()).toBe('− customer.email');
        expect(wrapper.find('.row-renamed').text()).toBe('customer.name → customerName');
        expect(wrapper.find('.row-added').text()).toBe('+ currency = "EUR"');
    });

    it('shows the delivered value in the output format', () => {
        const wrapper = mountPreview(order, [{ type: 'dropFields', fields: ['customer.email'] }], { type: 'json' }, { type: 'xml', root: 'order' });

        expect(wrapper.find('[data-output]').text()).toBe([
            '<order>',
            '  <order_id>o-1</order_id>',
            '  <customer>',
            '    <name>Ada</name>',
            '  </customer>',
            '</order>',
        ].join('\n'));
    });

    it('shows JSON when JSON is delivered', () => {
        const wrapper = mountPreview(order, [{ type: 'dropFields', fields: ['customer'] }]);

        expect(JSON.parse(wrapper.find('[data-output]').text())).toEqual({ order_id: 'o-1' });
    });

    it('says when the sample is not JSON', () => {
        const wrapper = mountPreview('{nope', [{ type: 'dropFields', fields: ['a'] }]);

        expect(wrapper.find('.field-error').text()).toBe('The sample is not valid JSON.');
        expect(wrapper.find('.fields').exists()).toBe(false);
    });

    it('stops at a CEL step and says so', () => {
        const wrapper = mountPreview(order, [{ type: 'cel', expression: 'value' }]);

        expect(wrapper.find('.stopped').text()).toContain('Step 1 is a CEL expression');
        // Up to the CEL step the value is still the decoded tree, so it is not shown as the output format.
        expect(wrapper.text()).toContain('Value step 1 receives');
    });

    it('fills the sample from the schema of the Avro subject', async () => {
        api.listSchemas.mockResolvedValue({
            physicalTopic: 'orders.v1',
            strategy: 'TopicRecordName',
            subjects: [
                { subject: 'other-value', recordName: 'Other', version: 1 },
                { subject: 'orders-value', recordName: 'Order', version: 4 },
            ],
        });
        api.getSchema.mockResolvedValue({
            subject: 'orders-value', recordName: 'Order', version: 4,
            fields: [{ name: 'id', type: 'string', required: true }, { name: 'amount', type: 'double', required: true }],
        });
        const wrapper = mountPreview('', [{ type: 'cel', expression: 'value' }], { type: 'avro', subject: 'orders-value' });

        await wrapper.findAll('button').find((button) => button.text().includes('Fill from schema'))!.trigger('click');
        await flushPromises();

        expect(api.getSchema).toHaveBeenCalledWith('orders-value', 4);
        expect(JSON.parse((wrapper.props() as { sample: string }).sample)).toEqual({ id: '', amount: 0 });
    });

    it('offers no schema fill for a JSON topic', () => {
        const wrapper = mountPreview('', []);

        expect(wrapper.text()).not.toContain('Fill from schema');
    });
});
