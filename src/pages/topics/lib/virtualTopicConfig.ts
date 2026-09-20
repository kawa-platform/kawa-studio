import type { Topic, VirtualTopicConfig } from '@/api/types';

export type VirtualTopicFilterType =
    | 'none'
    | 'headerEquals'
    | 'headerContains'
    | 'headerStartsWith'
    | 'headerMatches'
    | 'cel';

interface VirtualTopicConfigForm {
    topic: string;
    exposePhysicalTopic: boolean;
    filterType: VirtualTopicFilterType;
    header: string;
    value: string;
    expression: string;
}

export interface VirtualTopicForm {
    name: string;
    topic: string;
    exposePhysicalTopic: boolean;
    filterType: VirtualTopicFilterType;
    header: string;
    value: string;
    expression: string;
}

const headerTypes: ReadonlyArray<Extract<VirtualTopicFilterType, 'headerEquals' | 'headerContains' | 'headerStartsWith' | 'headerMatches'>> =
    ['headerEquals', 'headerContains', 'headerStartsWith', 'headerMatches'];
const isHeaderType = (t: VirtualTopicFilterType): t is (typeof headerTypes)[number] =>
    (headerTypes as readonly string[]).includes(t);

export function buildVirtualTopicConfig(form: VirtualTopicConfigForm): VirtualTopicConfig {
    const config: VirtualTopicConfig = {
        topic: form.topic,
        exposePhysicalTopic: form.exposePhysicalTopic,
    };

    if (isHeaderType(form.filterType)) {
        config.filter = {
            type: form.filterType,
            header: form.header.trim(),
            value: form.value.trim(),
        };
    } else if (form.filterType === 'cel') {
        config.filter = { type: 'cel', expression: form.expression.trim() };
    }

    return config;
}

export function virtualTopicFormFromTopic(topic: Topic): VirtualTopicForm {
    const config = topic.config ?? {};
    const filterType = config.filterType as VirtualTopicFilterType | undefined;
    const filter = topic.filter;

    return {
        name: topic.name,
        topic: topic.physicalTopic ?? '',
        exposePhysicalTopic: config.exposePhysicalTopic === 'true',
        filterType: filterType ?? (filter?.kind === 'cel' ? 'cel' : filter ? 'headerEquals' : 'none'),
        header: config.filterHeader ?? '',
        value: config.filterValue ?? '',
        expression: config.filterExpression ?? (filter?.kind === 'cel' ? filter.expression : ''),
    };
}
