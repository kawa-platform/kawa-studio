import type { PayloadFormatConfig, Topic, TopicFilter, TransformationConfig, VirtualTopicConfig, VirtualTopicConfigFilter, VirtualTopicPatch } from '@/api/types';
import { buildFormat, buildTransformations, outputFromConfig, stepsFromConfig, type StepForm } from './transformations';

export type { VirtualTopicConfigFilter } from '@/api/types';

/// Which family a clause belongs to; drives the FilterBuilder UI. The gateway's only
/// content filter is CEL (evaluated over the JSON-decoded value), so there is no
/// separate 'value' family.
export type VirtualTopicFilterFamily = 'header' | 'cel';

/// The editable form of a virtual topic's single read filter.
export interface VirtualTopicFilterForm {
    clause: VirtualTopicConfigFilter | null;
}

export interface VirtualTopicConfigForm {
    topic: string;
    exposePhysicalTopic: boolean;
    valueFormat: PayloadFormatConfig | null;
    filters: VirtualTopicFilterForm;
    /// The field steps; the output format is held apart and sent as the trailing `convert`.
    transformations: StepForm[];
    /// The format transformed values are delivered in, or null for the value format.
    outputFormat: PayloadFormatConfig | null;
}

export interface VirtualTopicForm extends VirtualTopicConfigForm {
    name: string;
}

export const headerClauseTypes =
    ['headerEquals', 'headerContains', 'headerStartsWith', 'headerMatches'] as const;

type HeaderClause = { type: (typeof headerClauseTypes)[number]; header: string; value: string };
type CelClause = { type: 'cel'; expression: string };

export const isHeaderClause = (clause: VirtualTopicConfigFilter): clause is HeaderClause =>
    (headerClauseTypes as readonly string[]).includes(clause.type);
export const isCelClause = (clause: VirtualTopicConfigFilter): clause is CelClause =>
    clause.type === 'cel';

export function familyOf(clause: VirtualTopicConfigFilter | null): VirtualTopicFilterFamily | null {
    if (!clause) return null;
    return isCelClause(clause) ? 'cel' : 'header';
}

/// Whether a filter clause is filled out enough to save. A null clause (no filter) is complete.
export function isFilterComplete(clause: VirtualTopicConfigFilter | null): boolean {
    if (!clause) return true;
    if (isHeaderClause(clause)) return !!clause.header.trim() && !!clause.value.trim();
    return !!clause.expression.trim();
}

function trimmedClause(clause: VirtualTopicConfigFilter): VirtualTopicConfigFilter {
    if (isHeaderClause(clause)) {
        return { ...clause, header: clause.header.trim(), value: clause.value.trim() };
    }
    return { ...clause, expression: clause.expression.trim() };
}

export function buildVirtualTopicConfig(form: VirtualTopicConfigForm): VirtualTopicConfig {
    const config: VirtualTopicConfig = {
        topic: form.topic,
        exposePhysicalTopic: form.exposePhysicalTopic,
    };
    if (form.valueFormat) {
        config.valueFormat = buildFormat(form.valueFormat);
    }
    if (form.filters.clause) {
        config.filter = trimmedClause(form.filters.clause);
    }
    const transformations = buildTransformations(form.transformations, form.outputFormat);
    if (transformations.length > 0) {
        config.transformations = transformations;
    }
    return config;
}

/// The PATCH body for the edit form. PATCH clears a field with an explicit null, so unlike the
/// create body both `filter` and `valueFormat` are always present — an empty form means "remove
/// the filter / drop the value format" rather than "leave it as it is".
///
/// `transformations` works the other way round: omitted keeps the stored steps. It is sent only
/// when the steps differ from `loaded` (the topic's steps when the form opened): `[]` removes them,
/// a list replaces them. A topic whose steps were not touched gets the same body as before.
export function buildVirtualTopicPatch(
    form: VirtualTopicConfigForm,
    name: string,
    loaded: TransformationConfig[] = [],
): VirtualTopicPatch {
    const { transformations: _built, ...config } = buildVirtualTopicConfig(form);
    const patch: VirtualTopicPatch = {
        name,
        ...config,
        filter: form.filters.clause ? trimmedClause(form.filters.clause) : null,
        valueFormat: form.valueFormat ? buildFormat(form.valueFormat) : null,
    };
    const steps = buildTransformations(form.transformations, form.outputFormat);
    // Both sides go through the same builder, so key order cannot make equal steps look changed.
    const stored = buildTransformations(stepsFromConfig(loaded), outputFromConfig(loaded));
    if (JSON.stringify(steps) !== JSON.stringify(stored)) {
        patch.transformations = steps;
    }
    return patch;
}

/// Reverse-parse of the gateway's filter summary (see GetTopicsHandler): the five template
/// shapes the admin emits in `TopicView.filter`. Unrecognized or malformed summaries map to
/// null rather than guessing at a clause.
const headerSummaryTokens: Partial<Record<TopicFilter['kind'], { type: HeaderClause['type']; token: string }>> = {
    header: { type: 'headerEquals', token: '=' },
    headerContains: { type: 'headerContains', token: ' contains ' },
    headerStartsWith: { type: 'headerStartsWith', token: ' starts with ' },
    headerMatches: { type: 'headerMatches', token: ' matches ' },
};

export function clauseFromSummary(filter: TopicFilter | null): VirtualTopicConfigFilter | null {
    if (!filter) return null;
    if (filter.kind === 'cel') return { type: 'cel', expression: filter.expression };
    const spec = headerSummaryTokens[filter.kind];
    if (!spec) return null;
    const at = filter.expression.indexOf(spec.token);
    if (at < 0) return null;
    return {
        type: spec.type,
        header: filter.expression.slice(0, at),
        value: filter.expression.slice(at + spec.token.length),
    };
}

export function virtualTopicFormFromTopic(topic: Topic): VirtualTopicForm {
    return {
        name: topic.name,
        topic: topic.physicalTopic ?? '',
        exposePhysicalTopic: topic.exposePhysicalTopic ?? false,
        valueFormat: topic.valueFormat ? { ...topic.valueFormat } : null,
        filters: { clause: clauseFromSummary(topic.filter ?? null) },
        transformations: stepsFromConfig(topic.transformations),
        outputFormat: outputFromConfig(topic.transformations),
    };
}