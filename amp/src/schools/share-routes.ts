import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import {
  matchesEtag,
  publicJson,
  sendPublicJson,
  type PublicJson,
} from "../server/public-content-cache.js";
import { renderWorkbookPdf } from "../workbook/routes.js";
import { actorPerson, can } from "./authz.js";
import { fileSlug } from "./exports.js";
import type { defineSchoolRoute, SchoolServices } from "./routes.js";
import {
  contentTag,
  curriculumSummary,
  SCOPE_FOOTER,
  scopeAndSequence,
  scopeCsv,
  scopeDocument,
} from "./scope-and-sequence.js";
import { shareTokenSchema } from "./share-contracts.js";
import {
  createShare,
  parentLinksCsv,
  parentView,
  revokeShare,
  rotateClassShares,
  shareState,
} from "./share.js";
import { limited } from "./sign-in-routes.js";

/** The curriculum only changes with a release, and each file names its content. */
const LONG_CACHE = "public, max-age=86400, stale-while-revalidate=604800";

type File = { body: Buffer | string; tag: string };
function sendFile(
  request: FastifyRequest,
  reply: FastifyReply,
  file: File,
  type: string,
  name: string,
) {
  reply
    .type(type)
    .header("Cache-Control", LONG_CACHE)
    .header("ETag", file.tag)
    .header("Content-Disposition", `attachment; filename="${name}"`);
  return matchesEtag(request.headers["if-none-match"], file.tag)
    ? reply.code(304).send()
    : reply.send(file.body);
}

/** Public: what the school pages show. Built once from the live catalog, and
 * the PDF rendered once per release. */
export function registerCurriculumRoutes(
  scope: FastifyInstance,
  services: SchoolServices,
) {
  let summary: PublicJson | undefined;
  let full: PublicJson | undefined;
  scope.get("/api/v1/schools/curriculum", async (request, reply) => {
    summary ??= publicJson(curriculumSummary());
    return sendPublicJson(request, reply, summary, LONG_CACHE);
  });
  scope.get("/api/v1/schools/scope-and-sequence", async (request, reply) => {
    full ??= publicJson(scopeAndSequence());
    return sendPublicJson(request, reply, full, LONG_CACHE);
  });
  let csv: File | undefined;
  scope.get(
    "/api/v1/schools/scope-and-sequence.csv",
    async (request, reply) => {
      if (!csv) {
        const body = scopeCsv();
        csv = { body, tag: contentTag(body) };
      }
      return sendFile(
        request,
        reply,
        csv,
        "text/csv; charset=utf-8",
        "amp-scope-and-sequence.csv",
      );
    },
  );
  let document: { html: string; tag: string } | undefined;
  let pdf: Promise<Buffer> | undefined;
  scope.get(
    "/api/v1/schools/scope-and-sequence.pdf",
    async (request, reply) => {
      if (!document) {
        const html = scopeDocument();
        document = { html, tag: contentTag(html) };
      }
      if (matchesEtag(request.headers["if-none-match"], document.tag))
        return sendFile(
          request,
          reply,
          { body: "", tag: document.tag },
          "application/pdf",
          "amp-scope-and-sequence.pdf",
        );
      const { html, tag } = document;
      // Renders once, however many ask at the same moment. A failure isn't kept.
      pdf ??= renderWorkbookPdf(
        services.renderer,
        { html, format: "Letter", footer: SCOPE_FOOTER },
        request.log,
      ).catch((error) => {
        pdf = undefined;
        throw error;
      });
      return sendFile(
        request,
        reply,
        { body: await pdf, tag },
        "application/pdf",
        "amp-scope-and-sequence.pdf",
      );
    },
  );
}

/** Public: holding the link is the permission. The token only ever travels in
 * a request body, which the request log doesn't record, and each one reads one
 * student. */
export function registerShareExchange(scope: FastifyInstance, pool: Pool) {
  scope.post("/api/v1/school/share/view", limited, async (request) =>
    parentView(pool, shareTokenSchema.parse(request.body).token),
  );
}

const STUDENT = "/api/v1/school/students/:student/share";
const studentParam = ({ params }: { params: Record<string, string> }) =>
  ({ kind: "student", personId: params.student! }) as const;
const keysFrom = (services: SchoolServices, request: FastifyRequest) => ({
  secret: services.secret,
  origin:
    services.origin ||
    (typeof request.headers.origin === "string" ? request.headers.origin : ""),
});

/** Called once by `routes.ts`, which owns the table these join. */
export function defineShareRoutes(define: typeof defineSchoolRoute) {
  define({
    method: "GET",
    url: STUDENT,
    action: "students.read",
    target: studentParam,
    handler: ({ request, actor, target, pool, services }) =>
      shareState(
        pool,
        keysFrom(services, request),
        target,
        can(actor, "share.manage", target),
      ),
  });
  define({
    method: "POST",
    url: STUDENT,
    action: "share.manage",
    target: studentParam,
    bodyLimit: 1024,
    handler: ({ request, actor, target, repository, services }) =>
      createShare(
        repository,
        keysFrom(services, request),
        target,
        actorPerson(actor, target),
      ),
  });
  define({
    method: "POST",
    url: `${STUDENT}/revoke`,
    action: "share.manage",
    target: studentParam,
    bodyLimit: 1024,
    handler: ({ actor, target, repository }) =>
      revokeShare(repository, target, actorPerson(actor, target)),
  });
  define({
    method: "POST",
    url: "/api/v1/school/classes/:class/parent-links",
    action: "share.manage",
    target: ({ params }) =>
      ({ kind: "class", classId: params.class! }) as const,
    bodyLimit: 1024,
    handler: async ({
      request,
      reply,
      actor,
      target,
      pool,
      repository,
      services,
    }) => {
      const links = await rotateClassShares(
        repository,
        keysFrom(services, request),
        target,
        actorPerson(actor, target),
      );
      const name = (
        await pool.query("SELECT name FROM amp_classes WHERE id=$1", [
          target.classId,
        ])
      ).rows[0]?.name as string | undefined;
      return reply
        .type("text/csv; charset=utf-8")
        .header(
          "Content-Disposition",
          `attachment; filename="${fileSlug("family-links", name ?? "class")}.csv"`,
        )
        .send(parentLinksCsv(links));
    },
  });
}
