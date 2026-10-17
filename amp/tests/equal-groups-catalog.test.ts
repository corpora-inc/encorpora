import assert from "node:assert/strict";
import test from "node:test";
import { bookFor, bookSummaries } from "../src/books/catalog.js";
import { buildCoverageManifest } from "../src/content/coverage.js";
import { equalGroupsWorkshop } from "../books/equal-groups-workshop/book.js";
import { equalGroupsPracticeBindings } from "../books/equal-groups-workshop/practice.js";
test("the reading catalog and production manifest expose the same authored book and bounded support", () => {
  const registered = bookFor(equalGroupsWorkshop.id);
  assert.ok(registered);
  assert.equal(registered.content, equalGroupsWorkshop);
  const summary = bookSummaries.find((b) => b.id === equalGroupsWorkshop.id)!;
  assert.equal(summary.pages, equalGroupsWorkshop.pages.length);
  const manifest = buildCoverageManifest();
  assert.deepEqual(manifest.errors, []);
  for (const binding of equalGroupsPracticeBindings) {
    assert.ok(summary.templates.includes(binding.templateId));
    assert.ok(
      manifest.bookBindings.some(
        (b) =>
          b.bookId === equalGroupsWorkshop.id &&
          b.templateId === binding.templateId,
      ),
    );
  }
  const artifact = manifest.artifacts.find(
    (a) => a.id === `book.${equalGroupsWorkshop.id}`,
  )!;
  assert.ok(artifact);
  assert.equal(
    artifact.independentlyReviewed,
    false,
    "Catalog presence does not manufacture a recorded review",
  );
  assert.equal(
    manifest.summary.publishedArtifacts,
    0,
    "Publication requires an explicit matching artifact record",
  );
  assert.ok(
    manifest.skills.every((s) => !s.fullyCovered),
    "Book links alone do not prove every assessed facet",
  );
});
