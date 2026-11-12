import { z } from "zod";

/* "Delete my account" (src/account/delete-account.ts): what the screen shows
   before anything goes, and what the server answers. Shared by the server and
   the web app. */

/** The words the person types to confirm, and the body's literal. */
export const DELETE_ACCOUNT_WORD = "delete";
export const deleteAccountSchema = z.strictObject({
  confirmation: z.literal("delete-my-account"),
});

const place = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["family", "school", "network", "district"]),
});

/** Something that has to happen first, with the step that makes it possible. */
export const deletionBlockerSchema = z.discriminatedUnion("code", [
  /** A card subscription still renews: cancel it in billing first. */
  z.object({ code: z.literal("plan_renews") }),
  /** A checkout started in the last day can still be paid. */
  z.object({ code: z.literal("checkout_open"), until: z.string() }),
  /** A school this person alone runs holds a paid license. */
  z.object({
    code: z.literal("school_licensed"),
    orgId: z.string(),
    name: z.string(),
  }),
]);
export type DeletionBlocker = z.infer<typeof deletionBlockerSchema>;

export const deletionPreviewSchema = z.object({
  /** Children, the adult's own practice and practice profiles. */
  learners: z.object({
    children: z.number().int(),
    own: z.boolean(),
    profiles: z.number().int(),
  }),
  /** Answers on record across those learners. */
  answers: z.number().int(),
  /** Places removed whole: the family and anything this person alone runs. */
  removed: z.array(place),
  /** Places shared with another admin: only this person's place in them goes. */
  left: z.array(place),
  /** A second parent of this person's family keeps her own account. */
  secondParent: z.boolean(),
  /** Payment records stay, without a name or sign-in. */
  billingRecords: z.boolean(),
  blockers: z.array(deletionBlockerSchema),
});
export type DeletionPreview = z.infer<typeof deletionPreviewSchema>;

export const deletionReceiptSchema = z.object({
  deleted: z.literal(true),
});
