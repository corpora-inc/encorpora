/**
 * Practice opened from a child's area is that child's (QA 2026-11-23), in a
 * real browser, as a family's first parent and as its second parent.
 *
 * A parent's screens show several children at once. Whatever a parent opens
 * from one child's area, and whatever is opened over that (a skill, a lesson
 * over the skill, an area, one of the child's answers and its lesson, a
 * "For today" entry about that child and its lesson), offers practice for
 * THAT child, started as the child's own Practice button starts it: the
 * hand-over (`POST /family/learners/<child>/practice-here`), the child's own
 * session, their own record, held to the skill, type or area the control is
 * about. Never another child, never the adult, never the learner last
 * selected on the device. The adult's own row starts the adult's own.
 *
 * For each of the family's children and for the adult's own row, at each
 * width, the check walks:
 *
 * - the child's block on Today, every link and opener in it;
 * - each "For today" entry that names that one child;
 * - the child's page, every link and opener on it, and their Pathways and
 *   Inventory under it;
 * - every layer or sheet reached from those, and the layers reached from
 *   them (two levels). Of a list's links of one kind under one heading it
 *   follows the first and the last from the child's own area (`--own all`:
 *   every one) and the first inside what those open (`--per N`: N of them);
 *
 * and presses every practice control it finds on the way. For each press it
 * reads the practice that opened: its address (whose, and held to what), the
 * hand-over it asked for, and the practice screen's own learner (whose
 * problems it asks for, with whose session). Before each child's walk the
 * device's selected learner is set to ANOTHER child, the state the slip
 * needed.
 *
 * Then, for each child: a skill open over Today survives a reload still
 * theirs; its shared link opens theirs in a fresh browser and leaves no
 * trace in the address once the layer is in place or closed; an address
 * edited to name a learner who isn't the family's offers no practice at all
 * and the server refuses the hand-over; the family's old class address, with
 * the child's record and a skill open, lands on the child's page with their
 * practice.
 *
 * A tutoring group is the family's class with another family's child in it:
 * it keeps its class address, and a child's record there is a layer over the
 * class's page. The check makes one (the account holder adds a student from
 * another family) and opens each of the family's own children there: the
 * skill over their record offers that child's practice, by the hand-over.
 * The other family's child's offers none.
 *
 * By default the check starts its own stack, as CI does: the real API
 * (accounts mode) on a fresh schema of AMP_TEST_DATABASE_URL, Vite in front.
 * Or point it at a running, seeded preview:
 *
 *   AMP_TEST_DATABASE_URL=postgres://…/amp_test npx tsx scripts/verify-child-practice-ui.ts [--port 4958]
 *   npx tsx scripts/verify-child-practice-ui.ts --origin http://127.0.0.1:4772
 *     [--widths 390,1280] [--people family,second-parent] [--kids Wren]
 *     [--own all] [--per 3] [--jobs 4] [--out artifacts/child-practice]
 *
 * Last, coming back: a parent scrolled down to a child's block starts that
 * child's practice (their row, a skill not asked yet, a skill opened from
 * their block) and returns by the bar's family mark or by Back. Today is
 * where they left it, the block at the same place on screen, at each width.
 *
 * The table of every press and return goes to <out>/presses.json.
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import {
  chromium as rawChromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { stubAnalytics } from "./analytics-stub";
import { startPersonaStack } from "./persona-stack";
import {
  PERSONA_PASSPHRASE,
  personaEmail,
} from "../src/web/features/dev/persona-list";

const chromium = secureChromium(rawChromium);
const argument = (name: string) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
};
const flag = (name: string) => process.argv.includes(`--${name}`);
const OUT = argument("out") ?? "artifacts/child-practice";
const WIDTHS = (argument("widths") ?? "390,1280").split(",").map(Number);
const PEOPLE = (argument("people") ?? "family,second-parent").split(",");
const ONLY_KIDS = argument("kids")?.split(",");
/** How many links of one kind under one heading are followed: from the
 * child's own area (`--own`, default 2: the first and the last; `all` for
 * every one), and inside what those open (`--per`, default 1). */
const OWN = argument("own") === "all" ? Infinity : Number(argument("own") ?? 2);
const PER = Number(argument("per") ?? 1);
const JOBS = Number(argument("jobs") ?? 4);
/** Only the later parts (a layer keeps whose it is; coming back). */
const NO_WALK = flag("no-walk");
/** Another family's parent: their child is nobody's here. */
const STRANGER = "parent-day1";
await mkdir(OUT, { recursive: true });
const stack = argument("origin")
  ? null
  : await startPersonaStack({
      webPort: Number(argument("port") ?? 4958),
      personas: ["family", "second-parent", STRANGER],
      name: "child_practice",
      out: OUT,
    });
const origin = argument("origin") ?? stack!.origin;

const failures: string[] = [];
const fail = (what: string) => {
  failures.push(what);
  console.log(`  FAIL ${what}`);
};

// ---- who -------------------------------------------------------------------
type Child = {
  id: string;
  name: string;
  person?: string;
  canPractice: boolean;
};
type Parent = {
  slug: string;
  accountId: string;
  token: string;
  /** Several sign-ins of theirs, taken in turn: the API limits requests
   * per credential (600 a minute), and the walk's browser profiles, side
   * by side, would share one. */
  states: Awaited<ReturnType<BrowserContext["storageState"]>>[];
  family: string;
  /** The family's own class, where its children are roster people. */
  place: { org: string; class: string } | null;
  children: Child[];
  /** The adult's own learner, once they practice themselves. */
  own: () => Promise<string | null>;
  /** The family's account holder (the second parent is not). */
  holder: boolean;
  /** The family's class holds other families' children too, now: a
   * tutoring group, which keeps its class address. */
  group: () => Promise<boolean>;
};

