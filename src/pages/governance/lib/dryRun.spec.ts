import { describe, expect, it } from 'vitest';
import type { GovernanceDryRunView } from '@/api/types';
import { toDryRunRequest, toGovernanceResult } from './dryRun';
import { sampleDocument } from './mock';

const naming = sampleDocument().rules.find((r) => r.name === 'topic-naming-convention')!;

describe('dry-run mapping', () => {
    it('sends a physical topic with its numbers and configs', () => {
        const req = toDryRunRequest({
            type: 'topic', principal: 'User:a', service: '',
            values: { name: ' app.x ', partitions: '6', replicationFactor: 3, 'cleanup.policy': 'compact', 'retention.ms': '' },
        });
        expect(req).toEqual({
            resourceType: 'TOPIC', operation: 'CREATE', virtual: false, principal: 'User:a', service: '',
            resource: { name: 'app.x', partitions: 6, replicationFactor: 3, configs: { 'cleanup.policy': 'compact' } },
        });
    });

    it('pairs trace nodes with the rule tree by position', () => {
        const view: GovernanceDryRunView = {
            allowed: true, exemptedBy: null,
            rules: [{
                rule: 'topic-naming-convention', outcome: 'PASS', detail: null, exemptedBy: null, path: [], message: null,
                subRules: [
                    { name: 'model', outcome: 'FAIL', detail: null, checks: [] },
                    { name: 'event', outcome: 'FAIL', detail: null, checks: [] },
                    { name: 'app', outcome: 'PASS', detail: null, checks: [
                        { name: 'standard', outcome: 'PASS', detail: null, checks: [] },
                        { name: 'changelog', outcome: 'SKIPPED', detail: null, checks: [] },
                    ] },
                    { name: 'ingest', outcome: 'SKIPPED', detail: null, checks: [] },
                    { name: 'egress', outcome: 'SKIPPED', detail: null, checks: [] },
                ],
            }],
        };
        const result = toGovernanceResult(view, [naming]);
        expect(result.status).toBe(201);
        expect(result.trace[0]!.nodes[2]!.children!.map((c) => c.outcome)).toEqual(['pass', 'skipped']);
        expect(result.trace[0]!.nodes[2]!.node.name).toBe('app');
    });

    it('sends an alter without partitions or replication factor', () => {
        const req = toDryRunRequest({
            type: 'topic', operation: 'alter', principal: '', service: '',
            values: { name: 'orders', partitions: 6, replicationFactor: 3, 'cleanup.policy': 'compact' },
        });
        expect(req.operation).toBe('ALTER');
    });
});
