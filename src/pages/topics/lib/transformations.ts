import type { JsonValue, PayloadFormatConfig, SchemaField, TransformationConfig } from '@/api/types';

/// A step as the editor holds it: a field step or a header step. `id` keys the step card across reorders; a default's value
/// is the JSON text the operator typed, parsed only when saving.
///
/// The gateway's `convert` step is not a step here: the editor shows the output format as its own
/// block, and [buildTransformations] appends it as the trailing `convert` the gateway expects.
/// Header steps may sit anywhere: they only touch headers, and never decode the value.
///
/// `errorHeader` is whether a record the step fails on, delivered anyway under
/// `onDecodeError: include`, carries the `kawa-error` headers; on by default. Header steps never
/// fail, so theirs is only carried through.
export type StepForm = { id: number; errorHeader: boolean } & (
    | { type: 'dropFields'; fields: string[] }
    | { type: 'renameField'; from: string; to: string }
    | { type: 'defaultField'; field: string; value: string }
    | { type: 'cel'; expression: string }
    | { type: 'dropHeaders'; headers: string[] }
    | { type: 'setHeader'; header: string; value: string });

export type StepType = StepForm['type'];

export const STEP_TYPES: readonly { type: StepType; label: string; hint: string }[] = [
    { type: 'dropFields', label: 'Drop fields', hint: 'Remove fields from the value' },
    { type: 'renameField', label: 'Rename field', hint: 'Move a field, keeping its value' },
    { type: 'defaultField', label: 'Default field', hint: 'Set a field when it is absent or null' },
    { type: 'cel', label: 'CEL expression', hint: 'Replace the whole value with the result of an expression' },
    { type: 'dropHeaders', label: 'Drop headers', hint: 'Remove headers that describe the stored format' },
    { type: 'setHeader', label: 'Set header', hint: 'Set a header, e.g. content-type of the delivered format' },
];

/// Header steps change the headers of the records a topic delivers, never the value.
export const isHeaderStep = (step: StepForm): step is Extract<StepForm, { type: 'dropHeaders' | 'setHeader' }> =>
    step.type === 'dropHeaders' || step.type === 'setHeader';

export const stepLabel = (type: StepType): string =>
    STEP_TYPES.find((entry) => entry.type === type)?.label ?? type;

let lastId = 0;
const nextId = (): number => ++lastId;

export function blankStep(type: StepType): StepForm {
    switch (type) {
        case 'dropFields': return { id: nextId(), errorHeader: true, type, fields: [] };
        case 'renameField': return { id: nextId(), errorHeader: true, type, from: '', to: '' };
        case 'defaultField': return { id: nextId(), errorHeader: true, type, field: '', value: '' };
        case 'cel': return { id: nextId(), errorHeader: true, type, expression: '' };
        case 'dropHeaders': return { id: nextId(), errorHeader: true, type, headers: [] };
        case 'setHeader': return { id: nextId(), errorHeader: true, type, header: '', value: '' };
    }
}

const isFieldStep = (step: TransformationConfig): step is Exclude<TransformationConfig, { type: 'convert' }> =>
    step.type !== 'convert';

/// The field and header steps of a stored pipeline, without its `convert`.
export function stepsFromConfig(list: TransformationConfig[] | null | undefined): StepForm[] {
    return (list ?? []).filter(isFieldStep).map((step): StepForm => {
        const errorHeader = step.errorHeader !== false;
        switch (step.type) {
            case 'dropFields': return { id: nextId(), errorHeader, type: step.type, fields: [...step.fields] };
            case 'renameField': return { id: nextId(), errorHeader, type: step.type, from: step.from, to: step.to };
            case 'defaultField': return { id: nextId(), errorHeader, type: step.type, field: step.field, value: JSON.stringify(step.value ?? null) };
            case 'cel': return { id: nextId(), errorHeader, type: step.type, expression: step.expression };
            case 'dropHeaders': return { id: nextId(), errorHeader, type: step.type, headers: [...step.headers] };
            case 'setHeader': return { id: nextId(), errorHeader, type: step.type, header: step.header, value: step.value };
        }
    });
}

