import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { RbacAclConfig } from '@/api/types';
import AclEditor from './AclEditor.vue';

const topicRow = (pattern = 'orders'): RbacAclConfig => ({
    resource: {type: 'TOPIC', pattern, patternType: 'LITERAL'},
    operation: 'READ',
    permission: 'ALLOW',
});

function mountEditor(acls: RbacAclConfig[]) {
    return {
        acls,
        wrapper: mount(AclEditor, {props: {modelValue: acls}}),
    };
}

describe('AclEditor', () => {
    it('copies the last acl row when the copy button is pressed', async () => {
        const largeRow: RbacAclConfig = {
            resource: {type: 'CLUSTER'},
            operation: 'ALL',
            permission: 'DENY',
        };
        const {acls, wrapper} = mountEditor([topicRow('orders'), largeRow]);
        const before = acls[1];

        await wrapper.find('button.copy').trigger('click');

        expect(acls).toHaveLength(3);
        expect(acls[2]).toEqual(before);
        expect(acls[2]).not.toBe(before);
        expect(acls[0]).toEqual(topicRow('orders'));
    });

    it('disables the copy button when there are no acls to copy', () => {
        const {wrapper} = mountEditor([]);

        expect(wrapper.find('button.copy').attributes('disabled')).toBeDefined();
    });
});