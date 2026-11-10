import { secureChromium } from "../browser-security.mjs";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium as rawChromium, webkit, type Page } from "playwright";
const chromium = secureChromium(rawChromium);
import { createServer } from "vite";
import { retentionNotice } from "../src/family/contracts";

/** A school student in the real app with its real auth module, against a mocked
 * API: no parent chrome, nothing to buy, no analytics, and a bad token lands on
 * /join. Student sign-in itself is in verify-school-sign-in-ui.ts. */
const port = 4393,
  origin = `http://127.0.0.1:${port}`;
const vite = await createServer({
  cacheDir: "node_modules/.vite-school-student",
  server: { host: "127.0.0.1", port, strictPort: true },
});
const shots = process.env.AMP_UI_ARTIFACTS ?? "artifacts/school-student";
await mkdir(shots, { recursive: true });

const learnerId = "6f0a1c7e-1111-4222-8333-444455556666";
const session = {
  accountId: "school:0b6e5c2a-7777-4888-9999-000011112222",
  token: `st_${"a".repeat(43)}`,
};
type State = {
  name?: string;
  seated: boolean;
  birthYear: number | null;
  levels: "hidden" | "choice" | "shown";
  valid: boolean;
  /** `/me` still says seated, as just before a seat ends mid-session. */
  batchRefused: boolean;
};
function me(state: State) {
  return {
    signedIn: true,
    account: {
      id: session.accountId,
      email: null,
      emailVerified: true,
      confirmationRequired: false,
      kind: "student",
    },
    consent: { status: "active", method: null },
    learners: [
      {
        id: learnerId,
        name: state.name ?? "Fixture Student",
        birthYear: state.birthYear,
        entitlement: {
          active: state.seated,
          plan: state.seated ? "pilot" : null,
          endsAt: state.seated ? "2099-01-01T00:00:00Z" : null,
        },
      },
    ],
    family: {
      consent: {
        status: "active",
        policyVersion: null,
        recordedAt: null,
        withdrawnAt: null,
      },
      learners: [
        {
          id: learnerId,
          name: state.name ?? "Fixture Student",
          birthYear: state.birthYear,
          deletedAt: null,
          access: [],
          stripeLinked: false,
          canPractice: state.seated,
        },
      ],
      retained: retentionNotice,
    },
    next: "practice",
    school: {
      orgName: "Fixture Academy",
      className: "Period 1",
      levels: state.levels,
    },
  };
}
const estimate = { level: 4, sd: 1, answered: 12, independent: 12 };
const frontier = {
  expected: 4,
  overall: estimate,
  strands: { arithmetic: estimate },
};
function fresh(overrides: Partial<State> = {}): State {
  return {
    seated: true,
    birthYear: 2016,
    levels: "hidden",
    valid: true,
    batchRefused: false,
    ...overrides,
  };
}

await vite.listen();
const browser = await (
  process.argv.includes("--webkit") ? webkit : chromium
).launch();
async function open(
  state: State,
  options: {
    width?: number;
    dark?: boolean;
    path?: string;
    /** Milliseconds before the sign-in screens' code arrives. */
    slowJoin?: number;
  } = {},
) {
  const context = await browser.newContext({
    viewport: { width: options.width ?? 390, height: 844 },
    colorScheme: options.dark ? "dark" : "light",
  });
  const requests: string[] = [];
  await context.route(
    /googletagmanager\.com|google-analytics\.com/,
    (route) => {
      requests.push(route.request().url());
      return route.abort();
    },
  );
  await context.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    requests.push(path);
    const auth = route.request().headers().authorization;
    if (path === "/api/v1/auth-config")
      return route.fulfill({
        json: { mode: "accounts", passwords: true, providers: [] },
      });
    if (path === "/api/v1/me") {
      assert.equal(auth, `Bearer ${session.token}`);
      return state.valid
        ? route.fulfill({ json: me(state) })
        : route.fulfill({ status: 401, json: { error: "sign_in_required" } });
    }
    if (path === "/api/v1/catalog")
      return route.fulfill({
        json: { skills: [], templates: [], lessons: [], mode: "hosted" },
      });
    if (path.endsWith("/books")) return route.fulfill({ json: { books: [] } });
    if (path.endsWith("/frontier")) return route.fulfill({ json: frontier });
    if (path.endsWith("/progress"))
      return route.fulfill({
        json: { asOf: "2026-01-01T00:00:00.000Z", skills: [] },
      });
    if (path.endsWith("/practice-state"))
      return route.fulfill({
        json: {
          epoch: 0,
          revision: 0,
          strandStarts: {},
          focusSkillId: null,
          workingTogether: false,
        },
      });
    if (path.endsWith("/batches")) {
      if (state.batchRefused) state.seated = false;
      return route.fulfill({
        status: 403,
        json: { error: "An active student license is required" },
      });
    }
    // A parent's session check is legitimate once the student has signed out.
    return route.fulfill({ status: 404, json: { error: "Not found" } });
  });
  // Once per tab, so signing out can clear it.
  await context.addInitScript((saved) => {
    if (sessionStorage.getItem("fixture-seeded")) return;
    sessionStorage.setItem("fixture-seeded", "1");
    sessionStorage.setItem("amp.student", saved);
    localStorage.setItem("amp.learner", "kept-until-sign-out");
  }, JSON.stringify(session));
  if (options.slowJoin)
    await context.route(
      /\/src\/web\/features\/school\/join\//,
      async (route) => {
        await new Promise((done) => setTimeout(done, options.slowJoin));
        await route.continue();
      },
    );
  const page = await context.newPage();
  await page.goto(`${origin}${options.path ?? "/"}`);
  return { page, requests, close: () => context.close() };
}
const askTeacher = (page: Page) =>
  page.getByRole("heading", { name: "Ask your teacher about your seat." });
