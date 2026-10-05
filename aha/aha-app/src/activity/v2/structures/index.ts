/** The registry of semantic intents (README §4–5). Adding an intent means adding one entry here. */
import type { StructureDef } from '../registry';
import { array } from './array';
import { equalGroups } from './equalGroups';
import { fraction } from './fraction';
import { rectArea } from './rectArea';

export const STRUCTURES = {
  equal_groups: equalGroups, array, rect_area: rectArea, fraction,
} as const satisfies Record<string, StructureDef>;
export type StructureKind = keyof typeof STRUCTURES;
export const STRUCTURE_KINDS = Object.keys(STRUCTURES) as StructureKind[];
/** The definition for a kind, typed loosely for generic layers (the binding checks roles against it). */
export const structureDef = (kind: StructureKind): StructureDef => STRUCTURES[kind] as unknown as StructureDef;
