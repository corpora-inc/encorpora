import { readerCapabilities } from "../src/books/capabilities.js";
import { books } from "../src/books/catalog.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "../scripts/migrate.js";
import { PostgresRepository } from "../src/server/repository.js";
import { buildApp } from "../src/server/app.js";
import { generateProblem } from "../src/math/engine.js";
import { fractionFieldGuide as book } from "../books/fraction-field-guide/book.js";
import { contentHash } from "../src/books/publication.js";
const url = process.env.AMP_TEST_DATABASE_URL;
test(
  "owned book delivery enforces license, immutable support evidence and artifact integrity",
  { skip: !url },
  async () => {
    await migrate(url!);
    const repository = new PostgresRepository(url!);
    const account = `book-test:${randomUUID()}`;
    const directory = await mkdtemp(join(tmpdir(), "amp-book-"));
    await repository.pool.query(
      "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'test','test-only','fixture')",
      [account],
    );
    const learner = await repository.create(account, "Book explorer");
    const other = await repository.create(account, "Other explorer");
    const app = buildApp({
      repository,
      authenticate: async (request) =>
        String(request.headers["x-test-account"] ?? account),
      bookPublicationDirectory: directory,
    });
    const path = `/api/v1/learners/${learner.id}/books/${book.id}`;
    const post = (
      action: string,
      payload: { problemId?: string } = {},
      headers: Record<string, string> = {},
    ) =>
      app.inject({
        method: "POST",
        url: `${path}/${action}`,
        payload,
        headers,
      });
    try {
      assert.equal((await post("open")).statusCode, 403);
      await repository.pool.query(
        "INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at) VALUES($1,$2,'pilot',$1,'active',now()-interval '1 hour',now()+interval '1 hour')",
        [randomUUID(), learner.id],
      );
      const opened = await post("open");
      assert.equal(opened.statusCode, 200);
      assert.equal(opened.headers["cache-control"], "no-store");
      assert.equal(opened.json().book.pages.length, book.pages.length);
      await repository.pool.query(
        "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'test','test-only','fixture')",
        [`${account}:foreign`],
      );
      assert.equal(
        (await post("open", {}, { "x-test-account": `${account}:foreign` }))
          .statusCode,
        404,
      );
      const listPath = `/api/v1/learners/${learner.id}/books`;
      const legacyList = await app.inject({ method: "GET", url: listPath });
      assert.ok(
        !legacyList
          .json()
          .books.some((b: { id: string }) => b.id === "balance-and-change"),
      );
      assert.ok(
        !legacyList
          .json()
          .books.some((b: { id: string }) => b.id === "number-builders"),
      );
      assert.ok(
        !legacyList
          .json()
          .books.some((b: { id: string }) => b.id === "measure-border-cover"),
      );
      for (const capabilities of [["algebra-models-v1"], ["unit-regions-v1"]]) {
        const unsupportedMeasurement = await app.inject({
          method: "POST",
          url: `${listPath}/measure-border-cover/open`,
          payload: { readerCapabilities: capabilities },
        });
        assert.equal(unsupportedMeasurement.statusCode, 409);
      }
      assert.ok(
        !legacyList
          .json()
          .books.some((b: { id: string }) => b.id === "in-the-same-proportion"),
      );
      for (const capabilities of [["algebra-models-v1"], ["ratio-models-v1"]]) {
        const response = await app.inject({
          method: "POST",
          url: `${listPath}/in-the-same-proportion/open`,
          payload: { readerCapabilities: capabilities },
        });
        assert.equal(response.statusCode, 409);
      }
      const unsupportedNumber = await app.inject({
        method: "POST",
        url: `${listPath}/number-builders/open`,
        payload: { readerCapabilities: ["algebra-models-v1"] },
      });
      assert.equal(unsupportedNumber.statusCode, 409);
      const capableList = await app.inject({
        method: "GET",
        url: `${listPath}?readerCapabilities=algebra-models-v1`,
      });
      assert.ok(
        capableList
          .json()
          .books.some((b: { id: string }) => b.id === "balance-and-change"),
      );
      const unsupportedProblem = generateProblem(
        "linear-equation",
        randomUUID(),
      );
      await repository.transaction(account, learner.id, (tx) =>
        tx.saveProblem(unsupportedProblem),
      );
      const unsupported = await app.inject({
        method: "POST",
        url: `${listPath}/balance-and-change/open`,
        payload: { problemId: unsupportedProblem.public.id },
      });
      assert.equal(unsupported.statusCode, 409);
      assert.equal(
        await repository.transaction(
          account,
          learner.id,
          async (tx) =>
            (await tx.problem(unsupportedProblem.public.id))?.lessonViewed,
        ),
        undefined,
      );
      for (const { content, bindings } of books)
        for (const binding of bindings) {
          const linked = generateProblem(binding.templateId, randomUUID());
          await repository.transaction(account, learner.id, (tx) =>
            tx.saveProblem(linked),
          );
          const result = await app.inject({
            method: "POST",
            url: `/api/v1/learners/${learner.id}/books/${content.id}/open`,
            payload: {
              problemId: linked.public.id,
              readerCapabilities,
            },
          });
          assert.equal(result.statusCode, 200);
          assert.equal(result.json().book.id, content.id);
          assert.equal(result.json().book.pages.length, content.pages.length);
          assert.equal(
            result.json().suggestedPageId,
            binding.pageIds[0],
            binding.templateId,
          );
          assert.equal(
            await repository.transaction(
              account,
              learner.id,
              async (tx) => (await tx.problem(linked.public.id))?.lessonViewed,
            ),
            true,
          );
        }
      const problem = generateProblem("fraction-model", randomUUID());
      const foreign = generateProblem("fraction-model", randomUUID());
      await repository.transaction(account, learner.id, (tx) =>
        tx.saveProblem(problem),
      );
      await repository.transaction(account, other.id, (tx) =>
        tx.saveProblem(foreign),
      );
      assert.equal(
        (await post("open", { problemId: foreign.public.id })).statusCode,
        404,
      );
      assert.equal(
        (await post("download", { problemId: problem.public.id })).statusCode,
        503,
      );
      assert.equal(
        await repository.transaction(
          account,
          learner.id,
          async (tx) => (await tx.problem(problem.public.id))?.lessonViewed,
        ),
        undefined,
      );
      await mkdir(join(directory, book.id));
      const bytes = Buffer.from(
        "%PDF-1.7\nTest release bytes; rendering validated separately.\n",
      );
      const manifest = {
        book: book.id,
        version: book.version,
        contentSha256: contentHash(book),
        pdfSha256: createHash("sha256").update(bytes).digest("hex"),
        physicalPdfPages: book.pages.length,
      };
      const manifestPath = join(directory, book.id, "validation.json");
      await writeFile(join(directory, book.id, `${book.id}.pdf`), bytes);
      await writeFile(
        manifestPath,
        JSON.stringify({ ...manifest, contentSha256: "0".repeat(64) }),
      );
      assert.equal(
        (await post("download", { problemId: problem.public.id })).statusCode,
        503,
      );
      await writeFile(manifestPath, JSON.stringify(manifest));
      const downloaded = await post("download", {
        problemId: problem.public.id,
      });
      assert.equal(downloaded.statusCode, 200);
      assert.equal(downloaded.headers["content-type"], "application/pdf");
      assert.deepEqual(downloaded.rawPayload, bytes);
      assert.equal(
        await repository.transaction(
          account,
          learner.id,
          async (tx) => (await tx.problem(problem.public.id))?.lessonViewed,
        ),
        true,
      );
      const independent = generateProblem("fraction-model", randomUUID());
      await repository.transaction(account, learner.id, (tx) =>
        tx.saveProblem(independent),
      );
      const outcome = await app.inject({
        method: "POST",
        url: `/api/v1/learners/${learner.id}/attempts`,
        payload: {
          problemId: independent.public.id,
          requestId: randomUUID(),
          response: independent.answer,
        },
      });
      assert.equal(outcome.statusCode, 200);
      assert.equal(outcome.json().assisted, false);
      assert.equal(
        (await post("open", { problemId: independent.public.id })).statusCode,
        200,
      );
      assert.equal(
        await repository.transaction(
          account,
          learner.id,
          async (tx) => (await tx.problem(independent.public.id))?.lessonViewed,
        ),
        undefined,
      );
      assert.equal(
        await repository.transaction(
          account,
          learner.id,
          async (tx) =>
            (await tx.attemptByProblem(independent.public.id))?.assisted,
        ),
        false,
      );
      await writeFile(
        join(directory, book.id, `${book.id}.pdf`),
        Buffer.from("%PDF-corrupt"),
      );
      assert.equal((await post("download")).statusCode, 503);
      await repository.pool.query(
        "UPDATE amp_parent_consents SET withdrawn_at=now() WHERE account_id=$1",
        [account],
      );
      assert.equal((await post("open")).statusCode, 403);
    } finally {
      await app.close();
      await repository.pool.query(
        "DELETE FROM amp_learners WHERE account_id=$1",
        [account],
      );
      await repository.pool.query(
        "DELETE FROM amp_parent_consents WHERE account_id=ANY($1::text[])",
        [[account, `${account}:foreign`]],
      );
      await repository.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