/// Whether a stored pipeline's `convert` step leaves the `kawa-error` headers on; true without one.
export function outputErrorHeaderFromConfig(list: TransformationConfig[] | null | undefined): boolean {
    return (list ?? []).find((step) => step.type === 'convert')?.errorHeader !== false;
}

/// The wire form of an `errorHeader` setting: only `false` is sent, on being the default.
export const errorHeaderSetting = (errorHeader: boolean): { errorHeader?: false } =>
    errorHeader ? {} : { errorHeader: false };

/// The output format of a stored pipeline: its `convert` step's format, or null without one.
export function outputFromConfig(list: TransformationConfig[] | null | undefined): PayloadFormatConfig | null {
    const convert = (list ?? []).find((step) => step.type === 'convert');
    return convert?.type === 'convert' ? { ...convert.format } : null;
}

/// The wire form of a format: optional fields trimmed, and omitted when unset or blank. The keys
/// keep a fixed order, so two equal formats serialize identically.
export function buildFormat(format: PayloadFormatConfig): PayloadFormatConfig {
    const onDecodeError = format.onDecodeError ? { onDecodeError: format.onDecodeError } : {};
    switch (format.type) {
        case 'json':
            return { type: 'json', ...onDecodeError };
        case 'avro': {
            const subject = format.subject?.trim();
            return {
                type: 'avro',
                ...onDecodeError,
                ...(subject ? { subject } : {}),
                ...(format.version != null ? { version: format.version } : {}),
            };
        }
        case 'xml': {
            const root = format.root?.trim();
            return { type: 'xml', ...onDecodeError, ...(root ? { root } : {}) };
        }
    }
}

/// The wire form of the pipeline: the field steps, then a `convert` step when an output format is
/// set, with `outputErrorHeader` as its setting. Expects input that passed
/// [validateTransformations]; a default that is not valid JSON is sent as null.
export function buildTransformations(
    steps: StepForm[],
    output: PayloadFormatConfig | null = null,
    outputErrorHeader = true,
): TransformationConfig[] {
    const built = steps.map((step): TransformationConfig => {
        const setting = errorHeaderSetting(step.errorHeader);
        switch (step.type) {
            case 'dropFields': return { type: step.type, fields: step.fields.map((field) => field.trim()), ...setting };
            case 'renameField': return { type: step.type, from: step.from.trim(), to: step.to.trim(), ...setting };
            case 'defaultField': {
                const parsed = parseJsonLiteral(step.value);
                return { type: step.type, field: step.field.trim(), value: parsed.ok ? parsed.value : null, ...setting };
            }
            case 'cel': return { type: step.type, expression: step.expression.trim(), ...setting };
            case 'dropHeaders': return { type: step.type, headers: step.headers.map((header) => header.trim()), ...setting };
            // the value is sent as typed: spaces in a header value are the operator's
            case 'setHeader': return { type: step.type, header: step.header.trim(), value: step.value, ...setting };
        }
    });
    return output
        ? [...built, { type: 'convert', format: buildFormat(output), ...errorHeaderSetting(outputErrorHeader) }]
        : built;
}

export const addStep = (steps: StepForm[], type: StepType): StepForm[] => [...steps, blankStep(type)];

/// Whether the step at `index` can move by `delta` (±1) and stay in the list.
export function canMove(steps: StepForm[], index: number, delta: -1 | 1): boolean {
    const target = index + delta;
    return target >= 0 && target < steps.length;
}

export function moveStep(steps: StepForm[], index: number, delta: -1 | 1): StepForm[] {
    if (!canMove(steps, index, delta)) return steps;
    const moved = [...steps];
    [moved[index], moved[index + delta]] = [moved[index + delta]!, moved[index]!];
    return moved;
}

export const removeStep = (steps: StepForm[], index: number): StepForm[] =>
    steps.filter((_, at) => at !== index);

