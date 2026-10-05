/**
 * The strict JSON schema for a band, sent as response_format {type:'json_schema', json_schema:
 * {name: STRICT_SCHEMA_NAME, schema, strict:true}} (README §9). Derived from the zod wire schema by
 * v1's `strictMode` (#891): every key required, nullable where unused, additionalProperties false,
 * no length keywords. Kept apart from the validator so the runtime renderer does not ship zod's
 * JSON Schema generator.
 */
import * as z from 'zod';
import { portable, strictMode, type Json, type JsonObject } from '../schema';
import type { Band } from './registry';
import { bandWire } from './wire';

export const STRICT_SCHEMA_NAME = 'aha_activity_batch_v2';
/** README §9: headroom under the gateway's 32 KiB limit. */
export const MAX_SCHEMA_BYTES = 20 * 1024;

const cache = new Map<Band, JsonObject>();
export function strictBatchSchema(band: Band): JsonObject {
  let s = cache.get(band);
  if (!s) {
    s = strictMode(portable(z.toJSONSchema(bandWire(band).batch, { target: 'draft-2020-12' }) as Json)) as JsonObject;
    cache.set(band, s);
  }
  return s;
}
