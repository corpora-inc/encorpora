/** The printed catalog in a fixed order: every lesson's lesson, workbook and
 * solutions documents, each in Letter and A4. Shared by the publisher and its
 * hashing workers, which must agree on the order. */
import { lessons } from "../src/content/lessons";
import { publicationHtml } from "../src/content/publications";
import type { PublicationDocument } from "./publication-cache";

export const publicationDocuments = (): PublicationDocument[] =>
  lessons.flatMap((lesson) =>
    (["lesson", "workbook", "solutions"] as const).map((kind) => ({
      lessonId: lesson.id,
      kind,
      html: () => publicationHtml(lesson, kind),
      formats: ["Letter", "A4"],
    })),
  );
