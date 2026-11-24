import { describe, expect, it } from 'vitest';
import type { JsonValue, PayloadFormatConfig, TransformationConfig } from '@/api/types';
import {
    addStep,
    buildTransformations,
    canMove,
    deliveredFormat,
    describeFormat,
    describeStep,
    fieldPaths,
    fieldsBefore,
    formatErrors,
    hasErrors,
    moveStep,
    outputFromConfig,
    parseJsonLiteral,
    pathError,
    previewSteps,
    removeStep,
    renderOutput,
    sampleFromSchema,
    stepErrorFromMessage,
    stepsFromConfig,
    validateTransformations,
    type StepForm,
} from './transformations';

const steps = (...list: TransformationConfig[]): StepForm[] => stepsFromConfig(list);
const avroOut: PayloadFormatConfig = { type: 'avro', subject: 'out', version: 1 };
const types = (list: StepForm[]) => list.map((step) => step.type);
const json: PayloadFormatConfig = { type: 'json' };

describe('stepsFromConfig / buildTransformations', () => {
    it('round-trips every step type, the convert through the output format', () => {
        const config: TransformationConfig[] = [
            { type: 'dropFields', fields: ['internal_risk_score', 'customer.email', 'lines.internal_cost'] },
            { type: 'renameField', from: 'customer.name', to: 'customerName' },
            { type: 'defaultField', field: 'currency', value: 'EUR' },
            { type: 'defaultField', field: 'meta', value: { source: 'kawa', tags: [1, true, null] } },
            { type: 'cel', expression: '{"id": value.order_id, "skus": value.lines.map(l, l.sku)}' },
            { type: 'convert', format: { type: 'xml', onDecodeError: 'fail', root: 'order' } },
        ];

        expect(buildTransformations(stepsFromConfig(config), outputFromConfig(config))).toEqual(config);
    });

    it('keeps header steps that follow the convert, moving them before it', () => {
        const config: TransformationConfig[] = [
            { type: 'dropFields', fields: ['a'] },
            { type: 'convert', format: { type: 'json' } },
            { type: 'dropHeaders', headers: ['__TypeId__'] },
            { type: 'setHeader', header: 'content-type', value: 'application/json' },
        ];

        expect(buildTransformations(stepsFromConfig(config), outputFromConfig(config))).toEqual([
            { type: 'dropFields', fields: ['a'] },
            { type: 'dropHeaders', headers: ['__TypeId__'] },
            { type: 'setHeader', header: 'content-type', value: 'application/json' },
            { type: 'convert', format: { type: 'json' } },
        ]);
    });

    it('refuses header steps without a name', () => {
        const errors = validateTransformations(json, steps(
            { type: 'dropHeaders', headers: [] },
            { type: 'dropHeaders', headers: [' '] },
            { type: 'setHeader', header: ' ', value: 'x' },
            { type: 'setHeader', header: 'content-type', value: '' },
        ));

        expect(errors.steps).toEqual([
            ['Add at least one header to drop.'],
            ['Header names must not be blank.'],
            ['Enter a header name.'],
            [],
        ]);
    });

    it('previews header steps as leaving the value unchanged', () => {
        const preview = previewSteps({ a: 1, b: 2 }, steps(
            { type: 'setHeader', header: 'content-type', value: 'application/json' },
            { type: 'dropFields', fields: ['b'] },
        ));

        expect(preview.value).toEqual({ a: 1 });
        expect(preview.ran).toBe(2);
    });

    it('describes header steps', () => {
        expect(describeStep({ type: 'dropHeaders', headers: ['__TypeId__', 'content-type'] })).toBe('drop headers __TypeId__, content-type');
        expect(describeStep({ type: 'setHeader', header: 'content-type', value: 'application/json' }))
            .toBe('set header content-type = application/json');
    });

    it('keeps the convert out of the step list', () => {
        const config: TransformationConfig[] = [
            { type: 'cel', expression: 'value' },
            { type: 'convert', format: { type: 'json' } },
        ];

        expect(types(stepsFromConfig(config))).toEqual(['cel']);
        expect(outputFromConfig(config)).toEqual({ type: 'json' });
        expect(outputFromConfig([])).toBeNull();
    });

    it('appends the output format as the trailing convert, also without field steps', () => {
        expect(buildTransformations([], { type: 'xml', root: ' order ' }))
            .toEqual([{ type: 'convert', format: { type: 'xml', root: 'order' } }]);
        expect(buildTransformations([], null)).toEqual([]);
    });

    it('trims paths and expressions on the way out', () => {
        const form = steps({ type: 'renameField', from: ' a ', to: ' b ' }, { type: 'cel', expression: ' value ' });

        expect(buildTransformations(form)).toEqual([
            { type: 'renameField', from: 'a', to: 'b' },
            { type: 'cel', expression: 'value' },
        ]);
    });

    it('gives every step its own id', () => {
        const form = steps({ type: 'cel', expression: 'a' }, { type: 'cel', expression: 'b' });

        expect(form[0]!.id).not.toBe(form[1]!.id);
    });
});

