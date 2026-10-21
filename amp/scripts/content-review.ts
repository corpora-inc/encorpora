import { createHash } from "node:crypto";
import { createServer } from "vite";
import { z } from "zod";
import { generateProblem, gradeAnswer, templates } from "../src/math/engine";
import { lessons } from "../src/content/lessons";
import { publicationHtml } from "../src/content/publications";
import { problemLesson } from "../src/content/problem-lessons";

// An explicit local tool, independent of the application API and learner store.
if (process.env.NODE_ENV === "production")
  throw new Error("Content review is a local development tool");
const port = z.coerce
  .number()
  .int()
  .min(1024)
  .max(65535)
  .parse(process.env.AMP_REVIEW_PORT ?? 4312);
const selection = z.object({
  template: z
    .string()
    .max(100)
    .refine((id) => templates.some((t) => t.id === id)),
  seed: z.string().min(1).max(128),
});
const action = selection.extend({
  action: z.enum(["problem", "hint", "check", "solution", "lesson"]),
  response: z.string().max(256).optional(),
});
const server = await createServer({
  configFile: false,
  root: process.cwd(),
  clearScreen: false,
  server: { host: "127.0.0.1", port, strictPort: true, cors: false },
  plugins: [
    {
      name: "amp-local-content-review",
      configureServer(vite) {
        vite.middlewares.use(async (req, res, next) => {
          const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
          if (url.pathname !== "/" && !url.pathname.startsWith("/__review/"))
            return next();
          if (
            req.headers.host !== `127.0.0.1:${port}` ||
            req.headers["sec-fetch-site"] === "cross-site" ||
            (req.headers.origin &&
              req.headers.origin !== `http://127.0.0.1:${port}`)
          ) {
            res.statusCode = 403;
            res.end("Open the loopback review URL directly.");
            return;
          }
          res.setHeader("Cache-Control", "no-store");
          try {
            if (url.pathname === "/") {
              res.setHeader("Content-Type", "text/html; charset=utf-8");
              res.end(
                await vite.transformIndexHtml(
                  "/",
                  '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>AMP content review</title></head><body><div id="root"></div><script type="module" src="/scripts/content-review/Review.tsx"></script></body></html>',
                ),
              );
              return;
            }
            if (url.pathname === "/__review/catalog" && req.method === "GET") {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(templates));
              return;
            }
            if (
              url.pathname === "/__review/reference" &&
              req.method === "GET"
            ) {
              const input = selection.parse(
                Object.fromEntries(url.searchParams),
              );
              const lesson = lessons.find((l) =>
                l.templateIds.includes(input.template),
              );
              if (!lesson) {
                res.statusCode = 404;
                res.end("No reference lesson is bound to this family.");
                return;
              }
              res.setHeader("Content-Type", "text/html; charset=utf-8");
              res.end(publicationHtml(lesson, "lesson"));
              return;
            }
            if (url.pathname !== "/__review/action" || req.method !== "POST") {
              res.statusCode = 404;
              res.end("Not found");
              return;
            }
            let body = "";
            for await (const chunk of req) {
              body += chunk;
              if (Buffer.byteLength(body) > 4096) {
                res.statusCode = 413;
                res.end("Request too large");
                return;
              }
            }
            const input = action.parse(JSON.parse(body));
            const generated = generateProblem(input.template, input.seed);
            const response = generated.public.response;
            const result =
              input.action === "problem"
                ? generated.public
                : input.action === "hint"
                  ? { hint: generated.hint }
                  : input.action === "lesson"
                    ? problemLesson(
                        input.template,
                        createHash("sha256").update(input.seed).digest("hex"),
                        generated.public.prompt,
                      )
                    : input.action === "check"
                      ? {
                          correct: gradeAnswer(generated, input.response ?? ""),
                          feedback:
                            generated.choiceFeedback?.[input.response ?? ""] ??
                            null,
                        }
                      : {
                          answer:
                            response.kind === "choice"
                              ? response.options.find(
                                  (o) => o.id === generated.answer,
                                )!.label
                              : generated.answer,
                          steps: generated.explanation,
                        };
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(result));
          } catch (error) {
            console.error("Content review request failed:", error);
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                error:
                  "Unable to load this selection. Choose a valid problem type and a seed of 1–128 characters.",
              }),
            );
          }
        });
      },
    },
  ],
});
await server.listen();
console.log(`AMP content review: http://127.0.0.1:${port}`);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    void server.close().then(() => process.exit(0));
  });
