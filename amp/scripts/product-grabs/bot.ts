/**
 * Drive AMP's practice screen like a fast, human learner. The answer comes
 * from solver.ts (the public template, seed and open-source generators); the
 * hands are ordinary taps on the visible controls, with human pacing.
 *
 * Response formats this bot can enter: number, fraction, choice,
 * multi-select, figure-choice. The batch request asks only for those (an
 * older client does the same), so every served problem is enterable.
 */
import type { Page, Request } from "playwright";
import type { PublicProblem } from "../../src/math/contracts.ts";
import { solve, type Caps } from "./solver.ts";
import type { Recorder } from "./recorder.ts";

export const DRIVABLE = ["single-choice-v1", "multi-select-v1", "figure-choice-v1"];
type Known = { pub: PublicProblem; caps: Caps; answered: boolean; servedAt: number };

export class Bot {
  known = new Map<string, Known>();
  log: { at: number; problemId: string; templateId: string; skillId: string; kind: string; correct: boolean; intended: boolean; result?: unknown }[] = [];
  notes: string[] = [];
  private lastCaps: Caps | null = null;
  constructor(public page: Page, public rec?: Recorder) {}

  async install() {
    await this.page.route("**/api/v1/learners/*/batches", async (route) => {
      const req = route.request();
      let body: any = {};
      try {
        body = JSON.parse(req.postData() ?? "{}");
      } catch {}
      if (Array.isArray(body.responseCapabilities))
        body.responseCapabilities = body.responseCapabilities.filter((c: string) => DRIVABLE.includes(c));
      this.lastCaps = { responseCapabilities: body.responseCapabilities ?? [], figureCapabilities: body.figureCapabilities ?? [] };
      await route.continue({ postData: JSON.stringify(body) });
    });
    // Seen for live and replayed batches alike (a replay answers before the
    // route above runs): the capabilities the problems were generated for.
    this.page.on("request", (req) => {
      if (!/\/batches$/.test(new URL(req.url()).pathname) || req.method() !== "POST") return;
      try {
        const body = JSON.parse(req.postData() ?? "{}");
        this.lastCaps = {
          responseCapabilities: (body.responseCapabilities ?? []).filter((c: string) => DRIVABLE.includes(c)),
          figureCapabilities: body.figureCapabilities ?? [],
        };
      } catch {}
    });
    this.page.on("response", async (r) => {
      const url = r.url();
      if (/\/api\/v1\/(learners\/[^/]+\/batches|school\/.*batches)/.test(url) && r.ok()) {
        try {
          const json = await r.json();
          for (const p of json.problems ?? [])
            if (!this.known.has(p.id))
              this.known.set(p.id, { pub: p, caps: this.lastCaps ?? { responseCapabilities: DRIVABLE, figureCapabilities: [] }, answered: false, servedAt: Date.now() });
        } catch (e) {
          this.notes.push(`batch parse: ${String(e).slice(0, 100)}`);
        }
      }
      if (/\/attempts$|\/skips$/.test(url) && r.request().method() === "POST") {
        try {
          const id = JSON.parse(r.request().postData() ?? "{}").problemId;
          const k = this.known.get(id);
          if (k) k.answered = true;
          if (/\/attempts$/.test(url)) {
            const json = await r.json().catch(() => null);
            const entry = this.log.find((l) => l.problemId === id && l.result === undefined);
            if (entry) entry.result = json ? { correct: json.correct, status: r.status() } : { status: r.status() };
          }
        } catch {}
      }
    });
  }

  /** The problem on screen: the unanswered one whose prompt's numbers match. */
  async current(): Promise<Known | null> {
    const shown = await this.page.locator("#problem-prompt").first().innerText({ timeout: 15000 }).catch(() => "");
    const sig = (s: string) => (s.replace(/\\[a-z]+/g, " ").match(/\d+(?:\.\d+)?/g) ?? []).join(",");
    const words = (s: string) => new Set(s.toLowerCase().match(/[a-z]{4,}/g) ?? []);
    const open = [...this.known.values()].filter((k) => !k.answered);
    let best: Known | null = null, score = -1;
    for (const k of open) {
      const a = sig(k.pub.prompt), b = sig(shown);
      const wa = words(k.pub.prompt), wb = words(shown);
      const overlap = [...wa].filter((w) => wb.has(w)).length / Math.max(1, wa.size);
      const s = (a === b ? 2 : 0) + overlap;
      if (s > score) (score = s), (best = k);
    }
    return best;
  }

