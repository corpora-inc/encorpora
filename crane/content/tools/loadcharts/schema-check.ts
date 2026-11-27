// A tiny JSON Schema subset validator, enough for schema.json, so the chart
// tests need no dependencies. Supports: type (incl. integer, null, arrays of
// types), const, enum, pattern, minLength, minimum, minItems, items,
// properties, required, additionalProperties: false, and local $ref.

export type Schema = { [k: string]: unknown };

function typeOf(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

function matchesType(v: unknown, t: string): boolean {
  const actual = typeOf(v);
  if (t === 'number') return actual === 'number' || actual === 'integer';
  return actual === t;
}

function resolve(root: Schema, ref: string): Schema {
  if (!ref.startsWith('#/')) throw new Error(`schema-check: only local refs, got ${ref}`);
  let node: unknown = root;
  for (const part of ref.slice(2).split('/')) node = (node as Schema)[part];
  if (!node || typeof node !== 'object') throw new Error(`schema-check: bad ref ${ref}`);
  return node as Schema;
}

export function validate(root: Schema, value: unknown): string[] {
  const errors: string[] = [];
  const walk = (s: Schema, v: unknown, path: string): void => {
    if (typeof s.$ref === 'string') return walk(resolve(root, s.$ref), v, path);
    if (s.type !== undefined) {
      const types = Array.isArray(s.type) ? (s.type as string[]) : [s.type as string];
      if (!types.some((t) => matchesType(v, t))) {
        errors.push(`${path}: expected ${types.join('|')}, got ${typeOf(v)}`);
        return;
      }
    }
    if ('const' in s && v !== s.const) errors.push(`${path}: expected ${JSON.stringify(s.const)}`);
    if (Array.isArray(s.enum) && !s.enum.includes(v)) errors.push(`${path}: ${JSON.stringify(v)} not in enum`);
    if (typeof v === 'string') {
      if (typeof s.minLength === 'number' && v.length < s.minLength) errors.push(`${path}: shorter than ${s.minLength}`);
      if (typeof s.pattern === 'string' && !new RegExp(s.pattern).test(v)) errors.push(`${path}: does not match ${s.pattern}`);
    }
    if (typeof v === 'number' && typeof s.minimum === 'number' && v < s.minimum) errors.push(`${path}: below ${s.minimum}`);
    if (Array.isArray(v)) {
      if (typeof s.minItems === 'number' && v.length < s.minItems) errors.push(`${path}: fewer than ${s.minItems} items`);
      if (s.items && typeof s.items === 'object') v.forEach((x, i) => walk(s.items as Schema, x, `${path}[${i}]`));
    }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const obj = v as Record<string, unknown>;
      const props = (s.properties ?? {}) as Record<string, Schema>;
      if (Array.isArray(s.required)) for (const k of s.required as string[]) if (!(k in obj)) errors.push(`${path}: missing ${k}`);
      for (const [k, x] of Object.entries(obj)) {
        if (props[k]) walk(props[k], x, `${path}.${k}`);
        else if (s.additionalProperties === false) errors.push(`${path}: unexpected property ${k}`);
      }
    }
  };
  walk(root, value, '$');
  return errors;
}