describe('step list editing', () => {
    it('appends a new blank step', () => {
        expect(types(addStep(steps({ type: 'cel', expression: 'value' }), 'dropFields'))).toEqual(['cel', 'dropFields']);
    });

    it('moves steps within the list', () => {
        const form = steps({ type: 'dropFields', fields: ['a'] }, { type: 'cel', expression: 'value' });

        expect(canMove(form, 0, -1)).toBe(false);
        expect(canMove(form, 1, 1)).toBe(false);
        expect(types(moveStep(form, 0, 1))).toEqual(['cel', 'dropFields']);
        expect(moveStep(form, 1, 1)).toBe(form);
    });

    it('removes a step by index', () => {
        const form = steps({ type: 'cel', expression: 'a' }, { type: 'cel', expression: 'b' });

        expect(removeStep(form, 0)).toEqual([form[1]]);
    });
});

describe('validation', () => {
    const errorsOf = (valueFormat: PayloadFormatConfig | null, ...list: TransformationConfig[]) =>
        validateTransformations(valueFormat, steps(...list), outputFromConfig(list));

    it('accepts no steps without a value format', () => {
        expect(hasErrors(errorsOf(null))).toBe(false);
    });

    it('requires a value format once there are steps', () => {
        expect(errorsOf(null, { type: 'cel', expression: 'value' }).valueFormat)
            .toEqual(['Transformations need a value format to decode the value with.']);
    });

    it('accepts header steps without a value format, as they decode nothing', () => {
        expect(hasErrors(errorsOf(null, { type: 'dropHeaders', headers: ['__TypeId__'] }))).toBe(false);
        expect(hasErrors(errorsOf(null, { type: 'setHeader', header: 'content-type', value: 'application/json' }))).toBe(false);
    });

    it('does not ask for an Avro subject when header steps alone keep an Avro value format', () => {
        expect(hasErrors(errorsOf({ type: 'avro' }, { type: 'dropHeaders', headers: ['__TypeId__'] }))).toBe(false);
    });

    it('accepts a complete pipeline', () => {
        const errors = errorsOf(json,
            { type: 'dropFields', fields: ['a.b'] },
            { type: 'renameField', from: 'c', to: 'd' },
            { type: 'defaultField', field: 'e', value: 0 },
            { type: 'cel', expression: 'value' },
            { type: 'convert', format: avroOut });

        expect(hasErrors(errors)).toBe(false);
    });

    it('requires a value format for an output format alone', () => {
        expect(validateTransformations(null, [], avroOut).valueFormat)
            .toEqual(['Transformations need a value format to decode the value with.']);
    });

    it('applies the output rules to the output format', () => {
        expect(validateTransformations(json, [], { type: 'avro' }).output)
            .toEqual(['Avro output needs a subject to encode with.']);
        expect(validateTransformations(json, [], { type: 'xml' }).output)
            .toEqual(['XML output needs a root element.']);
        expect(hasErrors(validateTransformations(json, [], { type: 'xml' }))).toBe(true);
    });

    it('applies the output rules to the value format when no output format picks another', () => {
        expect(errorsOf({ type: 'avro' }, { type: 'cel', expression: 'value' }).valueFormat)
            .toEqual(['Avro output needs a subject to encode with.']);
        expect(errorsOf({ type: 'xml' }, { type: 'cel', expression: 'value' }).valueFormat)
            .toEqual(['XML output needs a root element.']);
        expect(errorsOf({ type: 'avro' }, { type: 'convert', format: json }).valueFormat).toEqual([]);
        expect(errorsOf({ type: 'avro' }).valueFormat).toEqual([]);
    });

    it('checks the Avro version and the XML root on any format', () => {
        expect(formatErrors({ type: 'avro', version: 3 }, false)).toEqual(['A version needs a subject.']);
        expect(formatErrors({ type: 'avro', subject: 's', version: 0 }, false))
            .toEqual(['The version must be a whole number of 1 or more.']);
        expect(formatErrors({ type: 'avro', subject: 's', version: 1.5 }, false))
            .toEqual(['The version must be a whole number of 1 or more.']);
        expect(formatErrors({ type: 'avro', subject: '  ' }, true)).toEqual(['The subject must not be blank.']);
        expect(formatErrors({ type: 'xml', root: ' ' }, true)).toEqual(['The root element must not be blank.']);
        expect(formatErrors({ type: 'xml', root: 'order' }, true)).toEqual([]);
    });

    it('refuses blank paths and empty segments', () => {
        expect(pathError('a.b')).toBeNull();
        expect(pathError('  ')).toBe('Enter a field path.');
        for (const path of ['a..b', '.a', 'a.']) expect(pathError(path)).toMatch(/empty segment/);
    });

    it('needs at least one field to drop, each a valid path', () => {
        expect(errorsOf(json, { type: 'dropFields', fields: [] }).steps[0]).toEqual(['Add at least one field to drop.']);
        expect(errorsOf(json, { type: 'dropFields', fields: ['a..b'] }).steps[0]).toHaveLength(1);
    });

    it('refuses a rename onto itself or along its own path', () => {
        expect(errorsOf(json, { type: 'renameField', from: 'a', to: 'a' }).steps[0]).toEqual(['From and to must differ.']);
        expect(errorsOf(json, { type: 'renameField', from: 'a', to: 'a.b' }).steps[0])
            .toEqual(['Neither path may be a dotted prefix of the other.']);
        expect(errorsOf(json, { type: 'renameField', from: 'a.b', to: 'a' }).steps[0])
            .toEqual(['Neither path may be a dotted prefix of the other.']);
        expect(errorsOf(json, { type: 'renameField', from: 'ab', to: 'a' }).steps[0]).toEqual([]);
    });

    it('needs a JSON literal as the default value', () => {
        const form = steps({ type: 'defaultField', field: 'currency', value: 'EUR' });
        form[0] = { ...form[0]!, value: 'EUR' } as StepForm;

        expect(validateTransformations(json, form).steps[0]![0]).toMatch(/text needs quotes/);
        expect(parseJsonLiteral('"EUR"')).toEqual({ ok: true, value: 'EUR' });
        expect(parseJsonLiteral('null')).toEqual({ ok: true, value: null });
        expect(parseJsonLiteral('')).toEqual({ ok: false });
    });

    it('needs a CEL expression', () => {
        expect(errorsOf(json, { type: 'cel', expression: ' ' }).steps[0]).toEqual(['Enter a CEL expression.']);
    });
});

