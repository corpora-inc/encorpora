import { z } from "zod";
import type { GlossaryCard, GlossaryLexicon } from "../../glossary/types";
import type { Scene } from "../../math/scene/spec";

const lexiconSchema = z.record(z.string(), z.string().nullable());
const cardSchema = z.object({
  id: z.string(),
  term: z.string(),
  plain: z.string(),
  example: z.string().optional(),
  figure: z
    .custom<Scene>((value) => typeof value === "object" && value !== null)
    .optional(),
  uses: z.array(z.string()),
  lexicon: lexiconSchema.optional(),
}) satisfies z.ZodType<GlossaryCard>;

/** Term cards beside a hint or an answer. They only add links, so a
 * malformed glossary is logged and dropped; the hint or answer still shows. */
export const glossaryPayloadShape = {
  glossary: z
    .array(cardSchema)
    .optional()
    .catch((context) => {
      console.error(
        "Term cards were malformed and are not shown",
        context.error,
      );
      return undefined;
    }),
  glossaryLexicon: lexiconSchema.optional().catch((context) => {
    console.error("Term links were malformed and are not shown", context.error);
    return undefined as GlossaryLexicon | undefined;
  }),
};