let browser: Browser;
async function api(
  token: string,
  path: string,
  method = "GET",
  body: unknown = {},
) {
  const response = await fetch(`${origin}/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: origin,
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
    },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
  return {
    status: response.status,
    body: (await response.json().catch(() => null)) as Record<
      string,
      any
    > | null,
  };
}
async function signIn(slug: string) {
  const context = await browser.newContext();
  const response = await context.request.post(
    `${origin}/api/auth/sign-in/email`,
    {
      headers: { Origin: origin },
      data: { email: personaEmail(slug), password: PERSONA_PASSPHRASE },
    },
  );
  assert.ok(response.ok(), `${slug} signs in: ${response.status()}`);
  const session = await (
    await context.request.get(`${origin}/api/auth/get-session`)
  ).json();
  const state = await context.storageState();
  await context.close();
  return { token: session.session.token as string, state };
}
async function parent(slug: string): Promise<Parent> {
  const { token, state } = await signIn(slug);
  const states = [state];
  for (let i = 0; i < JOBS + 2; i++) states.push((await signIn(slug)).state);
  const { families } = (await api(token, "/families")).body!;
  const family = families[0].familyId as string;
  const data = (await api(token, `/families/${family}`)).body!;
  const me = (await api(token, "/me")).body!;
  const place = families[0].classId
    ? { org: families[0].orgId as string, class: families[0].classId as string }
    : null;
  return {
    slug,
    accountId: me.account.id as string,
    token,
    states,
    family,
    place,
    children: (data.children as any[]).map((child) => ({
      id: child.id,
      name: child.name,
      person: child.classes.find((entry: any) => entry.id === place?.class)
        ?.personId,
      canPractice:
        !!child.capabilities.practiceHere && !!child.access.canPractice,
    })),
    own: async () =>
      ((await api(token, "/me")).body?.adultPractice?.learner?.id as
        string | undefined) ?? null,
    holder: families[0].role === "holder",
    group: async () =>
      !!(await api(token, "/families")).body?.families[0]?.teachingPlace,
  };
}

// ---- the page --------------------------------------------------------------
type Control = {
  /** What tells it from every other control in its scope. */
  sig: string;
  /** Which of several with the same signature. */
  n: number;
  tag: string;
  name: string;
  href: string | null;
  data: string;
  entity: string | null;
  /** The heading it sits under, for one-of-each-kind sampling. */
  section: string;
  practice: boolean;
  opener: boolean;
};
/** Every link and button on view inside `scope`, in order. Plain source: it
 * runs in the page, which has none of tsx's helpers. */
const CONTROLS = `(scope) => {
  const shown = (element) => {
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0 &&
      getComputedStyle(element).visibility !== "hidden" &&
      !element.closest("[aria-hidden=true], [inert]");
  };
  const seen = new Map();
  const out = [];
  const found = new Set();
  for (const root of document.querySelectorAll(scope))
    for (const element of [root, ...root.querySelectorAll("a, button")]) {
      if (!element.matches("a, button")) continue;
      if (found.has(element) || !shown(element) || element.disabled) continue;
      found.add(element);
      const name = (element.getAttribute("aria-label") ?? element.textContent ?? "")
        .replace(/\\s+/g, " ").trim();
      const href = element.tagName === "A" ? element.getAttribute("href") : null;
      const data = [...element.attributes]
        .filter((attribute) => attribute.name.startsWith("data-") && attribute.name !== "data-crawl")
        .map((attribute) => attribute.name + (attribute.value ? "=" + attribute.value : ""))
        .join(" ");
      const sig = [element.tagName, href ?? "", name, data].join("|");
      const n = seen.get(sig) ?? 0;
      seen.set(sig, n + 1);
      const section = (element.closest("section")?.querySelector("h2, h3")?.textContent ?? "").trim();
      const said = name + " " + (element.textContent ?? "");
      out.push({
        sig, n, tag: element.tagName, name, href, data, section,
        entity: element.getAttribute("data-entity"),
        practice:
          // A table's column named "Practice" sorts; it starts nothing.
          !element.closest("th, [role=columnheader]") && (
          !!element.closest("[data-curriculum-practice]") ||
          element.hasAttribute("data-practice-here") ||
          element.hasAttribute("data-practice-skill") ||
          /^\\/practice(\\/|$)/.test(href ?? "") ||
          /^(practice\\b|try (a|this|one)\\b|start practicing|let .+ practice)/i.test(said.trim())),
        opener:
          element.hasAttribute("data-not-asked") ||
          element.hasAttribute("data-own-devices"),
      });
    }
  return out;
}`;
const MARK = `([scope, sig, n, mark]) => {
  const seen = new Map();
  const found = new Set();
  for (const root of document.querySelectorAll(scope))
    for (const element of [root, ...root.querySelectorAll("a, button")]) {
      if (!element.matches("a, button")) continue;
      if (found.has(element)) continue;
      found.add(element);
      const box = element.getBoundingClientRect();
      if (!(box.width > 0 && box.height > 0) ||
        getComputedStyle(element).visibility === "hidden" ||
        element.closest("[aria-hidden=true], [inert]") || element.disabled) continue;
      const name = (element.getAttribute("aria-label") ?? element.textContent ?? "")
        .replace(/\\s+/g, " ").trim();
      const href = element.tagName === "A" ? element.getAttribute("href") : null;
      const data = [...element.attributes]
        .filter((attribute) => attribute.name.startsWith("data-") && attribute.name !== "data-crawl")
        .map((attribute) => attribute.name + (attribute.value ? "=" + attribute.value : ""))
        .join(" ");
      const own = [element.tagName, href ?? "", name, data].join("|");
      const at = seen.get(own) ?? 0;
      seen.set(own, at + 1);
      if (own === sig && at === n) {
        element.setAttribute("data-crawl", mark);
        return true;
      }
    }
  return false;
}`;
/** What is on view, as far as a step can change it: the address, the open
 * layers, and how many sheets and dialogs are up. */
const STATE = `() => JSON.stringify([
  location.pathname,
  document.querySelector("[data-layer-frame]")?.getAttribute("data-layers") ?? "",
  document.querySelector("[data-work-replay]")?.getAttribute("data-work-replay") ?? "",
  document.querySelectorAll("[role=dialog]").length,
])`;
type Shown = { path: string; layers: string; replay: string; dialogs: number };
const shown = async (page: Page): Promise<Shown> => {
  const [path, layers, replay, dialogs] = JSON.parse(
    (await page.evaluate(`(${STATE})()`)) as string,
  );
  return { path, layers, replay, dialogs };
};
/** Waits until what is on view holds still (a layer slid in, a sheet rose,
 * a page arrived). */
async function settle(page: Page) {
  let last = "";
  let since = Date.now();
  const until = Date.now() + 12_000;
  while (Date.now() < until) {
    const now = await page
      .evaluate(
        `(${STATE})() + (document.querySelector("[data-layer-panel][data-motion=in], [data-layer-panel][data-motion=out]") ? "moving" : "") + document.querySelectorAll("[aria-busy=true]").length`,
      )
      .catch(() => "navigating");
    if (now !== last) {
      last = now as string;
      since = Date.now();
    } else if (Date.now() - since > 450) return;
    await page.waitForTimeout(90);
  }
}

type Step = { scope: string; sig: string; n: number; label: string };
type Root = {
  name: string;
  path: string;
  /** On view once the root has its data. */
  ready: string;
  scope: string;
};
let marks = 0;
/** Whose sign-in the next browser profile takes (`Parent.states`). */
let turn = 0;
async function click(page: Page, step: Step) {
  const mark = `c${++marks}`;
  // A part of the screen may still be on its way (a record, a list).
  let found = false;
  for (let i = 0; i < 60 && !found; i++) {
    found = (await page
      .evaluate(
        `(${MARK})(${JSON.stringify([step.scope, step.sig, step.n, mark])})`,
      )
      .catch(() => false)) as boolean;
    if (!found) await page.waitForTimeout(250);
  }
  if (!found) throw new Error(`No control "${step.label}" in ${step.scope}`);
  const target = page.locator(`[data-crawl="${mark}"]`);
  await target.scrollIntoViewIfNeeded();
  await target.click({ timeout: 8000 });
}

/** This device's selected learner, as the app keeps it (learner-store.ts):
 * set to someone else before a child's walk. */
const SELECT = `([account, learner]) => {
  try {
    localStorage.setItem(
      "amp.learner",
      JSON.stringify({ state: { learners: { [account]: learner } }, version: 2 }),
    );
  } catch {}
}`;

/** A fresh browser profile of the parent's, at the root, with `steps`
 * replayed. `selected` is the learner this device last chose. */
async function open(
  who: Parent,
  width: number,
  root: Root,
  steps: Step[],
  selected: string | null,
) {
  const context = await browser.newContext({
    storageState: who.states[turn++ % who.states.length],
    viewport: { width, height: width >= 1024 ? 900 : 844 },
  });
  await stubAnalytics(context);
  await context.addInitScript("window.__name = (f) => f;");
  if (selected)
    await context.addInitScript(
      `(${SELECT})(${JSON.stringify([who.accountId, selected])})`,
    );
  const page = await context.newPage();
  const seen: Seen = { handOvers: [], asks: [], practicing: false };
  page.on("request", (request) => {
    const url = new URL(request.url());
    const hand = /^\/api\/v1\/family\/learners\/([^/]+)\/practice-here$/.exec(
      url.pathname,
    );
    if (hand && request.method() === "POST") seen.handOvers.push(hand[1]!);
    // Whatever the practice screen reads or asks for its learner: their
    // problems, their place in practice, their level.
    const ask = /^\/api\/v1\/learners\/([^/]+)\//.exec(url.pathname);
    if (ask && seen.practicing)
      seen.asks.push({
        learner: ask[1]!,
        authorization: request.headers().authorization ?? "",
      });
  });
  await page.goto(`${origin}${root.path}`, { waitUntil: "load" });
  await page.locator(root.ready).first().waitFor({ timeout: 30_000 });
  await settle(page);
  for (const step of steps) {
    await click(page, step);
    await settle(page);
  }
  return { context, page, seen };
}
type Seen = {
  handOvers: string[];
  /** The practice screen's own requests for a learner, once it is pressed. */
  asks: { learner: string; authorization: string }[];
  practicing: boolean;
};

// ---- a press ---------------------------------------------------------------
type Expect =
  | { kind: "child"; child: Child }
  /** The adult's own practice: no child's, and no hand-over. */
  | { kind: "self" };
type Press = {
  who: string;
  width: number;
  subject: string;
  trail: string;
  control: string;
  /** Whose practice opened, and how. */
  opened: string;
  ok: boolean;
};
const presses: Press[] = [];
/** Each return from a child's practice: where Today was, and came back. */
const returns: {
  where: string;
  before: { y: number; top: number | null };
  after: { y: number; top: number | null };
  ok: boolean;
}[] = [];
/** Whose session a request was made with: a child's own (a student account
 * with one learner), or an adult's. */
const sessions = new Map<string, { student: boolean; learner?: string }>();
async function sessionOf(authorization: string) {
  if (!sessions.has(authorization)) {
    const response = await fetch(`${origin}/api/v1/me`, {
      headers: { Authorization: authorization, Origin: origin },
    });
    const me = (await response.json().catch(() => null)) as any;
    sessions.set(authorization, {
      student: me?.account?.kind === "student",
      learner: me?.learners?.[0]?.id,
    });
  }
  return sessions.get(authorization)!;
}
const FOCUS = /^\/practice\/([^/]+)(?:\/(types|skills|areas)\/([^/]+))?\/?$/;

/** Presses the practice control at the end of `steps` and reads what
 * opened. */
async function press(
  who: Parent,
  width: number,
  root: Root,
  steps: Step[],
  control: Step,
  expect: Expect,
  subject: string,
  selected: string | null,
  /** What the practice must be held to, where the walk knows. */
  held?: { segment: "types" | "skills" | "areas"; id: string } | "mixed",
  /** A press that opened nothing at all (a slow machine) is made once
   * more; one that opened the wrong practice never is. */
  again = true,
): Promise<void> {
  const trail = [root.name, ...steps.map((step) => step.label)].join(" → ");
  const note = (opened: string, ok: boolean) => {
    presses.push({
      who: who.slug,
      width,
      subject,
      trail,
      control: control.label,
      opened,
      ok,
    });
    if (!ok)
      fail(
        `${who.slug} ${width}px, ${subject}: ${trail} → "${control.label}" opened ${opened}`,
      );
  };
  let opened: Awaited<ReturnType<typeof open>> | undefined;
  try {
    opened = await open(who, width, root, steps, selected);
    const { page, seen } = opened;
    seen.practicing = true;
    await click(page, control);
    await page.waitForURL((url) => FOCUS.test(url.pathname), {
      timeout: 30_000,
    });
    // The practice screen asks for its learner's problems and place.
    for (let i = 0; i < 150 && seen.asks.length === 0; i++)
      await page.waitForTimeout(100);
    // And whatever else it asks as it opens.
    await page.waitForTimeout(700);
    const [, learner, segment, id] = FOCUS.exec(new URL(page.url()).pathname)!;
    // Every one of them is for one learner, with one session.
    const asked = [...new Set(seen.asks.map((entry) => entry.learner))];
    const ask =
      asked.length === 1
        ? seen.asks.at(-1)
        : asked.length
          ? {
              learner: asked.join("+"),
              authorization: seen.asks.at(-1)!.authorization,
            }
          : undefined;
    const session = ask ? await sessionOf(ask.authorization) : null;
    const names = new Map(who.children.map((child) => [child.id, child.name]));
    const own = await who.own();
    const name = (learnerId: string | undefined) =>
      !learnerId
        ? "nobody"
        : (names.get(learnerId) ??
          (learnerId === own
            ? "the adult"
            : `someone else (${learnerId.slice(0, 8)})`));
    const said = [
      `${name(learner)}’s practice${segment ? ` (${segment}/${id})` : ""}`,
      seen.handOvers.length
        ? `handed over to ${seen.handOvers.map(name).join(", ")}`
        : "no hand-over",
      ask
        ? `asking problems for ${name(ask.learner)} with ${session?.student ? `${name(session.learner)}’s own session` : "the adult’s session"}`
        : "no problems asked",
    ].join("; ");
    let ok: boolean;
    if (expect.kind === "child") {
      const child = expect.child.id;
      ok =
        learner === child &&
        seen.handOvers.length === 1 &&
        seen.handOvers[0] === child &&
        ask?.learner === child &&
        !!session?.student &&
        session.learner === child;
    } else {
      ok =
        !!own &&
        learner === own &&
        seen.handOvers.length === 0 &&
        ask?.learner === own &&
        session?.student === false;
    }
    if (ok && held)
      ok =
        held === "mixed"
          ? !segment
          : segment === held.segment &&
            decodeURIComponent(id ?? "") === held.id;
    note(
      said +
        (held && held !== "mixed"
          ? `; expected ${held.segment}/${held.id}`
          : ""),
      ok,
    );
  } catch (error) {
    if (again) {
      await opened?.context.close().catch(() => undefined);
      opened = undefined;
      console.log(
        `    (again: ${trail} → "${control.label}": ${String(error).split("\n")[0]!.slice(0, 90)})`,
      );
      return press(
        who,
        width,
        root,
        steps,
        control,
        expect,
        subject,
        selected,
        held,
        false,
      );
    }
    // What the screen said, if it said why (an alert beside the control).
    const said = await opened?.page
      .locator("[role=alert]")
      .allTextContents()
      .catch(() => []);
    note(
      `nothing (${String(error).split("\n")[0]!.slice(0, 140)}) at ${opened ? new URL(opened.page.url()).pathname : "?"}${said?.length ? `, saying “${said.join(" / ").slice(0, 120)}”` : ""}`,
      false,
    );
  } finally {
    await opened?.context.close().catch(() => undefined);
  }
}

// ---- the walk --------------------------------------------------------------
/** A press is a browser profile of its own: at most `--jobs` of them at
 * once, whichever walks queued them. */
let pressing = 0;
const queued: (() => void)[] = [];
async function limited(job: () => Promise<void>) {
  if (pressing >= JOBS)
    await new Promise<void>((resolve) => queued.push(resolve));
  else pressing++;
  try {
    await job();
  } finally {
    // The next in line takes this place.
    const next = queued.shift();
    if (next) next();
    else pressing--;
  }
}
/** Controls that are no way into anything a child's: a download, a setting,
 * the family's own live session, the menu. */
const LEAVE =
  /^(download|copy|copied|start practice|reset|change|lock|calm|colorful|withdraw|delete|working together|show grade level|daily|weekly|no limit|\d+ min|birth year|close|back|menu|open menu|sign out|print)/i;
/** What a step opened, as where its controls are: a layer's panel, an
 * answer's replay (a base of its own), a sheet, or another page. */
const scopeOf = (now: Shown, before: Shown): string | null => {
  if (now.layers && now.layers !== before.layers) return "[data-layer-frame]";
  if (now.replay && now.replay !== before.replay) return "[data-work-replay]";
  if (now.dialogs > before.dialogs) return "[role=dialog]";
  if (now.path !== before.path) return "main, [data-shell-action]";
  return null;
};
/** What a layer's practice must be held to: a skill, a problem type, an
 * area; the whole level is mixed. */
const heldBy = (layers: string): Parameters<typeof press>[8] => {
  const top = layers.split(",").filter(Boolean).at(-1);
  if (!top) return undefined;
  const kind = top.slice(0, top.indexOf(":"));
  const id = top.slice(top.indexOf(":") + 1);
  if (kind === "skill") return { segment: "skills", id };
  if (kind === "lesson") return { segment: "types", id };
  if (kind === "area")
    return id === "overall" ? "mixed" : { segment: "areas", id };
  return undefined;
};
/** The links of one kind under one heading that are followed: `--own` of
 * them from the child's own area (the first ones, and the last), `--per`
 * inside what that opened. */
const sample = <T>(items: T[], kind: (item: T) => string, depth: number) => {
  const take = depth === 0 ? OWN : PER;
  const groups = new Map<string, T[]>();
  for (const item of items)
    groups.set(kind(item), [...(groups.get(kind(item)) ?? []), item]);
  return [...groups.values()].flatMap((group) =>
    group.length <= take
      ? group
      : take <= 1
        ? [group[0]!]
        : [...group.slice(0, take - 1), group.at(-1)!],
  );
};
let nodes = 0;

async function walk(
  who: Parent,
  width: number,
  root: Root,
  expect: Expect,
  subject: string,
  selected: string | null,
  /** Pages that are roots of their own (the child's page): reached from
   * here they are pressed, and walked in their own turn. */
  own: readonly string[] = [],
  /** The child's own pages (`/family/<f>/kids/<child>…`): a link to any
   * other page (the family's grades, its workbooks) leaves their area. */
  area?: string,
) {
  const pending: Promise<void>[] = [];
  const visited = new Set<string>();
  // One page reads the root's tree; each press is a profile of its own.
  const reader = await open(who, width, root, [], selected);
  const page = reader.page;
  try {
    const home = await shown(page);
    /** The root again, as it first showed: its layers and sheets away. */
    const reset = async () => {
      for (let i = 0; i < 6; i++) {
        const now = await shown(page);
        if (JSON.stringify(now) === JSON.stringify(home)) return;
        if (now.path !== home.path) break;
        await page.keyboard.press("Escape");
        await settle(page);
      }
      await page
        .evaluate(() => sessionStorage.removeItem("amp.layers"))
        .catch(() => undefined);
      await page.goto(`${origin}${root.path}`, { waitUntil: "load" });
      await page.locator(root.ready).first().waitFor({ timeout: 30_000 });
      await settle(page);
    };
    const go = async (steps: Step[]) => {
      await reset();
      for (const step of steps) {
        await click(page, step);
        await settle(page);
      }
    };
    /** Reads the node the page is at (`steps` from the root): queues its
     * presses, then goes into what its links open. */
    const node = async (steps: Step[], scope: string, depth: number) => {
      nodes++;
      const here = await shown(page);
      const controls = (await page.evaluate(
        `(${CONTROLS})(${JSON.stringify(scope)})`,
      )) as Control[];
      const step = (control: Control): Step => ({
        scope,
        sig: control.sig,
        n: control.n,
        label: control.name.slice(0, 60) || control.tag,
      });
      const practice = controls.filter(
        (control) =>
          control.practice &&
          !/^start practice/i.test(control.name) &&
          // The adult's own row is the adult's walk.
          (expect.kind === "self" || !/as yourself/i.test(control.name)),
      );
      // In a long list of one control (a sheet's skills), a few of them.
      for (const control of depth === 0
        ? practice
        : sample(
            practice,
            (entry) => entry.data.replace(/=[^ ]*/g, "") + entry.section,
            0,
          )) {
        const skill = /data-practice-skill=([^ ]+)/.exec(control.data)?.[1];
        const held = skill
          ? ({ segment: "skills", id: skill } as const)
          : scope === "[data-layer-frame]"
            ? heldBy(here.layers)
            : undefined;
        pending.push(
          limited(() =>
            press(
              who,
              width,
              root,
              steps,
              step(control),
              expect,
              subject,
              selected,
              held,
            ),
          ),
        );
      }
      if (depth >= 2 || (depth > 0 && own.includes(here.path))) return;
      const ways = controls.filter(
        (control) =>
          !control.practice &&
          !LEAVE.test(control.name) &&
          !visited.has(`${depth}:${control.href ?? control.sig}`) &&
          (control.entity ||
            control.opener ||
            // Every link of the child's own area; deeper, layers only.
            (depth === 0 && control.href?.startsWith("/"))),
      );
      for (const way of sample(
        ways,
        (entry) =>
          entry.entity || entry.opener
            ? `${entry.entity}:${entry.opener}:${entry.section}`
            : entry.sig,
        depth,
      )) {
        const target = `${depth}:${way.href ?? way.sig}`;
        if (visited.has(target)) continue;
        visited.add(target);
        const next = [...steps, step(way)];
        try {
          await go(next);
        } catch (error) {
          // Drawn and not reachable (under another control, off a map's
          // view): nobody can press it either.
          console.log(
            `    (not reached: ${[root.name, ...next.map((entry) => entry.label)].join(" → ")}: ${String(error).split("\n")[0]!.slice(0, 90)})`,
          );
          continue;
        }
        const now = await shown(page);
        if (now.path !== here.path && !(area && now.path.startsWith(area))) {
          console.log(
            `    (leaves ${subject}’s area: ${[root.name, ...next.map((entry) => entry.label)].join(" → ")} is ${now.path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, "…")})`,
          );
          continue;
        }
        const inner = scopeOf(now, here);
        if (inner) await node(next, inner, depth + 1);
      }
    };
    await node([], root.scope, 0);
  } finally {
    await reader.context.close();
  }
  await Promise.all(pending);
}

// ---- the run ---------------------------------------------------------------
browser = await chromium.launch();
try {
  const stranger = await parent(STRANGER).catch((error: unknown) => {
    console.log(`No ${STRANGER} persona here: ${String(error).split("\n")[0]}`);
    return null;
  });
  const parents: Parent[] = [];
  for (const slug of PEOPLE) {
    const who = await parent(slug);
    parents.push(who);
    const kids = who.children.filter(
      (child) => !ONLY_KIDS || ONLY_KIDS.includes(child.name),
    );
    assert.ok(who.children.length >= 2, `${slug} has several children`);
    console.log(
      `\n${slug}: ${who.children.map((child) => child.name).join(", ")}`,
    );
    const today = `/family/${who.family}`;
    const tasks = ((await api(who.token, `/families/${who.family}`)).body!.today
      .tasks ?? []) as { id: string; students: { id: string }[] }[];
    for (const width of WIDTHS) {
      // One child's walk at a time; its presses run beside its reading,
      // under the one limit.
      const walked = (subject: string) =>
        presses.filter(
          (entry) =>
            entry.who === slug &&
            entry.width === width &&
            entry.subject === subject,
        );
      const each = async (child: Child) => {
        // The device last chose someone else: the slip's own condition.
        const other = who.children.find((entry) => entry.id !== child.id)!.id;
        const expect: Expect = { kind: "child", child };
        if (!child.canPractice) {
          console.log(
            `  ${child.name} can’t practice here: no control is offered`,
          );
        }
        const roots: Root[] = [
          {
            name: `Today, ${child.name}’s block`,
            path: today,
            ready: "[data-family-kids] [data-child]",
            scope: `[data-family-kids] > li[data-child="${child.id}"]`,
          },
          ...tasks
            .filter(
              (task) =>
                task.students.length === 1 && task.students[0]!.id === child.id,
            )
            .map((task) => ({
              name: `Today, “For today” (${task.id.split(":")[0]})`,
              path: today,
              ready: "[data-family-kids] [data-child]",
              scope: `[data-feed="${task.id}"]`,
            })),
          {
            name: `${child.name}’s page`,
            path: `${today}/kids/${child.id}`,
            ready: "[data-child-page]",
            scope: "[data-child-page], [data-shell-action]",
          },
        ];
        if (NO_WALK) return;
        for (const root of roots)
          await walk(
            who,
            width,
            root,
            expect,
            child.name,
            other,
            roots.map((entry) => entry.path).filter((path) => path !== today),
            `${today}/kids/${child.id}`,
          );
        const mine = walked(child.name);
        console.log(
          `  ${width}px ${child.name}: ${mine.length} practice controls pressed, ${mine.filter((entry) => !entry.ok).length} wrong`,
        );
        if (child.canPractice && mine.length === 0)
          fail(
            `${slug} ${width}px: no practice control found for ${child.name}`,
          );
      };
      for (const child of kids) await each(child);
      // The adult's own row: their own practice, whoever was last selected.
      if (!ONLY_KIDS && !NO_WALK) {
        await walk(
          who,
          width,
          {
            name: "Today, the adult’s own row",
            path: today,
            ready: "[data-family-kids] [data-child]",
            scope: "[data-family-self]",
          },
          { kind: "self" },
          "the adult",
          who.children[0]!.id,
        );
        const mine = walked("the adult");
        console.log(
          `  ${width}px the adult: ${mine.length} pressed, ${mine.filter((entry) => !entry.ok).length} wrong`,
        );
      }
    }

    // ---- a layer keeps whose it is ---------------------------------------
    const width = WIDTHS.at(-1)!;
    for (const child of kids.filter((entry) => entry.canPractice)) {
      // Which part is under way, for a failure's report.
      let part = "a skill from their block";
      try {
        const other = who.children.find((entry) => entry.id !== child.id)!.id;
        const block = `[data-family-kids] > li[data-child="${child.id}"]`;
        const root: Root = {
          name: `Today, ${child.name}’s block`,
          path: today,
          ready: "[data-family-kids] [data-child]",
          scope: block,
        };
        const first = await open(who, width, root, [], other);
        const link = first.page
          .locator(`${block} a[data-entity=skill]`)
          .first();
        if (!(await link.count())) {
          console.log(`  ${child.name} has no skill in their block yet`);
          await first.context.close();
          continue;
        }
        const href = (await link.getAttribute("href"))!;
        const skill = /open=skill(?:%3A|:)([a-z0-9-]+)/.exec(href)?.[1];
        assert.ok(skill, `a skill link names its skill: ${href}`);
        const practice = "[data-layer-frame] [data-curriculum-practice] button";
        const label = `Practice … with ${child.name}`;
        const started = async (page: Page, seen: Seen, where: string) => {
          const name = await page.locator(practice).getAttribute("aria-label");
          if (
            !name?.startsWith("Practice ") ||
            !name.endsWith(` with ${child.name}`)
          )
            fail(
              `${slug} ${child.name}, ${where}: the control is named “${name}”, not “${label}”`,
            );
          await page.locator(practice).click();
          await page.waitForURL((url) => FOCUS.test(url.pathname), {
            timeout: 20_000,
          });
          const [, learner, segment, id] = FOCUS.exec(
            new URL(page.url()).pathname,
          )!;
          const ok =
            learner === child.id &&
            segment === "skills" &&
            id === skill &&
            seen.handOvers.join() === child.id;
          presses.push({
            who: slug,
            width,
            subject: child.name,
            trail: where,
            control: name ?? "",
            opened: `${learner} ${segment}/${id}, handed to ${seen.handOvers.join()}`,
            ok,
          });
          if (!ok)
            fail(
              `${slug} ${child.name}, ${where}: opened /practice/${learner}/${segment}/${id}, handed to [${seen.handOvers}]`,
            );
        };
        // A reload with the layer open: still theirs.
        part = "a reload with the layer open";
        await link.click();
        await first.page.locator(practice).waitFor();
        await first.page.reload({ waitUntil: "load" });
        await first.page.locator(practice).waitFor({ timeout: 30_000 });
        await settle(first.page);
        await started(
          first.page,
          first.seen,
          "a skill from their block, reloaded",
        );
        await first.context.close();

        // Its shared link, in a fresh browser: theirs, and no trace is left.
        part = "the layer’s shared link";
        assert.match(href, new RegExp(`[?&]for=${child.id}(&|$)`), href);
        const shared = await open(
          who,
          width,
          { ...root, path: href, name: "the layer’s shared link" },
          [],
          other,
        );
        await shared.page.locator(practice).waitFor({ timeout: 30_000 });
        await settle(shared.page);
        const settled = new URL(shared.page.url());
        if (settled.pathname !== today || settled.search)
          fail(
            `${slug} ${child.name}: a shared link left ${settled.pathname}${settled.search} in the address`,
          );
        // Closed and opened again from ANOTHER child's block: that child's.
        await shared.page.keyboard.press("Escape");
        await shared.page
          .locator("[data-layer-frame]")
          .waitFor({ state: "detached" });
        if (new URL(shared.page.url()).search)
          fail(`${slug} ${child.name}: closing left ${shared.page.url()}`);
        const stored = await shared.page.evaluate(
          () => sessionStorage.getItem("amp.layers") ?? "",
        );
        if (stored.includes(child.id))
          fail(
            `${slug} ${child.name}: a closed layer left their id in the store`,
          );
        await shared.context.close();
        const again = await open(
          who,
          width,
          { ...root, path: href, name: "the layer’s shared link" },
          [],
          other,
        );
        await again.page.locator(practice).waitFor({ timeout: 30_000 });
        await settle(again.page);
        await started(again.page, again.seen, "a skill’s shared link");
        await again.context.close();

        part = "an edited address";
        // An edited address: a learner who isn't the family's has no control,
        // here or over the child's own page.
        const foreign = [
          stranger?.children[0]?.id,
          "00000000-0000-4000-8000-000000000001",
        ].filter((id): id is string => !!id);
        for (const id of foreign)
          for (const path of [
            `${today}?open=skill:${skill}&for=${id}`,
            `${today}/kids/${child.id}?open=skill:${skill}&for=${id}`,
          ]) {
            const edited = await open(
              who,
              width,
              {
                ...root,
                path,
                name: "an edited address",
                ready: "[data-skill-layer]",
              },
              [],
              child.id,
            );
            await settle(edited.page);
            const offered = await edited.page
              .locator("[data-layer-frame] [data-curriculum-practice]")
              .count();
            if (offered)
              fail(
                `${slug}: ${path.replace(today, "")} offers practice for a learner who isn’t the family’s`,
              );
            await edited.context.close();
          }
        // And the server refuses the hand-over itself.
        for (const id of foreign) {
          const refused = await api(
            who.token,
            `/family/learners/${id}/practice-here`,
            "POST",
          );
          if (refused.status !== 404 && refused.status !== 403)
            fail(
              `${slug}: the server answered ${refused.status} to a hand-over for a learner outside the family`,
            );
        }

        part = "the family’s old class address";
        // The family's old class address, the child's record and a skill
        // open: their page, with their practice. (Once the class is a
        // tutoring group the address is the class's own: the part below.)
        if (who.place && child.person && !(await who.group())) {
          const old = await open(
            who,
            width,
            {
              name: "the family’s old class address",
              path: `/school/${who.place.org}/classes/${who.place.class}/today?open=student:${child.person},skill:${skill}`,
              ready: "[data-child-page]",
              scope: "[data-child-page]",
            },
            [],
            other,
          );
          await old.page.locator(practice).waitFor({ timeout: 30_000 });
          await settle(old.page);
          if (new URL(old.page.url()).pathname !== `${today}/kids/${child.id}`)
            fail(
              `${slug} ${child.name}: the old class address opened ${old.page.url()}`,
            );
          await started(old.page, old.seen, "the family’s old class address");
          await old.context.close();
        }
      } catch (error) {
        fail(
          `${slug} ${child.name}, a layer keeps whose it is (${part}): ${String(error).split("\n")[0]!.slice(0, 200)}`,
        );
      }
    }

    // ---- coming back is where the parent was ------------------------------
    // A parent scrolls down to a child's block, starts their practice (their
    // row, a skill not asked yet, a skill opened from their block), and
    // comes back by the bar's family mark or by Back: Today is where they
    // left it, the child's block at the same place on screen, never at the
    // top of the page (QA 2026-11-23).
    for (const width of WIDTHS) {
      // The lowest child on the page who can practice: the furthest scroll.
      const child = [...kids].reverse().find((entry) => entry.canPractice);
      if (!child) continue;
      const other = who.children.find((entry) => entry.id !== child.id)!.id;
      const block = `[data-family-kids] > li[data-child="${child.id}"]`;
      const sheet = "[data-not-asked-sheet] [data-practice-skill]";
      const layer = "[data-layer-frame] [data-curriculum-practice] button";
      const ways = [
        {
          name: "their row’s Practice",
          anchor: `${block} [data-practice-here]`,
          start: async (page: Page) =>
            page.locator(`${block} [data-practice-here]`).click(),
        },
        {
          name: "a skill not asked yet",
          anchor: `${block} [data-not-asked]`,
          start: async (page: Page) => {
            await page.locator(`${block} [data-not-asked]`).first().click();
            await page.locator(sheet).first().click();
          },
        },
        {
          name: "a skill opened from their block",
          anchor: `${block} a[data-entity=skill]`,
          start: async (page: Page) => {
            await page.locator(`${block} a[data-entity=skill]`).first().click();
            await page.locator(layer).click();
          },
        },
      ];
      const place = (page: Page) =>
        page.evaluate((selector) => {
          const box = document.querySelector(selector)?.getBoundingClientRect();
          return {
            y: Math.round(scrollY),
            top: box ? Math.round(box.top) : null,
            path: location.pathname,
          };
        }, block);
      for (const way of ways)
        for (const back of ["the family mark", "Back"] as const) {
          const where = `${slug} ${width}px, ${child.name}, ${way.name}, back by ${back}`;
          const at = await open(
            who,
            width,
            {
              name: "Today",
              path: today,
              ready: "[data-family-kids] [data-child]",
              scope: block,
            },
            [],
            other,
          );
          try {
            const { page } = at;
            if (!(await page.locator(way.anchor).count())) {
              console.log(`  (${where}: nothing to start from)`);
              continue;
            }
            // Its control a little under the bar, as a parent reading the
            // block has it.
            await page.evaluate((selector) => {
              const box = document
                .querySelector(selector)!
                .getBoundingClientRect();
              scrollTo({ top: box.top + scrollY - 220, behavior: "instant" });
            }, way.anchor);
            await settle(page);
            const before = await place(page);
            await way.start(page);
            await page.waitForURL((url) => FOCUS.test(url.pathname), {
              timeout: 20_000,
            });
            const mark = page.locator("[data-handed-home]").first();
            await mark.waitFor({ timeout: 20_000 });
            await page.waitForLoadState("networkidle").catch(() => undefined);
            if (back === "Back") await page.goBack();
            else await mark.click();
            await page.waitForURL((url) => url.pathname === today, {
              timeout: 20_000,
            });
            await page.locator(block).waitFor({ timeout: 30_000 });
            await settle(page);
            await page.waitForTimeout(400);
            const after = await place(page);
            const ok =
              before.top !== null &&
              after.top !== null &&
              Math.abs(after.y - before.y) <= 2 &&
              Math.abs(after.top - before.top) <= 2;
            returns.push({ where, before, after, ok });
            if (!ok)
              fail(
                `${where}: Today was at ${before.y}px with their block at ${before.top}px; it came back at ${after.y}px with their block at ${after.top}px`,
              );
            // A phone's Today is long: the walk really was down the page.
            if (width < 600 && before.y < 200)
              fail(`${where}: the check never scrolled (${before.y}px)`);
          } catch (error) {
            fail(`${where}: ${String(error).split("\n")[0]!.slice(0, 160)}`);
          } finally {
            await at.context.close();
          }
        }
      const mine = returns.filter((entry) =>
        entry.where.startsWith(`${slug} ${width}px`),
      );
      console.log(
        `  ${width}px coming back: ${mine.length} returns, ${mine.filter((entry) => !entry.ok).length} not where the parent was`,
      );
    }
  }

  // ---- a tutoring group: a child's record in their parent's own class ----
  // The family's class with another family's child in it keeps its class
  // address; a student's record there is a layer over the class's page. A
  // parent over their own child's record gets that child's practice. Over
  // the other family's child's, as for any staff, none.
  const tutor = parents.find((who) => who.holder && who.place);
  if (tutor) {
    console.log(`\n${tutor.slug}, the family’s class as a tutoring group`);
    if (!(await tutor.group())) {
      const added = await api(tutor.token, "/family/class/students", "POST", {
        nickname: "JR",
        birthYear: 2015,
      });
      assert.equal(
        added.status,
        201,
        `a student from another family: ${added.status}`,
      );
    }
    const width = WIDTHS.at(-1)!;
    const { org, class: classId } = tutor.place!;
    const at = `/school/${org}/classes/${classId}/today`;
    const teaching = (
      await api(tutor.token, `/families/${tutor.family}/teaching`)
    ).body!;
    const own = new Set(tutor.children.map((child) => child.id));
    const hosted = (
      teaching.students as { id: string; learnerId: string; name: string }[]
    ).find((student) => !own.has(student.learnerId));
    const catalog = (await api(tutor.token, "/catalog/map")).body!;
    const skill = (catalog.templates as { skillId: string }[])[0]!.skillId;
    const control = "[data-layer-frame] [data-curriculum-practice]";
    const record = (person: string): Root => ({
      name: "their record in the tutoring group",
      path: `${at}?open=student:${person},skill:${skill}`,
      ready: "[data-skill-layer]",
      scope: "[data-layer-frame]",
    });
    for (const child of tutor.children.filter(
      (entry) => entry.person && (!ONLY_KIDS || ONLY_KIDS.includes(entry.name)),
    )) {
      const other = tutor.children.find((entry) => entry.id !== child.id)!.id;
      const where = `${tutor.slug} ${child.name}, their record in the tutoring group`;
      let opened: Awaited<ReturnType<typeof open>> | undefined;
      try {
        opened = await open(tutor, width, record(child.person!), [], other);
        const { page, seen } = opened;
        await settle(page);
        if (new URL(page.url()).pathname !== at)
          fail(`${where}: the class address opened ${page.url()}`);
        const button = page.locator(`${control} button`);
        if (!child.canPractice) {
          if (await page.locator(control).count())
            fail(
              `${where}: a control is offered to a child who can’t practice`,
            );
          continue;
        }
        await button.waitFor({ timeout: 20_000 });
        const name = await button.getAttribute("aria-label");
        if (
          !name?.startsWith("Practice ") ||
          !name.endsWith(` with ${child.name}`)
        )
          fail(`${where}: the control is named “${name}”`);
        await button.click();
        await page.waitForURL((url) => FOCUS.test(url.pathname), {
          timeout: 20_000,
        });
        const [, learner, segment, id] = FOCUS.exec(
          new URL(page.url()).pathname,
        )!;
        const ok =
          learner === child.id &&
          segment === "skills" &&
          id === skill &&
          seen.handOvers.join() === child.id;
        presses.push({
          who: tutor.slug,
          width,
          subject: child.name,
          trail: "their record in the tutoring group → a skill",
          control: name ?? "",
          opened: `${learner} ${segment}/${id}, handed to ${seen.handOvers.join()}`,
          ok,
        });
        if (!ok)
          fail(
            `${where}: opened /practice/${learner}/${segment}/${id}, handed to [${seen.handOvers}]`,
          );
      } catch (error) {
        fail(`${where}: ${String(error).split("\n")[0]!.slice(0, 200)}`);
      } finally {
        await opened?.context.close();
      }
    }
    // Another family's child: a student here, nobody's to practice as.
    if (!hosted)
      fail(`${tutor.slug}: the tutoring group has no other family’s child`);
    else
      try {
        const theirs = await open(
          tutor,
          width,
          record(hosted.id),
          [],
          tutor.children[0]!.id,
        );
        await settle(theirs.page);
        if (await theirs.page.locator(control).count())
          fail(
            `${tutor.slug}: another family’s child’s record in the tutoring group offers practice`,
          );
        await theirs.context.close();
      } catch (error) {
        fail(
          `${tutor.slug}, another family’s child’s record in the tutoring group: ${String(error).split("\n")[0]!.slice(0, 200)}`,
        );
      }
  }
} finally {
  await writeFile(
    `${OUT}/presses.json`,
    JSON.stringify({ presses, returns }, null, 1),
  );
  await browser.close();
  await stack?.stop();
}
const wrong = presses.filter((entry) => !entry.ok);
console.log(
  `\n${presses.length} practice controls pressed; ${wrong.length} opened someone else’s practice or none. ${returns.length} returns; ${returns.filter((entry) => !entry.ok).length} not where the parent was. ${nodes} screens, layers and sheets read.`,
);
if (failures.length) {
  console.error(`\n${failures.length} failed:`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log("Child practice checks passed.");