const drawer = async (page: Page) =>
  page.getByRole("button", { name: "Open AMP menu" }).click();
async function noOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  assert.ok(overflow <= 0, `${label}: ${overflow}px horizontal overflow`);
}
function noParentCalls(requests: string[]) {
  for (const refused of [
    /\/api\/v1\/family/,
    /\/api\/v1\/events/,
    /\/api\/v1\/session/,
    /\/api\/auth\//,
    /googletagmanager\.com|google-analytics\.com/,
  ])
    assert.equal(
      requests.filter((request) => refused.test(request)).join(),
      "",
      `A student device must not call ${refused}`,
    );
}

try {
  for (const width of [320, 390, 768, 1280])
    for (const dark of [false, true]) {
      const name = "Alexandria Cedar-River Learning";
      const { page, close } = await open(fresh({ name }), {
        width,
        dark,
        path: "/overview",
      });
      try {
        await page.getByRole("button", { name: "Go", exact: true }).waitFor();
        await drawer(page);
        const label = page
          .locator('[aria-label="Where you are"] strong')
          .filter({ hasText: name });
        await label.waitFor();
        assert.equal(
          await label.evaluate((el) => {
            const range = document.createRange();
            range.selectNodeContents(el);
            const box = el.getBoundingClientRect();
            return [...range.getClientRects()].every(
              (r) =>
                r.left >= box.left - 1 &&
                r.right <= box.right + 1 &&
                r.bottom <= box.bottom + 1,
            );
          }),
          true,
          `${width}: the student's full name must be visible`,
        );
        await page.waitForTimeout(350);
        await page.screenshot({
          path: `${shots}/long-name-${width}-${dark ? "dark" : "light"}.png`,
        });
      } finally {
        await close();
      }
    }
  // The primary action must receive the tap. A floating sign-out button once
  // covered it while still passing element-box and horizontal-overflow checks.
  for (const width of [320, 390, 768, 1280])
    for (const dark of [false, true]) {
      const { page, close } = await open(fresh(), {
        width,
        dark,
        path: "/overview",
      });
      try {
        await page.getByRole("button", { name: "Go", exact: true }).waitFor();
        const practice = page.getByRole("link", {
          name: "Practice",
          exact: true,
        });
        await practice.waitFor();
        assert.equal(
          await practice.evaluate((link) => {
            const box = link.getBoundingClientRect();
            const target = document.elementFromPoint(
              box.x + box.width / 2,
              box.y + box.height / 2,
            );
            return !!target && link.contains(target);
          }),
          true,
          `${width}/${dark ? "dark" : "light"}: Practice must receive the tap`,
        );
        await page.waitForTimeout(350);
        await page.screenshot({
          path: `${shots}/practice-target-${width}-${dark ? "dark" : "light"}.png`,
        });
        await practice.click();
        await page.waitForURL(`${origin}/practice`);
        assert.ok(
          await page.evaluate(() => sessionStorage.getItem("amp.student")),
          "Practice must preserve the student session",
        );
      } finally {
        await close();
      }
    }
  for (const width of [320, 390, 768, 1280])
    for (const dark of [false, true]) {
      const label = `${width}-${dark ? "dark" : "light"}`;
      const { page, requests, close } = await open(fresh({ seated: false }), {
        width,
        dark,
      });
      await askTeacher(page).waitFor();
      assert.equal(new URL(page.url()).pathname, "/");
      assert.equal(await page.getByText("Choose a plan").count(), 0);
      await noOverflow(page, `seat card ${label}`);
      await page.screenshot({ path: `${shots}/seat-${label}.png` });
      const reads = requests.length;
      await drawer(page);
      const menu = page.getByRole("navigation", { name: "AMP navigation" });
      await menu.waitFor();
      assert.equal(await menu.getByText("Account & access").count(), 0);
      assert.equal(await menu.getByText("See plans").count(), 0);
      assert.equal(await page.getByText("Show grade numbers").count(), 0);
      await page.getByText("Fixture Academy").waitFor();
      await page.getByText("Period 1").waitFor();
      await page.getByRole("button", { name: "Sign out" }).waitFor();
      await noOverflow(page, `menu ${label}`);
      const sheet = page.getByRole("dialog", {
        name: "Adaptive Math Pathways",
      });
      await page.waitForTimeout(250);
      const content = await sheet.innerText();
      const bounds = await sheet.boundingBox();
      await page.waitForTimeout(500);
      assert.equal(
        await sheet.innerText(),
        content,
        "student drawer text stays settled",
      );
      assert.deepEqual(
        await sheet.boundingBox(),
        bounds,
        "student drawer keeps its geometry",
      );
      assert.equal(
        requests.length,
        reads,
        "student drawer reuses the screen's data",
      );
      await page.screenshot({ path: `${shots}/menu-${label}.png` });
      noParentCalls(requests);
      await close();
    }

  {
    // No seat: practice never asks, and never offers a purchase.
    const { page, requests, close } = await open(fresh({ seated: false }), {
      path: "/practice",
    });
    await askTeacher(page).waitFor();
    assert.equal(new URL(page.url()).pathname, "/practice");
    assert.equal(requests.filter((r) => r.endsWith("/batches")).length, 0);
    await close();
  }
  {
    // A seat that ends mid-session asks the teacher rather than opening Buy.
    const { page, requests, close } = await open(
      fresh({ batchRefused: true }),
      { path: "/practice" },
    );
    await askTeacher(page).waitFor();
    assert.equal(new URL(page.url()).pathname, "/practice");
    assert.equal(requests.filter((r) => r.endsWith("/batches")).length, 1);
    await close();
  }
  {
    // A seated student's home: the setting decides the grade numbers.
    const { page, close } = await open(fresh({ levels: "hidden" }));
    await page.getByRole("button", { name: "Go", exact: true }).waitFor();
    assert.equal(await page.getByText("Change birth year").count(), 0);
    assert.equal(await page.getByText("Show grade numbers").count(), 0);
    await drawer(page);
    await page.getByRole("link", { name: "Progress", exact: true }).click();
    await page.waitForURL(`${origin}/overview`);
    assert.equal(await page.getByTestId("level-readout").count(), 0);
    await close();
  }
  {
    const { page, close } = await open(fresh({ levels: "shown" }));
    await page.getByRole("button", { name: "Go", exact: true }).waitFor();
    assert.equal(await page.getByText("Show grade numbers").count(), 0);
    await drawer(page);
    await page.getByRole("link", { name: "Progress", exact: true }).click();
    await page.waitForURL(`${origin}/overview`);
    await page.getByTestId("level-readout").waitFor();
    await close();
  }
  {
    const { page, close } = await open(fresh({ levels: "choice" }));
    const toggle = page.getByLabel("Show grade numbers");
    await toggle.first().waitFor();
    assert.equal(await toggle.first().isChecked(), false);
    await toggle.first().check();
    await drawer(page);
    await page.getByRole("link", { name: "Progress", exact: true }).click();
    await page.waitForURL(`${origin}/overview`);
    await page.getByTestId("level-readout").waitFor();
    await close();
  }
  {
    // A student with no grade on file still reaches practice; no prompt opens.
    const { page, close } = await open(fresh({ birthYear: null }));
    await page.getByRole("button", { name: "Go", exact: true }).waitFor();
    assert.equal(await page.getByLabel(/birth year/i).count(), 0);
    await close();
  }
  for (const path of [
    "/family/learners",
    "/purchase/choose",
    "/consent",
    // The retired trial's addresses still redirect; a student stays put.
    "/try",
    "/try/practice",
    "/start/name",
    "/start/plan",
    `/learners/${learnerId}/workbooks`,
    "/profile/birth-year",
  ]) {
    // Family and purchase screens aren't a student's, even by direct link.
    const { page, requests, close } = await open(fresh(), { path });
    await page.getByRole("button", { name: "Go", exact: true }).waitFor();
    if (path !== "/profile/birth-year")
      assert.equal(new URL(page.url()).pathname, "/overview", path);
    assert.equal(await page.getByLabel(/birth year/i).count(), 0, path);
    noParentCalls(requests);
    await close();
  }
  {
    // A bad token goes to /join and is forgotten. On a slow connection the
    // screen still showing answers its own requests with the same 401 while
    // /join loads; those mustn't send the student to a parent's sign-in.
    const { page, close } = await open(fresh({ valid: false }), {
      slowJoin: 2000,
    });
    await page.waitForURL("**/join");
    await page.getByRole("heading", { name: "Type your class code" }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/join");
    assert.equal(
      await page.evaluate(() => sessionStorage.getItem("amp.student")),
      null,
    );
    await close();
  }
  {
    // Signing out ends only the student's sign-in, and goes to /join.
    const { page, requests, close } = await open(fresh());
    await page.getByRole("button", { name: "Go", exact: true }).waitFor();
    await drawer(page);
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL("**/join");
    assert.deepEqual(
      await page.evaluate(() => [
        sessionStorage.getItem("amp.student"),
        localStorage.getItem("amp.learner"),
      ]),
      [null, null],
    );
    assert.equal(requests.includes("/api/auth/sign-out"), false);
    await close();
  }
  console.log("School student UI verified");
} finally {
  await browser.close();
  await vite.close();
}