describe('stepErrorFromMessage', () => {
    it('finds the step a gateway 400 is about', () => {
        expect(stepErrorFromMessage('transformations[2] (cel): Invalid CEL expression: undeclared reference'))
            .toEqual({ index: 2, message: 'Invalid CEL expression: undeclared reference' });
        expect(stepErrorFromMessage('transformations[0]: field path \'a.\' has an empty segment'))
            .toEqual({ index: 0, message: 'field path \'a.\' has an empty segment' });
    });

    it('returns null for a message about no single step', () => {
        expect(stepErrorFromMessage('virtual topic \'orders\' needs a valueFormat')).toBeNull();
    });
});

describe('formats', () => {
    it('delivers in the output format, else the value format', () => {
        expect(deliveredFormat(json, { type: 'xml', root: 'o' })).toEqual({ type: 'xml', root: 'o' });
        expect(deliveredFormat(json, null)).toEqual(json);
    });

    it('describes formats and steps for read-only views', () => {
        expect(describeFormat(null)).toBe('raw');
        expect(describeFormat({ type: 'avro', subject: 'orders-value', version: 3 })).toBe('Avro (orders-value v3)');
        expect(describeFormat({ type: 'xml', root: 'order' })).toBe('XML (<order>)');
        expect(describeStep({ type: 'defaultField', field: 'currency', value: 'EUR' })).toBe('default currency = "EUR"');
        expect(describeStep({ type: 'renameField', from: 'a', to: 'b' })).toBe('rename a → b');
    });
});

