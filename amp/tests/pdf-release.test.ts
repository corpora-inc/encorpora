import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  expectedPublicationNames,
  verifyPublications,
} from "../scripts/pdf-release";

test("PDF release validation requires complete current inventory and rejects corrupted bytes or metadata", async () => {
  const directory = await mkdtemp(join(tmpdir(), "amp-pdf-release-"));
  const bytes = Buffer.from(
    "%PDF-fixture: integrity tests do not certify PDF rendering",
  );
  const publications = expectedPublicationNames(["fixture"]).map((filename) => {
    const [, kind, format] =
      /^fixture-(lesson|workbook|solutions)-(Letter|A4)\.pdf$/.exec(filename)!;
    return {
      lessonId: "fixture",
      kind,
      format,
      filename,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  });
  const manifest = (entries: unknown) =>
    writeFile(
      join(directory, "manifest.json"),
      JSON.stringify({ publications: entries }),
    );
  try {
    for (const item of publications)
      await writeFile(join(directory, item.filename), bytes);
    await manifest(publications);
    assert.equal(
      (await verifyPublications(directory, ["fixture"])).publications.length,
      6,
    );
    await manifest(publications.slice(1));
    await assert.rejects(
      verifyPublications(directory, ["fixture"]),
      /inventory/,
    );
    await manifest([publications[0], ...publications.slice(0, 5)]);
    await assert.rejects(
      verifyPublications(directory, ["fixture"]),
      /duplicate/,
    );
    await manifest(
      publications.map((p, i) =>
        i ? p : { ...p, filename: "../outside.pdf" },
      ),
    );
    await assert.rejects(
      verifyPublications(directory, ["fixture"]),
      /filename/,
    );
    await manifest(publications);
    await writeFile(
      join(directory, publications[0].filename),
      Buffer.from(bytes.toString().replace("fixture", "f1xture")),
    );
    await assert.rejects(verifyPublications(directory, ["fixture"]), /hash/);
    await rm(join(directory, publications[0].filename));
    await assert.rejects(verifyPublications(directory, ["fixture"]), /ENOENT/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
