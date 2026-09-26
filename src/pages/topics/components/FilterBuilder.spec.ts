import { mount, type VueWrapper } from '@vue/test-utils';
import { reactive } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import type { ValueFormat, VirtualTopicConfigFilter } from '@/api/types';
import type { VirtualTopicFilterForm } from '../lib/virtualTopicConfig';
import FilterBuilder from './FilterBuilder.vue';
import CelEditor from '../../clusters/components/CelEditor.vue';

/// reka-ui scrolls the highlighted listbox option into view when the dropdown opens;
/// jsdom has no scrollIntoView, so polyfill it once (SearchSelect's combobox).
Element.prototype.scrollIntoView ??= () => {};

/// The kind picker is a SearchSelect (reka combobox) in production; in jsdom the portal
/// content is off-limits, so mock the module with a plain select that shares the v-model
/// contract. Keyed by module path because script-setup SFCs expose no `name` for stubs.
const { KindSelectStub } = vi.hoisted(() => ({
    KindSelectStub: {
        name: 'KindSelectStub',
        props: {
            modelValue: { type: String, required: true },
            items: { type: Array, required: true },
        },
        emits: ['update:modelValue'],
        setup(
            props: { modelValue: string; items: Array<{ value: string; label: string }> },
            { emit }: { emit: (event: string, value: string) => void },
        ) {
            return {
                onChange(event: Event) {
                    emit('update:modelValue', (event.target as HTMLSelectElement).value);
                },
                items: props.items,
                modelValue: props.modelValue,
            };
        },
        template: `
            <select data-kind :value="modelValue" @change="onChange">
                <option value="" disabled>No filter</option>
                <option v-for="item in items" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>`,
    },
}));

vi.mock('@/pages/publish/components/SearchSelect.vue', () => ({ default: KindSelectStub }));

/// Mounts the builder behind a real parent using `v-model`/`v-model:valueFormat`, so
/// emitted updates flow back through Vue's reactivity exactly as they do in the page.
function mountBuilder(initial: VirtualTopicFilterForm, valueFormat: ValueFormat | null = null) {
    const state = reactive({ filters: initial, valueFormat });
    const wrapper = mount({
        components: { FilterBuilder },
        setup: () => state,
        template: '<FilterBuilder v-model="filters" v-model:valueFormat="valueFormat" />',
    });
    return { wrapper, state };
}

async function pickKind(wrapper: VueWrapper, value: string): Promise<void> {
    await wrapper.find('select[data-kind]').setValue(value);
}

const headerClause: VirtualTopicConfigFilter = { type: 'headerEquals', header: 'region', value: 'eu' };
const celClause: VirtualTopicConfigFilter = { type: 'cel', expression: 'value.amount > 100' };

describe('FilterBuilder', () => {
    it('shows the empty state when no filter is chosen', () => {
        const { wrapper } = mountBuilder({ clause: null });

        expect(wrapper.find('.empty').exists()).toBe(true);
        expect((wrapper.find('select[data-kind]').element as HTMLSelectElement).value).toBe('');
    });

    it('choosing Header creates a blank header-equals clause', async () => {
        const { wrapper, state } = mountBuilder({ clause: null });

        await pickKind(wrapper, 'header');

        expect(state.filters.clause).toEqual({ type: 'headerEquals', header: '', value: '' });
        expect(wrapper.find('.empty').exists()).toBe(false);
    });

    it('reflects the chosen family in the kind select', async () => {
        const { wrapper } = mountBuilder({ clause: celClause });

        expect((wrapper.find('select[data-kind]').element as HTMLSelectElement).value).toBe('cel');
    });

    it('updates the header name and value in place', async () => {
        const { wrapper, state } = mountBuilder({ clause: headerClause });

        await wrapper.findAll('.row input')[0]!.setValue('env');
        await wrapper.findAll('.row input')[1]!.setValue('prod');

        expect(state.filters.clause).toEqual({ type: 'headerEquals', header: 'env', value: 'prod' });
    });

    it('switches the header comparison while keeping header and value', async () => {
        const { wrapper, state } = mountBuilder({ clause: headerClause });

        await wrapper.find('select.op').setValue('headerContains');

        expect(state.filters.clause).toEqual({ type: 'headerContains', header: 'region', value: 'eu' });
    });

    it('choosing CEL creates a blank cel clause and shows the value format select', async () => {
        const { wrapper, state } = mountBuilder({ clause: null });

        await pickKind(wrapper, 'cel');

        expect(state.filters.clause).toEqual({ type: 'cel', expression: '' });
        expect(wrapper.find('#vf-value-format').exists()).toBe(true);
        expect((wrapper.find('#vf-value-format').element as HTMLSelectElement).value).toBe('');
    });

    it('offers No value format as a first-class option for a fresh CEL filter', () => {
        const { wrapper } = mountBuilder({ clause: celClause });

        expect(wrapper.find('#vf-value-format').text()).toContain('No value format');
        expect((wrapper.find('#vf-value-format').element as HTMLSelectElement).value).toBe('');
    });

    it('writes the JSON value format for a CEL filter', async () => {
        const { wrapper, state } = mountBuilder({ clause: celClause });

        await wrapper.find('#vf-value-format').setValue('json');

        expect(state.valueFormat).toBe('json');
    });

    it('clears a set value format back to none', async () => {
        const { wrapper, state } = mountBuilder({ clause: celClause }, 'json');

        await wrapper.find('#vf-value-format').setValue('');

        expect(state.valueFormat).toBeNull();
    });

    it('switching a CEL filter to Header clears the value format', async () => {
        const { wrapper, state } = mountBuilder({ clause: celClause }, 'json');

        await pickKind(wrapper, 'header');

        expect(state.valueFormat).toBeNull();
        expect(state.filters.clause).toEqual({ type: 'headerEquals', header: '', value: '' });
    });

    it('forwards a CEL expression edit into the clause', async () => {
        const { wrapper, state } = mountBuilder({ clause: celClause });

        wrapper.findComponent(CelEditor).vm.$emit('update:modelValue', 'value.amount > 200');

        expect(state.filters.clause).toEqual({ type: 'cel', expression: 'value.amount > 200' });
    });

    it('hides the value format select for a header filter', () => {
        const { wrapper } = mountBuilder({ clause: headerClause }, 'json');

        expect(wrapper.find('#vf-value-format').exists()).toBe(false);
    });
});