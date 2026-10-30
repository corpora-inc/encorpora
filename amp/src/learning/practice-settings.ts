import { z } from "zod";

export const practiceSettingsSchema = z.object({
  revision: z.number().int().nonnegative(),
  epoch: z.number().int().nonnegative(),
  workingTogether: z.boolean(),
  focusSkillId: z.string().nullable(),
  strandStarts: z
    .record(
      z.string(),
      z.object({
        level: z.number().min(0).max(12),
        revision: z.number().int().nonnegative(),
      }),
    )
    .default({}),
});
export type PracticeSettings = z.infer<typeof practiceSettingsSchema>;
export const defaultPracticeSettings = (): PracticeSettings => ({
  revision: 0,
  epoch: 0,
  workingTogether: false,
  focusSkillId: null,
  strandStarts: {},
});
const identity = {
  requestId: z.string().uuid(),
  revision: z.number().int().nonnegative(),
};
export const practiceChangeSchema = z.discriminatedUnion("kind", [
  z.object({ ...identity, kind: z.literal("reset") }).strict(),
  z
    .object({
      ...identity,
      kind: z.literal("easier"),
      problemId: z.string().min(1).max(160),
    })
    .strict(),
  z
    .object({
      ...identity,
      kind: z.literal("together"),
      enabled: z.boolean(),
      problemId: z.string().min(1).max(160).optional(),
    })
    .strict(),
  z
    .object({
      ...identity,
      kind: z.literal("focus"),
      skillId: z.string().min(1).max(160).nullable(),
    })
    .strict(),
]);
export type PracticeChange = z.infer<typeof practiceChangeSchema>;