describe('preview', () => {
    const order: JsonValue = {
        order_id: 'o-1',
        internal_risk_score: 7,
        customer: { name: 'Ada', email: 'ada@example.com' },
        lines: [{ sku: 'A', internal_cost: 1 }, { sku: 'B', internal_cost: 2 }],
    };

    it('lists fields as dotted paths, sharing a list element path', () => {
        expect(fieldPaths(order)).toEqual([
            'order_id', 'internal_risk_score', 'customer', 'customer.name', 'customer.email',
            'lines', 'lines.sku', 'lines.internal_cost',
        ]);
        expect(fieldPaths('scalar')).toEqual([]);
    });

    it('drops fields, in every list element too', () => {
        const preview = previewSteps(order, steps({ type: 'dropFields', fields: ['internal_risk_score', 'customer.email', 'lines.internal_cost'] }));

        expect(preview.value).toEqual({
            order_id: 'o-1',
            customer: { name: 'Ada' },
            lines: [{ sku: 'A' }, { sku: 'B' }],
        });
        expect(preview.fields.filter((row) => row.change === 'dropped').map((row) => row.path))
            .toEqual(['internal_risk_score', 'customer.email', 'lines.internal_cost']);
    });

    it('renames in place within one object, keeping the field position', () => {
        const preview = previewSteps({ a: 1, b: 2, c: 3 }, steps({ type: 'renameField', from: 'b', to: 'x' }));

        expect(Object.keys(preview.value as object)).toEqual(['a', 'x', 'c']);
        expect(preview.fields).toContainEqual({ path: 'x', change: 'renamed', from: 'b' });
    });

    it('flattens and nests across levels, and renames in every list element', () => {
        expect(previewSteps(order, steps({ type: 'renameField', from: 'customer.name', to: 'customerName' })).value)
            .toMatchObject({ customer: { email: 'ada@example.com' }, customerName: 'Ada' });
        expect(previewSteps({ city: 'Ghent' }, steps({ type: 'renameField', from: 'city', to: 'address.city' })).value)
            .toEqual({ address: { city: 'Ghent' } });
        expect(previewSteps(order, steps({ type: 'renameField', from: 'lines.sku', to: 'lines.code' })).value)
            .toMatchObject({ lines: [{ code: 'A', internal_cost: 1 }, { code: 'B', internal_cost: 2 }] });
    });

    it('defaults an absent or null field, creating parents, and keeps a set one', () => {
        const preview = previewSteps(
            { currency: null, lines: [{ qty: 2 }, {}] },
            steps(
                { type: 'defaultField', field: 'currency', value: 'EUR' },
                { type: 'defaultField', field: 'meta.source', value: 'kawa' },
                { type: 'defaultField', field: 'lines.qty', value: 1 },
            ),
        );

        expect(preview.value).toEqual({ currency: 'EUR', lines: [{ qty: 2 }, { qty: 1 }], meta: { source: 'kawa' } });
        expect(preview.fields).toContainEqual({ path: 'meta.source', change: 'added', value: '"kawa"' });
    });

    it('warns about a step that matches nothing in the sample', () => {
        const preview = previewSteps(order, steps(
            { type: 'dropFields', fields: ['custmer.email'] },
            { type: 'renameField', from: 'nme', to: 'name' },
        ));

        expect(preview.notes.map((note) => note.step)).toEqual([0, 1]);
        expect(preview.notes.every((note) => !note.failure)).toBe(true);
    });

    it('reports a record the gateway would refuse, and stops there', () => {
        const preview = previewSteps({ currency: 'EUR' }, steps(
            { type: 'defaultField', field: 'currency.code', value: 'EUR' },
            { type: 'dropFields', fields: ['currency'] },
        ));

        expect(preview.notes).toEqual([expect.objectContaining({ step: 0, failure: true })]);
        expect(preview.value).toEqual({ currency: 'EUR' });
    });

    it('stops at the first CEL step', () => {
        const preview = previewSteps(order, steps(
            { type: 'dropFields', fields: ['internal_risk_score'] },
            { type: 'cel', expression: '{"id": value.order_id}' },
            { type: 'dropFields', fields: ['order_id'] },
        ));

        expect(preview.stoppedAt).toBe(1);
        expect(preview.value).not.toHaveProperty('internal_risk_score');
        expect(preview.value).toHaveProperty('order_id');
    });

    it('gives each step the fields it sees, and none after a CEL step', () => {
        const form = steps(
            { type: 'dropFields', fields: ['internal_risk_score'] },
            { type: 'cel', expression: 'value' },
            { type: 'dropFields', fields: ['x'] },
        );

        expect(fieldsBefore(order, form, 0)).toContain('internal_risk_score');
        expect(fieldsBefore(order, form, 1)).not.toContain('internal_risk_score');
        expect(fieldsBefore(order, form, 2)).toEqual([]);
        expect(fieldsBefore(undefined, form, 0)).toEqual([]);
    });

    it('seeds a sample from schema fields', () => {
        expect(sampleFromSchema([
            { name: 'id', type: 'uuid', required: true },
            { name: 'amount', type: 'double', required: true },
            { name: 'paid', type: 'boolean', required: false },
            { name: 'status', type: 'enum', required: true, symbols: ['NEW', 'PAID'] },
        ])).toEqual({ id: '', amount: 0, paid: false, status: 'NEW' });
    });
});