  async waitForProblem(timeout = 20000) {
    await this.page.locator("#problem-prompt").first().waitFor({ timeout });
  }

  private async press(locator: ReturnType<Page["locator"]>, settle = 180) {
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    const box = await locator.boundingBox();
    if (box) await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
    await this.page.waitForTimeout(settle);
    await locator.click({ timeout: 8000 });
  }

  /** Answer the visible problem. `correct=false` makes a plausible slip.
   * `think` is the reading pause before the first touch, in ms. */
  async answer(correct: boolean, think = 1200, typeDelay = 140): Promise<{ ok: boolean; kind?: string; error?: string }> {
    await this.waitForProblem();
    const k = await this.current();
    if (!k) return { ok: false, error: "no known problem on screen" };
    const s = solve(k.pub, k.caps);
    if ("error" in s) return { ok: false, error: s.error };
    const page = this.page;
    await page.waitForTimeout(think);
    // Phone layouts can fold the entry behind one button.
    const compact = page.locator(".compact-answer-action").first();
    if (await compact.isVisible().catch(() => false)) {
      await this.press(compact);
      await page.waitForTimeout(350);
    }
    const id = k.pub.id;
    let given = s.answer;
    if (s.kind === "number" || s.kind === "fraction") {
      if (!correct) given = slip(s.answer);
      const keypad = page.locator(".math-keypad");
      if (await keypad.isVisible().catch(() => false)) {
        for (const ch of given) {
          const name = ch === "/" ? "Fraction slash" : ch === "." ? "Decimal point" : ch === "-" ? "Change positive or negative sign" : ch;
          await this.press(keypad.getByRole("button", { name, exact: true }), 60);
          await page.waitForTimeout(typeDelay);
        }
      } else {
        const input = page.locator("#answer").first();
        await this.press(input, 120);
        await input.pressSequentially(given, { delay: typeDelay });
      }
      await page.waitForTimeout(250);
      await this.press(page.locator("form button[type=submit]").filter({ visible: true }).first());
    } else if (s.kind === "choice" || s.kind === "figure-choice") {
      const options = s.options ?? [];
      if (!correct) given = options.find((o) => o.id !== s.answer)?.id ?? s.answer;
      const radio = page.locator(`input[type=radio][value="${cssEscape(given)}"]`).filter({ visible: true }).first();
      const target = (await radio.count()) ? radio : page.locator(`label:has(input[type=radio][value="${cssEscape(given)}"])`).first();
      await this.press(page.locator(`label:has(input[type=radio][value="${cssEscape(given)}"])`).first().or(target).first());
      await page.waitForTimeout(350);
      await this.press(page.getByRole("button", { name: "Check", exact: true }).filter({ visible: true }).first());
    } else if (s.kind === "multi-select") {
      let ids: string[] = JSON.parse(s.answer);
      if (!correct) {
        const other = (s.options ?? []).find((o) => !ids.includes(o.id));
        if (other) ids = [...ids.slice(0, -1), other.id];
      }
      for (const opt of ids) {
        await this.press(page.locator(`label:has(input[value="${cssEscape(opt)}"])`).first());
        await page.waitForTimeout(300);
      }
      await this.press(page.getByRole("button", { name: "Check", exact: true }).filter({ visible: true }).first());
    } else return { ok: false, kind: s.kind, error: `cannot enter ${s.kind}` };
    this.log.push({ at: Date.now(), problemId: id, templateId: k.pub.templateId, skillId: k.pub.skillId, kind: s.kind, correct: given === s.answer, intended: correct });
    k.answered = true;
    return { ok: true, kind: s.kind };
  }

  async next(settle = 200) {
    const next = this.page.locator("button.next-action").filter({ visible: true }).first();
    await next.waitFor({ timeout: 15000 });
    await this.press(next, settle);
  }
}

function cssEscape(s: string) {
  return s.replace(/["\\]/g, "\\$&");
}
/** A believable wrong answer: off by one in the last digit, or a flipped fraction. */
export function slip(answer: string) {
  if (/^-?\d+\/\d+$/.test(answer)) {
    const [n, d] = answer.replace("-", "").split("/");
    return n === d ? `${n}/${+d + 1}` : `${d}/${n}`;
  }
  if (/^-?\d+(\.\d+)?$/.test(answer)) {
    const v = answer.split("");
    const i = v.length - 1;
    v[i] = String((+v[i] + 1) % 10);
    return v.join("") === answer ? answer + "1" : v.join("");
  }
  return answer + "1";
}
