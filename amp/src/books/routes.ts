import type { FastifyInstance } from "fastify";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  ApiError,
  type Repository,
  type LearnerTransaction,
} from "../server/repository.js";
import type { Authenticator } from "../server/auth.js";
import { bookFor, bookSummaries } from "./catalog.js";
import { supportsBook } from "./capabilities.js";
import { loadBookPdf } from "./publication.js";
export function registerBookRoutes(
  app: FastifyInstance,
  options: {
    repository: Repository;
    parent: Authenticator;
    development?: boolean;
    publicationDirectory?: string;
  },
) {
  const params = z
    .object({ learnerId: z.string().uuid(), bookId: z.string().max(100) })
    .strict();
  const reading = z
    .object({ problemId: z.string().min(1).max(160).optional() })
    .strict();
  const opening = reading.extend({
    readerCapabilities: z.array(z.string().min(1).max(64)).max(16).default([]),
  });
  const listing = z
    .object({ readerCapabilities: z.string().max(1024).optional() })
    .strict();
  async function access(tx: LearnerTransaction) {
    if (!options.development && !(await tx.hasAccess()))
      throw new ApiError(403, "An active student license is required");
  }
  async function support(
    tx: LearnerTransaction,
    book: NonNullable<ReturnType<typeof bookFor>>,
    problemId?: string,
  ) {
    if (!problemId) return null;
    const problem = await tx.problem(problemId);
    if (!problem) throw new ApiError(404, "Problem not found");
    const alignment =
      book.bindings.find(
        (entry) =>
          entry.templateId === problem.public.templateId &&
          entry.skillId === problem.public.skillId,
      ) ??
      book.alignments.find((entry) => entry.skillId === problem.public.skillId);
    if (!alignment) return null;
    // Reading support describes this instance only and never rewrites an already
    // submitted attempt or manufactures mastery from a book visit.
    if (!(await tx.attemptByProblem(problemId))) {
      problem.lessonViewed = true;
      await tx.saveProblem(problem);
    }
    return alignment.pageIds[0] ?? null;
  }
  app.get("/api/v1/learners/:learnerId/books", async (request) => {
    const account = await options.parent(request);
    const { learnerId } = z
      .object({ learnerId: z.string().uuid() })
      .strict()
      .parse(request.params);
    const query = listing.parse(request.query);
    const advertised = query.readerCapabilities?.split(",") ?? [];
    return options.repository.transaction(account, learnerId, async () => ({
      books: bookSummaries.filter((book) =>
        supportsBook(book.requiredReaderCapabilities, advertised),
      ),
    }));
  });
  app.post(
    "/api/v1/learners/:learnerId/books/:bookId/open",
    async (request) => {
      const account = await options.parent(request);
      const { learnerId, bookId } = params.parse(request.params);
      const input = opening.parse(request.body ?? {});
      const book = bookFor(bookId);
      if (!book) throw new ApiError(404, "Book not found");
      return options.repository.transaction(account, learnerId, async (tx) => {
        await access(tx);
        if (
          !supportsBook(
            book.requiredReaderCapabilities,
            input.readerCapabilities,
          )
        )
          throw new ApiError(409, "Refresh the app to read this book");
        return {
          book: book.content,
          suggestedPageId: await support(tx, book, input.problemId),
        };
      });
    },
  );
  app.post(
    "/api/v1/learners/:learnerId/books/:bookId/download",
    async (request, reply) => {
      const account = await options.parent(request);
      const { learnerId, bookId } = params.parse(request.params);
      const input = reading.parse(request.body ?? {});
      const book = bookFor(bookId);
      if (!book) throw new ApiError(404, "Book not found");
      const data = await options.repository.transaction(
        account,
        learnerId,
        async (tx) => {
          await access(tx);
          const pdf = await loadBookPdf(
            options.publicationDirectory ??
              fileURLToPath(new URL("../../artifacts/books/", import.meta.url)),
            book.content,
          );
          await support(tx, book, input.problemId);
          return pdf;
        },
      );
      return reply
        .type("application/pdf")
        .header(
          "Content-Disposition",
          `attachment; filename="${book.content.id}.pdf"`,
        )
        .send(data);
    },
  );
}