// ── Validation: mirrors the gateway's rules, so a save the gateway refuses is blocked here ──

export type JsonParse = { ok: true; value: JsonValue } | { ok: false };

export function parseJsonLiteral(text: string): JsonParse {
    if (!text.trim()) return { ok: false };
    try {
        return { ok: true, value: JSON.parse(text) as JsonValue };
    } catch {
        return { ok: false };
    }
}

/// Why a dotted field path is refused, or null when it is fine. Checked trimmed, as it is sent.
export function pathError(path: string): string | null {
    const trimmed = path.trim();
    if (!trimmed) return 'Enter a field path.';
    if (trimmed.split('.').some((segment) => !segment)) {
        return `“${trimmed}” has an empty segment (a..b, .a and a. are refused).`;
    }
    return null;
}

/// The format's own rules, plus the output rules when it is the format transformed values are
/// encoded in: Avro needs a subject, XML a root element.
export function formatErrors(format: PayloadFormatConfig, isOutput: boolean): string[] {
    const errors: string[] = [];
    if (format.type === 'avro') {
        const hasSubject = !!format.subject?.trim();
        if (format.subject !== undefined && !hasSubject) errors.push('The subject must not be blank.');
        if (format.version != null) {
            if (!Number.isInteger(format.version) || format.version < 1) errors.push('The version must be a whole number of 1 or more.');
            if (!hasSubject) errors.push('A version needs a subject.');
        }
        if (isOutput && format.subject === undefined) errors.push('Avro output needs a subject to encode with.');
    }
    if (format.type === 'xml') {
        if (format.root !== undefined && !format.root.trim()) errors.push('The root element must not be blank.');
        else if (isOutput && format.root === undefined) errors.push('XML output needs a root element.');
    }
    return errors;
}

export interface TransformationErrors {
    /// About the virtual topic's value format.
    valueFormat: string[];
    /// About the output format.
    output: string[];
    /// Per step, by index.
    steps: string[][];
}

const isPrefixPath = (path: string, of: string): boolean => of.startsWith(path + '.');

function stepErrors(step: StepForm): string[] {
    const errors: string[] = [];
    const path = (value: string) => {
        const error = pathError(value);
        if (error) errors.push(error);
    };
    switch (step.type) {
        case 'dropFields':
            if (step.fields.length === 0) errors.push('Add at least one field to drop.');
            step.fields.forEach(path);
            break;
        case 'renameField': {
            path(step.from);
            path(step.to);
            const from = step.from.trim();
            const to = step.to.trim();
            if (from && to && from === to) errors.push('From and to must differ.');
            else if (from && to && (isPrefixPath(from, to) || isPrefixPath(to, from))) {
                errors.push('Neither path may be a dotted prefix of the other.');
            }
            break;
        }
        case 'defaultField':
            path(step.field);
            if (!parseJsonLiteral(step.value).ok) {
                errors.push('Enter a JSON value: text needs quotes ("EUR"); numbers, true, false, null, lists and objects as is.');
            }
            break;
        case 'cel':
            if (!step.expression.trim()) errors.push('Enter a CEL expression.');
            break;
        case 'dropHeaders':
            if (step.headers.length === 0) errors.push('Add at least one header to drop.');
            if (step.headers.some((header) => !header.trim())) errors.push('Header names must not be blank.');
            break;
        case 'setHeader':
            if (!step.header.trim()) errors.push('Enter a header name.');
            break;
    }
    return errors;
}

/// An output format is a transformation too (the gateway's `convert`), so it also needs a value
/// format to decode with.
export function validateTransformations(
    valueFormat: PayloadFormatConfig | null,
    steps: StepForm[],
    output: PayloadFormatConfig | null = null,
): TransformationErrors {
    // Only value steps and an output format decode and re-encode the value; header steps alone do not.
    const reencodes = !!output || steps.some((step) => !isHeaderStep(step));
    const valueFormatErrors: string[] = [];
    if (reencodes && !valueFormat) {
        valueFormatErrors.push('Transformations need a value format to decode the value with.');
    }
    if (valueFormat) {
        // The value format is the output format unless another one is picked.
        valueFormatErrors.push(...formatErrors(valueFormat, reencodes && !output));
    }
    return {
        valueFormat: valueFormatErrors,
        output: output ? formatErrors(output, true) : [],
        steps: steps.map(stepErrors),
    };
}

