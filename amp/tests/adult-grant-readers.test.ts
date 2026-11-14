import assert from "node:assert/strict";
import test from "node:test";
import { readdir, readFile } from "node:fs/promises";
import { grantReads } from "./helpers/grant-reader-audit.js";

const root = new URL("../", import.meta.url);
async function files(path: string): Promise<string[]> {
  const entries = await readdir(new URL(path, root), { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((e) =>
      e.isDirectory() ? files(`${path}/${e.name}`) : [`${path}/${e.name}`],
    ),
  );
  return nested.flat().filter((p) => /\.(?:[cm]?[jt]sx?|sql)$/.test(p));
}
test("raw grant readers match the reviewed inventory; new readers use accessGrantsFor", async () => {
  const approved = JSON.parse(
    await readFile(
      new URL("./fixtures/grant-readers.json", import.meta.url),
      "utf8",
    ),
  ) as { path: string; hash: string; reason: string }[];
  const actual: string[] = [];
  for (const path of (
    await Promise.all([files("src"), files("scripts"), files("migrations")])
  ).flat()) {
    for (const hash of grantReads(
      path,
      await readFile(new URL(path, root), "utf8"),
    ))
      actual.push(`${path}:${hash}`);
  }
  assert.ok(
    approved.every((e) => e.reason.length > 30),
    "Each raw query needs a concrete reason it cannot trust stale adult access.",
  );
  assert.deepEqual(
    actual.sort(),
    approved.map((e) => `${e.path}:${e.hash}`).sort(),
    "Route current entitlement reads through accessGrantsFor. Review child-only, historical and offline binding exceptions before changing the exact-query inventory.",
  );
  const offline = await readFile(
    new URL("src/offline/repository.ts", root),
    "utf8",
  );
  assert.match(
    offline,
    /await new PgTransaction\(c, learner\)\.refreshDerivedAccess\(\);[\s\S]*?const result = await run\(c,/,
  );
  const learning = await readFile(
    new URL("src/server/repository.ts", root),
    "utf8",
  );
  assert.match(
    learning,
    /async refreshDerivedAccess\(\)[\s\S]*?await refreshAdultAccess\(/,
  );
  const resolver = await readFile(
    new URL("src/account/adult-access.ts", root),
    "utf8",
  );
  assert.match(
    resolver,
    /async function refreshAdultAccess[\s\S]*?await accessGrantsFor\(db, \[learnerId\], accountId\)/,
  );
});
test("grant reader guard detects new, changed and duplicate direct readers", () => {
  const sql = 'const q = "SELECT 1 FROM amp_grants WHERE learner_id=$1";';
  assert.equal(grantReads("reader.ts", sql).length, 1);
  assert.equal(grantReads("reader.ts", sql + sql).length, 2);
  assert.notDeepEqual(
    grantReads("reader.ts", sql),
    grantReads("reader.ts", sql.replace("SELECT 1", "SELECT *")),
  );
  assert.equal(
    grantReads(
      "reader.ts",
      "const q = `SELECT 1 FROM ${table} x JOIN amp_access_grants g ON g.id=x.id`;",
    ).length,
    1,
  );
  assert.equal(
    grantReads("migration.sql", "SELECT 1 FROM amp_grants").length,
    1,
  );
});

test("every SQL/ORM bypass fixture changes the approved reader inventory", async (t) => {
  const fixtures = JSON.parse(
    await readFile(
      new URL("./fixtures/grant-reader-bypasses.json", import.meta.url),
      "utf8",
    ),
  ) as { name: string; path: string; source: string }[];
  const approved = JSON.parse(
    await readFile(
      new URL("./fixtures/grant-readers.json", import.meta.url),
      "utf8",
    ),
  ) as { path: string; hash: string }[];
  const baseline = approved.map((e) => `${e.path}:${e.hash}`).sort();
  for (const fixture of fixtures)
    await t.test(fixture.name, () => {
      const found = grantReads(fixture.path, fixture.source);
      assert.ok(found.length, `Unreviewed reader escaped: ${fixture.source}`);
      assert.notDeepEqual(
        [...baseline, ...found.map((h) => `${fixture.path}:${h}`)].sort(),
        baseline,
      );
      if (fixture.path.endsWith(".sql"))
        assert.notDeepEqual(
          grantReads(fixture.path, fixture.source + "\n" + fixture.source),
          found,
        );
      if (!fixture.path.endsWith(".sql"))
        assert.equal(
          grantReads(fixture.path, fixture.source + "\n" + fixture.source)
            .length,
          found.length * 2,
        );
    });
});

test("reader guard ignores comments, unrelated reads and plain grant writes", () => {
  for (const source of [
    '// db.query("SELECT * FROM amp_grants");',
    'db.query("SELECT * FROM amp_learners");',
    'db.query("UPDATE amp_grants SET status=$1 WHERE id=$2");',
    'db.query("INSERT INTO amp_grants(id) VALUES($1)");',
    "const values = Array.from(items);",
  ])
    assert.deepEqual(grantReads("reader.ts", source), []);
  assert.deepEqual(
    grantReads(
      "schema.sql",
      "CREATE TABLE amp_grants(id text); -- SELECT * FROM amp_grants",
    ),
    [],
  );
});

test("query fingerprints preserve significant whitespace and SQL comment boundaries", () => {
  const source = `db.query("SELECT * FROM amp_grants WHERE external_order_id='two  spaces'");`;
  assert.notDeepEqual(
    grantReads("reader.ts", source),
    grantReads("reader.ts", source.replace("two  spaces", "two spaces")),
  );
  const sql = "SELECT * FROM amp_grants -- limit\nWHERE learner_id='fixture'";
  assert.notDeepEqual(
    grantReads("reader.sql", sql),
    grantReads("reader.sql", sql.replace("\n", " ")),
  );
});
