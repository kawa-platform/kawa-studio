import { describe, expect, it } from 'vitest';
import { managedTitle } from './managed';

describe('managedTitle', () => {
    it('names the owning principal', () => {
        expect(managedTitle({ principal: 'kawa-operator' }))
            .toBe('Managed by kawa-operator, change it through Kubernetes');
    });

    it('is undefined for unmanaged records', () => {
        expect(managedTitle(null)).toBeUndefined();
        expect(managedTitle(undefined)).toBeUndefined();
    });
});