export const hasErrors = (errors: TransformationErrors): boolean =>
    errors.valueFormat.length > 0 || errors.output.length > 0 || errors.steps.some((list) => list.length > 0);

/// The step a gateway 400 is about: its `error` starts with `transformations[N]`, optionally followed
/// by the step type in parentheses. Null when the message concerns no single step.
export function stepErrorFromMessage(message: string): { index: number; message: string } | null {
    const match = /^transformations\[(\d+)\]\s*(?:\([^)]*\))?\s*:?\s*([\s\S]*)$/.exec(message);
    if (!match) return null;
    return { index: Number(match[1]), message: match[2]!.trim() || message };
}

/// The format transformed values are delivered in: the output format, else the value format.
export const deliveredFormat = (valueFormat: PayloadFormatConfig | null, output: PayloadFormatConfig | null): PayloadFormatConfig | null =>
    output ?? valueFormat;

export function describeFormat(format: PayloadFormatConfig | null): string {
    if (!format) return 'raw';
    switch (format.type) {
        case 'json': return 'JSON';
        case 'avro': return format.subject
            ? `Avro (${format.subject}${format.version != null ? ` v${format.version}` : ''})`
            : 'Avro';
        case 'xml': return format.root ? `XML (<${format.root}>)` : 'XML';
    }
}

/// One line per step, for read-only views.
export function describeStep(step: TransformationConfig): string {
    switch (step.type) {
        case 'dropFields': return `drop ${step.fields.join(', ')}`;
        case 'renameField': return `rename ${step.from} → ${step.to}`;
        case 'defaultField': return `default ${step.field} = ${JSON.stringify(step.value ?? null)}`;
        case 'cel': return `cel ${step.expression}`;
        case 'convert': return `convert to ${describeFormat(step.format)}`;
        case 'dropHeaders': return `drop headers ${step.headers.join(', ')}`;
        case 'setHeader': return `set header ${step.header} = ${step.value}`;
    }
}

// ── Preview: the field steps applied to a sample value in the browser ──
//
// The edits mirror the gateway's TreePaths: a list on the path is mapped over (for a rename only on
// the part both paths share), a missing object leaves the value unchanged, and a default creates
// missing parents. CEL runs only in the gateway, so the preview stops at the first CEL step.

type JsonObject = { [key: string]: JsonValue };

const isObject = (value: JsonValue | undefined): value is JsonObject =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const has = (object: JsonObject, key: string): boolean => Object.hasOwn(object, key);

/// A record the gateway's step would refuse (a list or scalar in the way).
class StepFailure extends Error {}

function editObjects(
    node: JsonValue,
    path: string[],
    create: boolean,
    mapLists: boolean,
    edit: (object: JsonObject) => JsonObject,
    depth = 0,
): JsonValue {
    if (Array.isArray(node)) {
        if (!mapLists) throw new StepFailure(`“${path.slice(0, depth).join('.')}” is a list`);
        return node.map((element) => editObjects(element, path, create, mapLists, edit, depth));
    }
    if (!isObject(node)) {
        if (create) throw new StepFailure(`“${depth === 0 ? 'value' : path.slice(0, depth).join('.')}” is not an object`);
        return node;
    }
    if (depth === path.length) return edit(node);
    const segment = path[depth]!;
    const child = has(node, segment) ? node[segment]! : null;
    if (child === null) {
        if (!create) return node;
        return { ...node, [segment]: editObjects({}, path, create, mapLists, edit, depth + 1) };
    }
    return { ...node, [segment]: editObjects(child, path, create, mapLists, edit, depth + 1) };
}

