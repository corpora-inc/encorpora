import type { TemplateMetadata } from "./contracts";
import { k8TemplateGlossary } from "./template-glossary-k8";

/** Every template's sense map applied to the engine's templates (K–8 entries
 * in `template-glossary-k8.ts`). */
export const templateGlossary = k8TemplateGlossary;

/** The template with its glossary senses and no-link words merged in; the
 * template's own entries win. */
export function withTemplateGlossary(
  template: TemplateMetadata,
): TemplateMetadata {
  const g = templateGlossary[template.id];
  if (!g) return template;
  return {
    ...template,
    glossarySenses: { ...g.senses, ...template.glossarySenses },
    glossaryNoLink: [
      ...new Set([...(g.noLink ?? []), ...(template.glossaryNoLink ?? [])]),
    ],
  };
}
