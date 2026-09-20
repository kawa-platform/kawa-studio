import type { SchemaDetail, SchemaField } from '@/api/types';

export type FormValues = Record<string, string>;
export type FieldErrors = Record<string, string>;

const isoNow = (): string => new Date().toISOString().replace(/\.\d+Z$/, 'Z');

const uuid = (): string =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : '00000000-0000-4000-8000-000000000000';

/// TopicRecordName strategy: the subject is <physical topic>-<record name>, so the record
/// name is whatever remains once the physical topic prefix is stripped.
export function recordNameOf(subject: string, physicalTopic: string): string {
    const prefix = physicalTopic + '-';
    return subject.startsWith(prefix) ? subject.slice(prefix.length) : subject;
}

/// Seed values from the schema: uuids and timestamps generated, defaults honoured,
/// enums set to their first symbol. Everything else is left for the operator.
export function prefill(schema: SchemaDetail | null): FormValues {
    if (!schema) return {};
    const values: FormValues = {};
    for (const field of schema.fields) {
        if (field.default !== undefined) values[field.name] = field.default;
        else if (field.type === 'uuid') values[field.name] = uuid();
        else if (field.type === 'timestamp') values[field.name] = isoNow();
        else if (field.type === 'enum') values[field.name] = field.symbols?.[0] ?? '';
        else if (field.type === 'boolean') values[field.name] = 'false';
        else values[field.name] = '';
    }
    return values;
}

/// Assign along a dotted path, creating intermediate objects: instrument.issuer.bic
/// becomes { instrument: { issuer: { bic } } }.
export function assignPath(target: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split('.');
    let node = target;
    for (const part of parts.slice(0, -1)) {
        const next = node[part];
        if (typeof next !== 'object' || next === null) node[part] = {};
        node = node[part] as Record<string, unknown>;
    }
    node[parts[parts.length - 1]!] = value;
}

function coerce(field: SchemaField, raw: string): unknown {
    if (field.type === 'double' || field.type === 'int') return Number(raw);
    if (field.type === 'boolean') return raw === 'true';
    return raw;
}

/// The record body. Empty required fields become explicit nulls so the backend — not the
/// UI — has the final say on what the schema permits.
export function buildValue(schema: SchemaDetail | null, values: FormValues): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (!schema) return out;
    for (const field of schema.fields) {
        const raw = values[field.name];
        if (raw === undefined || raw === '') {
            if (field.required) assignPath(out, field.name, null);
            continue;
        }
        assignPath(out, field.name, coerce(field, raw));
    }
    return out;
}

export function validate(schema: SchemaDetail | null, values: FormValues): FieldErrors {
    const errors: FieldErrors = {};
    if (!schema) return errors;
    for (const field of schema.fields) {
        const raw = values[field.name] ?? '';
        if (field.required && raw.trim() === '') {
            errors[field.name] = 'Required by the schema.';
        } else if ((field.type === 'double' || field.type === 'int') && raw && Number.isNaN(Number(raw))) {
            errors[field.name] = 'Must be a number.';
        } else if (field.type === 'int' && raw && !Number.isInteger(Number(raw))) {
            errors[field.name] = 'Must be a whole number.';
        }
    }
    return errors;
}

export interface FieldGroup {
    /// '' for top-level fields, otherwise the parent path (instrument, instrument.issuer).
    path: string;
    depth: number;
    fields: (SchemaField & { leaf: string })[];
}

/// Group dotted fields under their parent record, in schema order.
export function groupFields(schema: SchemaDetail | null): FieldGroup[] {
    const groups: FieldGroup[] = [];
    if (!schema) return groups;
    for (const field of schema.fields) {
        const parts = field.name.split('.');
        const path = parts.slice(0, -1).join('.');
        let group = groups.find((g) => g.path === path);
        if (!group) {
            group = { path, depth: parts.length - 1, fields: [] };
            groups.push(group);
        }
        group.fields.push({ ...field, leaf: parts[parts.length - 1]! });
    }
    return groups;
}

export function parseHeaders(text: string): Record<string, string> {
    const headers: Record<string, string> = {};
    for (const line of text.split('\n')) {
        const separator = line.indexOf(':');
        if (separator > 0) headers[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
    }
    return headers;
}

export const TYPE_LABEL: Record<SchemaField['type'], string> = {
    uuid: 'string · uuid',
    timestamp: 'long · timestamp-millis',
    double: 'double',
    int: 'int',
    string: 'string',
    boolean: 'boolean',
    enum: 'enum',
};
