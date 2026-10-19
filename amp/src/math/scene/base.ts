import { z } from "zod";
import { fillRoles, inkRoles } from "./roles";

/** Shared building blocks for primitive and component schemas. */
export const num = z.number().finite();
export const coord = num.min(-1e6).max(1e6);
export const pointSchema = z.tuple([coord, coord]);
export type Point = z.infer<typeof pointSchema>;
export const px = num.min(-400).max(400);
export const elementId = z
  .string()
  .regex(/^[a-zA-Z][\w-]{0,31}$/, "Element ids are short words");

export const ink = z.enum(inkRoles);
export const fill = z.enum(fillRoles);
export const dash = z.enum(["solid", "dash", "dot"]);
export const width = num.min(0.5).max(12);
export const label = z.string().min(1).max(60);

export const base = { id: elementId.optional() };
export const stroke = {
  stroke: ink.optional(),
  width: width.optional(),
  dash: dash.optional(),
};
/** Where a label's box sits relative to its anchor: -1 left/top edge on the
 * anchor, 0 centered, 1 right/bottom edge on the anchor. */
export const side = z.union([z.literal(-1), z.literal(0), z.literal(1)]);
export const align = z.tuple([side, side]);
export const placement = z.tuple([px, px, side, side]);

export const small = z.number().int().min(0);
export const color = ink.optional();
export const graphLabel = z.union([label, z.literal(false)]).optional();
