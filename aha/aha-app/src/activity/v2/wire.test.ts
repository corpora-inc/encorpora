import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateSync, type JsonSchema } from 'json-schema-faker';
import { MAX_SCHEMA_BYTES, strictBatchSchema } from './schema';
import { BAND_IDS, BANDS, overlaps, type Band } from './registry';
import { STRUCTURES } from './structures';
import { bandWire } from './wire';

type Node = Record<string, any>;
/** Every object schema in a JSON schema, with its path. */
function objects(node: any, path = '$', out: { path: string; node: Node }[] = []) {
  if (Array.isArray(node)) node.forEach((x, i) => objects(x, `${path}[${i}]`, out));
  else if (node && typeof node === 'object') {
    if (node.properties) out.push({ path, node });
    for (const [k, v] of Object.entries(node)) objects(v, k === 'properties' ? path : `${path}.${k}`, out);
  }
  return out;
}

describe('strict wire schema', () => {
  for (const band of BAND_IDS) {
    const schema = strictBatchSchema(band);
    it(`${band}: declared key order is alphabetical, keys are single lowercase words, at every level`, () => {
      const objs = objects(schema);
      assert.ok(objs.length > 15, 'walked the nested objects');
      for (const { path, node } of objs) {
        const keys = Object.keys(node.properties);
        for (const k of keys) assert.match(k, /^[a-z]+$/, `${path}.${k}: one lowercase word, so byte order and every collation agree`);
        assert.deepEqual(keys, [...keys].sort(), `${path}: declared order (followed when the gateway preserves order) must equal sorted order (followed when it sorts)`);
        assert.deepEqual(keys, [...keys].sort((a, b) => a.localeCompare(b)), `${path}: locale collation agrees`);
        assert.deepEqual(node.required, keys, `${path}: every key required, in the same order`);
        assert.equal(node.additionalProperties, false, path);
      }
    });
    it(`${band}: fits the ${MAX_SCHEMA_BYTES / 1024} KiB budget`, () => {
      const bytes = new TextEncoder().encode(JSON.stringify(schema)).length;
      assert.ok(bytes <= MAX_SCHEMA_BYTES, `${bytes} bytes`);
    });
    it(`${band}: carries exactly the structures, views and forms of its grades`, () => {
      const text = JSON.stringify(schema);
      for (const [kind, def] of Object.entries(STRUCTURES)) {
        assert.equal(text.includes(`"kind":{"type":"string","enum":["${kind}"]}`), overlaps(def.grades, BANDS[band]), `${band} ${kind}`);
      }
      assert.equal(schema.type, 'object', 'anyOf only below the root');
      assert.ok(!text.includes('"oneOf"') && !text.includes('"$ref"') && !text.includes('minLength') && !text.includes('maxLength'));
    });
  }
  it('drops off-band views from a structure', () => {
    const k2 = JSON.stringify(strictBatchSchema('k2')), g68 = JSON.stringify(strictBatchSchema('g68'));
    assert.ok(k2.includes('"unit_squares"') && !k2.includes('"labeled"'), 'rect_area in K–2 has only unit squares');
    assert.ok(g68.includes('"labeled"') && !g68.includes('"unit_squares"'), 'rect_area in 6–8 is labeled only');
    assert.ok(!k2.includes('"set"') && !k2.includes('"line"') && k2.includes('"strip"'), 'K–2 fractions: rect, circle, strip');
    assert.ok(!k2.includes('"fraction","form"') && !g68.includes('"shade"'));
  });
});

/** Free text (no pattern or enum) becomes a short word, so generated instances respect the length limits the schema cannot carry. */
function shortText(node: any): any {
  if (Array.isArray(node)) node.forEach(shortText);
  else if (node && typeof node === 'object') {
    for (const v of Object.values(node)) shortText(v);
    const types = Array.isArray(node.type) ? node.type : [node.type];
    if (types.includes('string') && !node.pattern && !node.enum) node.pattern = '^[a-z]{1,8}$';
  }
  return node;
}

describe('strict schema and zod wire schema agree', () => {
  for (const band of BAND_IDS as Band[]) {
    it(`${band}: 200 generated strict instances pass the zod wire schema`, () => {
      const generator = shortText(structuredClone(strictBatchSchema(band))) as JsonSchema;
      const failures: string[] = [];
      let activities = 0;
      for (let i = 0; i < 200; i++) {
        const batch = generateSync(generator, { seed: i + 1, maxDepth: 32 }) as Node;
        for (const a of batch.activities) {
          activities++;
          const r = bandWire(band).activity.safeParse(a);
          if (!r.success) failures.push(r.error.issues.map(x => `${x.path.join('.')}: ${x.message}`).join('; '));
        }
      }
      assert.ok(activities >= 200);
      assert.deepEqual(failures.slice(0, 5), [], `${failures.length} of ${activities} drifted`);
    });
  }
});
