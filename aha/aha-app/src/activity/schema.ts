/**
 * JSON Schemas derived from the same zod definitions as the validator. Kept in its own module
 * so the runtime renderer/validator does not ship zod's JSON Schema generator.
 */
import * as z from 'zod';
import { ActivityBatchSchema, ActivitySpecSchema } from './spec';

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
const draft = (schema: z.ZodType) => portable(z.toJSONSchema(schema, { target: 'draft-2020-12' }) as Json) as JsonObject;
/** Standard JSON Schema (draft 2020-12) for one activity / a batch. Documentation + generic tooling. */
export const activitySpecJsonSchema = draft(ActivitySpecSchema);
export const activityBatchJsonSchema = draft(ActivityBatchSchema);
/** Strict-mode schema for a later gateway: response_format {type:'json_schema', json_schema:{name:'aha_activity_batch', schema, strict:true}}. */
export const activityBatchStrictJsonSchema = strictMode(activityBatchJsonSchema) as JsonObject;

