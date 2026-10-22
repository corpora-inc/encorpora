import { z } from "zod";
export const META_ENROLLMENT_CONFIRMATION_URL =
  "https://amp.corpora.inc/start/purchase";
export const metaContextRequestSchema = z.strictObject({
  checkoutId: z.uuid(),
});
export const metaContextResultSchema = z.strictObject({
  recorded: z.boolean(),
});
