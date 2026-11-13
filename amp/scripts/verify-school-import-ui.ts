/** XLSX sheet selection and import through the real school API on phone and desktop.
 * AMP_TEST_DATABASE_URL=... npx tsx scripts/verify-school-import-ui.ts [--port 4478]
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { strToU8, zipSync } from "fflate";
import { chromium as rawChromium } from "playwright";
import { createServer } from "vite";
import { secureChromium } from "../browser-security.mjs";
import { AGREEMENT_VERSION } from "../src/schools/agreement";
import { SchoolRepository } from "../src/schools/repository";
import { registerSchoolRoutes } from "../src/schools/routes";
import { registerFamilyRoutes } from "../src/family/routes";
import { buildApp } from "../src/server/app";
import { developmentAuth, refuseStudentTokens } from "../src/server/auth";
import { PostgresRepository } from "../src/server/repository";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";

const url = process.env.AMP_TEST_DATABASE_URL!;
assertTestDatabaseTarget(url);
const at = process.argv.indexOf("--port");
const port = at >= 0 ? Number(process.argv[at + 1]) : 4478;
const origin = `http://127.0.0.1:${port}`;
const schema = `amp_import_ui_${randomUUID().replaceAll("-", "")}`;
const admin = new Pool({ connectionString: url, max: 1 });
await admin.query(`CREATE SCHEMA ${schema}`);
const scoped = new URL(url);
scoped.searchParams.set("options", `-c search_path=${schema}`);
await migrate(scoped.href);
const learning = new PostgresRepository(scoped.href);
const schools = new SchoolRepository(learning.pool);
const authenticate = refuseStudentTokens(developmentAuth());
const api = buildApp({ repository: learning, authenticate });
await registerFamilyRoutes(api, { pool: learning.pool, authenticate });
await registerSchoolRoutes(api, { pool: learning.pool, authenticate });
api.get("/api/v1/auth-config", async () => ({ mode: "development" }));
await api.listen({ host: "127.0.0.1", port: port + 1 });
const vite = await createServer({
  ...(process.env.AMP_VITE_CACHE_DIR
    ? { cacheDir: process.env.AMP_VITE_CACHE_DIR }
    : {}),
  server: {
    host: "127.0.0.1",
    port,
    strictPort: true,
    watch: null,
    proxy: { "/api": `http://127.0.0.1:${port + 1}` },
  },
});
await vite.listen();
const browser = await secureChromium(rawChromium).launch();
const failures: string[] = [];

function workbook(id: string) {
  const sheets = ["Homeroom", "Support"];
  const files: Record<string, Uint8Array> = {
    "xl/workbook.xml": strToU8(
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((name, i) => `<sheet name="${name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}</Relationships>`,
    ),
  };
  for (const [i, name] of sheets.entries()) {
    const rows = [
      ["Student ID", "Name", "Grade", "Class"],
      [id, i ? "Noor Haddad" : "Ana Ruiz", "3", name],
    ];
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((row, r) => `<row r="${r + 1}">${row.map((value, c) => `<c r="${String.fromCharCode(65 + c)}${r + 1}" t="inlineStr"><is><t>${value}</t></is></c>`).join("")}</row>`).join("")}</sheetData></worksheet>`,
    );
  }
  return Buffer.from(zipSync(files));
}

try {
  for (const width of [390, 1280]) {
    const org = await schools.createOrg(
      { kind: "school", name: `Import school ${width}`, timezone: "UTC" },
      {
        version: AGREEMENT_VERSION,
        signerName: "Fixture Admin",
        signerTitle: "Principal",
      },
    );
    await schools.issueLicense({
      orgId: org.id,
      seats: 10,
      endsAt: new Date(Date.now() + 86_400_000 * 30).toISOString(),
    });
    await schools.addStaff({
      orgId: org.id,
      role: "admin",
      givenName: "Fixture",
      accountId: "development-household",
    });
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    page.on("pageerror", (error) => failures.push(error.message));
    await page.goto(`${origin}/school/${org.id}/import`);
    await page
      .getByRole("heading", { name: "Import a roster", exact: true })
      .waitFor();
    await page.getByLabel("Choose a roster file").setInputFiles({
      name: "roster.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: workbook(`00${width}`),
    });
    await page.getByRole("button", { name: "Sheet", exact: true }).click();
    await page.getByRole("option", { name: /^Support · / }).click();
    await page.getByRole("button", { name: "Use this sheet" }).click();
    await page
      .getByRole("heading", { name: "Check the columns", exact: true })
      .waitFor();
    await page.getByText("Noor Haddad", { exact: true }).waitFor();
    assert.equal(await page.getByText("Ana Ruiz", { exact: true }).count(), 0);
    await page.getByRole("button", { name: "Check for changes" }).click();
    await page.waitForURL(/step=review/);
    await page.getByRole("button", { name: "Apply changes" }).click();
    await page.waitForURL(/step=done/);
    assert.deepEqual(
      (
        await learning.pool.query(
          "SELECT given_name,identifier FROM amp_people WHERE tenant_id=$1 AND learner_id IS NOT NULL",
          [org.id],
        )
      ).rows,
      [{ given_name: "Noor", identifier: `00${width}` }],
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `no overflow at ${width}`,
    );
    await page.getByRole("button", { name: "Import another file" }).click();
    await page
      .getByLabel("Or paste from a spreadsheet")
      .fill("Name,Class\nSam Lee,Math\nSam Lee,Support\n");
    await page.getByRole("button", { name: "Use these rows" }).click();
    await page.getByRole("button", { name: "Check for changes" }).click();
    await page.waitForURL(/step=review/);
    assert.equal(
      await page.getByText(/Two students share this name/).count(),
      2,
    );
    assert.equal(
      (
        await learning.pool.query(
          "SELECT count(*)::int AS n FROM amp_people WHERE tenant_id=$1 AND learner_id IS NOT NULL",
          [org.id],
        )
      ).rows[0].n,
      1,
    );
    await context.close();
  }
  assert.deepEqual(failures, []);
  console.info(
    "School XLSX import and identity exceptions passed at 390 and 1280 pixels.",
  );
} finally {
  await browser.close();
  await vite.close();
  await api.close();
  await learning.close();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