function getAt(object: JsonObject, path: string[]): JsonValue | undefined {
    let node: JsonValue = object;
    for (let i = 0; i < path.length; i++) {
        if (Array.isArray(node)) throw new StepFailure(`“${path.slice(0, i).join('.')}” is a list`);
        if (!isObject(node) || !has(node, path[i]!)) return undefined;
        node = node[path[i]!]!;
    }
    return node;
}

function without(object: JsonObject, key: string): JsonObject {
    const copy = { ...object };
    delete copy[key];
    return copy;
}

function renamed(object: JsonObject, from: string, to: string): JsonObject {
    const copy: JsonObject = {};
    for (const [key, value] of Object.entries(object)) {
        if (key === from) copy[to] = value;
        else if (key !== to) copy[key] = value;
    }
    return copy;
}

interface Applied {
    value: JsonValue;
    /// Whether the step found anything to change.
    matched: boolean;
}

function applyDrop(value: JsonValue, paths: string[][]): Applied {
    let matched = false;
    let result = value;
    for (const path of paths) {
        const field = path.at(-1)!;
        result = editObjects(result, path.slice(0, -1), false, true, (object) => {
            if (!has(object, field)) return object;
            matched = true;
            return without(object, field);
        });
    }
    return { value: result, matched };
}

function applyRename(value: JsonValue, fromPath: string[], toPath: string[]): Applied {
    let common = 0;
    while (common < Math.min(fromPath.length, toPath.length) - 1 && fromPath[common] === toPath[common]) common++;
    const shared = fromPath.slice(0, common);
    const from = fromPath.slice(common);
    const to = toPath.slice(common);
    let matched = false;
    const result = editObjects(value, shared, false, true, (object) => {
        if (from.length === 1 && to.length === 1) {
            if (!has(object, from[0]!)) return object;
            matched = true;
            return renamed(object, from[0]!, to[0]!);
        }
        const source = getAt(object, from.slice(0, -1));
        if (Array.isArray(source)) throw new StepFailure(`“${from.slice(0, -1).join('.')}” is a list`);
        if (!isObject(source) || !has(source, from.at(-1)!)) return object;
        matched = true;
        const moved = source[from.at(-1)!]!;
        const removed = editObjects(object, from.slice(0, -1), false, false, (parent) => without(parent, from.at(-1)!));
        return editObjects(removed, to.slice(0, -1), true, false, (parent) => ({ ...parent, [to.at(-1)!]: moved })) as JsonObject;
    });
    return { value: result, matched };
}

function applyDefault(value: JsonValue, path: string[], defaultValue: JsonValue): Applied {
    const field = path.at(-1)!;
    let matched = false;
    const result = editObjects(value, path.slice(0, -1), true, true, (object) => {
        if (has(object, field) && object[field] !== null) return object;
        matched = true;
        return { ...object, [field]: structuredClone(defaultValue) };
    });
    return { value: result, matched };
}

/// The dotted paths of every field in `value`; the elements of a list share their list's path, as
/// in a step's path. A value that is not an object has no fields.
export function fieldPaths(value: JsonValue): string[] {
    const paths = new Set<string>();
    const walk = (node: JsonValue, prefix: string): void => {
        if (Array.isArray(node)) {
            node.forEach((element) => walk(element, prefix));
            return;
        }
        if (!isObject(node)) return;
        for (const [key, child] of Object.entries(node)) {
            const path = prefix ? `${prefix}.${key}` : key;
            paths.add(path);
            walk(child, path);
        }
    };
    walk(value, '');
    return [...paths];
}

export interface StepNote {
    step: number;
    message: string;
    /// The gateway would refuse this record at this step, rather than just a likely typo.
    failure?: boolean;
}

export interface FieldRow {
    path: string;
    change: 'kept' | 'renamed' | 'added' | 'dropped';
    /// The path the field had in the sample, for a renamed field.
    from?: string;
    /// The default set, for an added field.
    value?: string;
}

