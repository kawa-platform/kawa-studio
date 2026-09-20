import { describe, expect, it } from 'vitest';
import { TOPIC_CONFIG_KEYS, TOPIC_CONFIGS, configValuesFor } from './topicConfigs';

describe('TOPIC_CONFIG_KEYS', () => {
    it('is sorted so the autocomplete list reads predictably', () => {
        expect(TOPIC_CONFIG_KEYS).toEqual([...TOPIC_CONFIG_KEYS].sort());
    });

    it('has no duplicates', () => {
        expect(new Set(TOPIC_CONFIG_KEYS).size).toBe(TOPIC_CONFIG_KEYS.length);
    });

    it('covers the configs the quick fields can set', () => {
        expect(TOPIC_CONFIG_KEYS).toContain('cleanup.policy');
        expect(TOPIC_CONFIG_KEYS).toContain('retention.ms');
    });
});

describe('configValuesFor', () => {
    it('returns the value domain for enum-like configs', () => {
        expect(configValuesFor('cleanup.policy')).toEqual(['delete', 'compact']);
        expect(configValuesFor('unclean.leader.election.enable')).toEqual(['true', 'false']);
    });

    it('returns undefined for free-text configs and unknown keys', () => {
        expect(configValuesFor('retention.ms')).toBeUndefined();
        expect(configValuesFor('not.a.real.config')).toBeUndefined();
    });

    it('keeps every suggestion either keyed with values or not', () => {
        for (const entry of TOPIC_CONFIGS) {
            expect(entry.key.length).toBeGreaterThan(0);
        }
    });
});