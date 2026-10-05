/**
 * JSON Schemas derived from the same zod definitions as the validator. Kept in its own module
 * so the runtime renderer/validator does not ship zod's JSON Schema generator.
 */
import * as z from 'zod';
import { ActivityBatchSchema, ActivitySpecSchema, KEY_CHECK_FORM, type ResponseType } from './spec';

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type JsonObject = { [k: string]: Json };
const isObj = (v: Json | undefined): v is JsonObject => !!v && typeof v === 'object' && !Array.isArray(v);
/** Discriminants are disjoint, so oneOf ≡ anyOf; anyOf is the widely supported keyword for LLM structured output. */
function portable(node: Json): Json {
  if (Array.isArray(node)) return node.map(portable);
  if (isObj(node)) {
    const out: JsonObject = {};
    for (const [k, v] of Object.entries(node)) out[k === 'oneOf' ? 'anyOf' : k] = portable(v);
    return out;
  }
  return node;
}
function nullable(node: Json): Json {
  if (!isObj(node)) return node;
  if (Array.isArray(node.anyOf)) return { ...node, anyOf: [...node.anyOf, { type: 'null' }] };
  const out: JsonObject = { ...node };
  if (typeof out.type === 'string') out.type = [out.type, 'null'];
  if (Array.isArray(out.enum)) out.enum = [...out.enum, null];
  return out;
}
/**
 * OpenAI-style strict structured output: every property required (optional ones become
 * nullable), additionalProperties:false everywhere, const→enum, and length keywords removed
 * (the local validator still enforces every bound). The validator accepts null for an
 * optional field and treats it exactly as absent.
 */
function strictMode(node: Json): Json {
  if (Array.isArray(node)) return node.map(strictMode);
  if (!isObj(node)) return node;
  const out: JsonObject = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === '$schema' || k === 'minLength' || k === 'maxLength') continue;
    if (k === 'const') { out.enum = [v]; continue; }
    out[k] = k === 'properties' && isObj(v) ? Object.fromEntries(Object.entries(v).map(([pk, pv]) => [pk, strictMode(pv)])) : strictMode(v);
  }
  if (isObj(out.properties)) {
    const required = new Set(Array.isArray(node.required) ? node.required as string[] : []);
    for (const key of Object.keys(out.properties)) if (!required.has(key)) out.properties[key] = nullable(out.properties[key]!);
    out.required = Object.keys(out.properties);
    out.additionalProperties = false;
  }
  return out;
}
/**
 * Strict mode makes every property required, so an activity-level `keyCheck` could only be nullable everywhere,
 * while the validator requires it for some answer types and forbids it for the rest (KEY_CHECK_FORM). The wire
 * schema therefore moves keyCheck into the response variants: required and non-null in numeric and fraction
 * (`{value}`) and plot_point (`{x, y}`), absent from every other variant. `normalizeActivity` (spec.ts) moves it
 * back. Both keyCheck forms come from the zod KeyCheckSchema, so nothing is restated here.
 */
function keyCheckPerResponse(batch: JsonObject): JsonObject {
  const out = structuredClone(batch);
  const activity = (out.properties as JsonObject).activities as JsonObject;
  const item = activity.items as JsonObject, props = item.properties as JsonObject;
  const branches = (props.keyCheck as JsonObject).anyOf as JsonObject[];
  const has = (b: JsonObject, k: string) => isObj(b.properties) && k in b.properties;
  const value = branches.find(b => has(b, 'value')), point = branches.find(b => has(b, 'x') && has(b, 'y'));
  if (!value || !point) throw new Error('strict schema: keyCheck forms not found');
  const forms = { value, point };
  delete props.keyCheck;
  item.required = (item.required as string[]).filter(k => k !== 'keyCheck');
  for (const variant of (props.response as JsonObject).anyOf as JsonObject[]) {
    const type = ((variant.properties as JsonObject).type as JsonObject).enum as string[];
    const form = KEY_CHECK_FORM[type[0] as ResponseType];
    if (type.length !== 1 || form === undefined) throw new Error('strict schema: unknown response variant');
    if (!form) continue;
    (variant.properties as JsonObject).keyCheck = structuredClone(forms[form]);
    variant.required = [...(variant.required as string[]), 'keyCheck'];
  }
  return out;
}
const draft = (schema: z.ZodType) => portable(z.toJSONSchema(schema, { target: 'draft-2020-12' }) as Json) as JsonObject;
/** Standard JSON Schema (draft 2020-12) for one activity / a batch. Documentation + generic tooling. */
export const activitySpecJsonSchema = draft(ActivitySpecSchema);
export const activityBatchJsonSchema = draft(ActivityBatchSchema);
/**
 * Strict-mode wire schema, sent as response_format {type:'json_schema', json_schema:{name:'aha_activity_batch', schema, strict:true}}.
 * Derived from the zod definitions; `normalizeActivity` maps its instances onto the validator's shape.
 */
export const activityBatchStrictJsonSchema = keyCheckPerResponse(strictMode(activityBatchJsonSchema) as JsonObject);