export interface Preview {
    /// The value after the steps that ran.
    value: JsonValue;
    /// How many steps ran: up to the first CEL step, a failing step or the end.
    ran: number;
    /// The first CEL step, where the browser stops; null when there is none before the end.
    stoppedAt: number | null;
    notes: StepNote[];
    fields: FieldRow[];
}

const splitPath = (path: string): string[] => path.trim().split('.');

/// Applies the steps before `upto` (all by default) to `sample`. A step with validation errors is
/// skipped: its card already says what is wrong.
export function previewSteps(sample: JsonValue, steps: StepForm[], upto = steps.length): Preview {
    const before = fieldPaths(sample);
    const notes: StepNote[] = [];
    const renames: { from: string; to: string }[] = [];
    const defaults = new Map<string, string>();
    let value = sample;
    let ran = 0;
    let stoppedAt: number | null = null;

    for (let index = 0; index < upto; index++) {
        const step = steps[index]!;
        if (step.type === 'cel') {
            stoppedAt = index;
            break;
        }
        if (isHeaderStep(step) || stepErrors(step).length > 0) {
            // header steps leave the value as it is; a step with errors is skipped
            ran = index + 1;
            continue;
        }
        try {
            if (step.type === 'dropFields') {
                const applied = applyDrop(value, step.fields.map(splitPath));
                value = applied.value;
                if (!applied.matched) notes.push({ step: index, message: 'None of these fields is in the sample.' });
            } else if (step.type === 'renameField') {
                const applied = applyRename(value, splitPath(step.from), splitPath(step.to));
                value = applied.value;
                if (applied.matched) renames.push({ from: step.from.trim(), to: step.to.trim() });
                else notes.push({ step: index, message: `“${step.from.trim()}” is not in the sample, so nothing is renamed.` });
            } else if (step.type === 'defaultField') {
                const parsed = parseJsonLiteral(step.value);
                const applied = applyDefault(value, splitPath(step.field), parsed.ok ? parsed.value : null);
                value = applied.value;
                if (applied.matched) defaults.set(step.field.trim(), step.value.trim());
            }
            ran = index + 1;
        } catch (cause) {
            if (!(cause instanceof StepFailure)) throw cause;
            notes.push({ step: index, message: `The gateway would refuse this record here: ${cause.message}.`, failure: true });
            break;
        }
    }

    return { value, ran, stoppedAt, notes, fields: fieldRows(before, fieldPaths(value), renames, defaults) };
}

function fieldRows(
    before: string[],
    after: string[],
    renames: { from: string; to: string }[],
    defaults: Map<string, string>,
): FieldRow[] {
    const had = new Set(before);
    const now = new Set(after);
    const under = (path: string, root: string) => path === root || path.startsWith(root + '.');
    const rows: FieldRow[] = after.map((path) => {
        if (had.has(path)) return { path, change: 'kept' };
        const rename = [...renames].reverse().find((entry) => under(path, entry.to));
        if (rename) return { path, change: 'renamed', from: rename.from + path.slice(rename.to.length) };
        return defaults.has(path) ? { path, change: 'added', value: defaults.get(path) } : { path, change: 'added' };
    });
    for (const path of before) {
        if (now.has(path) || renames.some((entry) => under(path, entry.from))) continue;
        rows.push({ path, change: 'dropped' });
    }
    return rows;
}

/// The fields a step at `index` sees: the sample with the steps before it applied. Empty without a
/// sample, and after a CEL step, whose result is unknown here.
export function fieldsBefore(sample: JsonValue | undefined, steps: StepForm[], index: number): string[] {
    if (sample === undefined) return [];
    const preview = previewSteps(sample, steps, index);
    return preview.stoppedAt === null && preview.ran === index ? fieldPaths(preview.value) : [];
}

/// A sample value with one placeholder per schema field, to start the preview from.
export function sampleFromSchema(fields: SchemaField[]): JsonObject {
    const placeholder = (field: SchemaField): JsonValue => {
        switch (field.type) {
            case 'int':
            case 'double':
            case 'timestamp':
                return 0;
            case 'boolean':
                return false;
            case 'enum':
                return field.symbols?.[0] ?? '';
            default:
                return '';
        }
    };
    return Object.fromEntries(fields.map((field) => [field.name, placeholder(field)]));
}