describe('renderOutput', () => {
    const order: JsonValue = {
        '@id': 'o-1',
        customer: { name: 'Ada & Co', '@vip': true },
        lines: [{ sku: 'A', qty: 2 }, { sku: 'B', qty: 1 }],
        note: null,
        currency: { '@code': 'EUR', '#text': '12.50' },
    };

    it('writes XML the way the gateway does: attributes, #text, repeated list elements, empty null', () => {
        expect(renderOutput(order, { type: 'xml', root: 'order' })).toEqual({
            ok: true,
            text: [
                '<order id="o-1">',
                '  <customer vip="true">',
                '    <name>Ada &amp; Co</name>',
                '  </customer>',
                '  <lines>',
                '    <sku>A</sku>',
                '    <qty>2</qty>',
                '  </lines>',
                '  <lines>',
                '    <sku>B</sku>',
                '    <qty>1</qty>',
                '  </lines>',
                '  <note/>',
                '  <currency code="EUR">12.50</currency>',
                '</order>',
            ].join('\n'),
        });
    });

    it('stands in a placeholder root until one is set', () => {
        const rendered = renderOutput({ a: '1' }, { type: 'xml' });

        expect(rendered).toMatchObject({ ok: true, text: '<root>\n  <a>1</a>\n</root>' });
        expect(rendered.ok && rendered.note).toMatch(/No root element/);
    });

    it('refuses what the gateway refuses to write as XML', () => {
        const xml: PayloadFormatConfig = { type: 'xml', root: 'order' };

        expect(renderOutput([1, 2], xml)).toMatchObject({ ok: false, error: expect.stringMatching(/whole value/) });
        expect(renderOutput({ a: [[1]] }, xml)).toMatchObject({ ok: false, error: expect.stringMatching(/list inside a list/) });
        expect(renderOutput({ '#text': 'x', b: '1' }, xml)).toMatchObject({ ok: false, error: expect.stringMatching(/mixed content/) });
        expect(renderOutput({ '1bad': 'x' }, xml)).toMatchObject({ ok: false, error: expect.stringMatching(/not a valid XML name/) });
        expect(renderOutput({ '@a': { b: 1 } }, xml)).toMatchObject({ ok: false, error: expect.stringMatching(/cannot be XML text/) });
    });

    it('writes JSON as JSON, and Avro as JSON with a note', () => {
        expect(renderOutput({ a: 1 }, { type: 'json' })).toEqual({ ok: true, text: '{\n  "a": 1\n}' });
        expect(renderOutput({ a: 1 }, { type: 'avro', subject: 'orders-value', version: 3 })).toEqual({
            ok: true,
            text: '{\n  "a": 1\n}',
            note: 'Avro binary, written with orders-value v3; shown as JSON.',
        });
    });
});