// ── Rendering the preview value as the output format writes it ──

export type RenderedOutput =
    | { ok: true; text: string; note?: string }
    | { ok: false; error: string };

const XML_NAME = /^[\p{L}_][\p{L}\p{N}_.-]*(:[\p{L}_][\p{L}\p{N}_.-]*)?$/u;

const escapeXml = (text: string, attribute = false): string => {
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return attribute ? escaped.replace(/"/g, '&quot;') : escaped;
};

/// Refused like the gateway's XmlPayloadEncoder refuses it, so the preview never shows XML the
/// gateway would not write.
class XmlRefused extends Error {}

function xmlName(name: string, path: string): string {
    if (!XML_NAME.test(name)) throw new XmlRefused(`“${name}” at ${path} is not a valid XML name`);
    return name;
}

function xmlText(value: JsonValue, path: string): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    throw new XmlRefused(`${value === null ? 'null' : Array.isArray(value) ? 'a list' : 'an object'} at ${path} cannot be XML text`);
}

/// The gateway's XML mapping, indented for reading: `@name` keys are attributes, `#text` the
/// element text, a list repeats its element, null is an empty element.
function xmlElement(name: string, value: JsonValue, path: string, indent: string): string[] {
    if (Array.isArray(value)) throw new XmlRefused(`a list inside a list at ${path} cannot be XML`);
    if (value === null) return [`${indent}<${name}/>`];
    if (!isObject(value)) return [`${indent}<${name}>${escapeXml(xmlText(value, path))}</${name}>`];

    const entries = Object.entries(value);
    const attributes = entries
        .filter(([key]) => key.startsWith('@'))
        .map(([key, attr]) => ` ${xmlName(key.slice(1), `${path}/${key}`)}="${escapeXml(xmlText(attr, `${path}/${key}`), true)}"`)
        .join('');
    const children = entries.filter(([key]) => !key.startsWith('@') && key !== '#text');
    const open = `${indent}<${name}${attributes}`;

    if (has(value, '#text')) {
        if (children.length) throw new XmlRefused(`“#text” next to child elements at ${path} (mixed content) cannot be XML`);
        return [`${open}>${escapeXml(xmlText(value['#text']!, `${path}/#text`))}</${name}>`];
    }
    if (!children.length) return [`${open}></${name}>`];

    const lines = [`${open}>`];
    for (const [key, child] of children) {
        const childPath = `${path}/${key}`;
        xmlName(key, childPath);
        for (const item of Array.isArray(child) ? child : [child]) {
            lines.push(...xmlElement(key, item, childPath, indent + '  '));
        }
    }
    lines.push(`${indent}</${name}>`);
    return lines;
}

/// The value as the output format encodes it. JSON is indented for reading (the gateway writes it
/// compact); Avro is binary, so it is shown as JSON.
export function renderOutput(value: JsonValue, format: PayloadFormatConfig | null): RenderedOutput {
    if (format?.type === 'xml') {
        const root = format.root?.trim() || 'root';
        try {
            if (Array.isArray(value)) throw new XmlRefused('a list as the whole value cannot be XML: a document has one root element');
            return {
                ok: true,
                text: xmlElement(xmlName(root, root), value, root, '').join('\n'),
                ...(format.root?.trim() ? {} : { note: 'No root element set yet: shown as <root>.' }),
            };
        } catch (cause) {
            if (cause instanceof XmlRefused) return { ok: false, error: `The gateway would refuse this record: ${cause.message}.` };
            throw cause;
        }
    }
    const text = JSON.stringify(value, null, 2);
    if (format?.type === 'avro') {
        const schema = format.subject ? `, written with ${format.subject}${format.version != null ? ` v${format.version}` : ''}` : '';
        return { ok: true, text, note: `Avro binary${schema}; shown as JSON.` };
    }
    return { ok: true, text };
}
