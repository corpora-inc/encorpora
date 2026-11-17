/**
 * Re-render a recorded session in another format without touching
 * production: every /api/ call is answered from a take's api.json (same
 * method and path, in recorded order; the last answer repeats when a layout
 * asks more often). A call the recording never made fails closed (503) and
 * is logged: nothing from a replay ever reaches production's API.
 */
import { readFile } from "node:fs/promises";
import type { Page } from "playwright";

type Entry = { method: string; path: string; status: number; res?: string };
export async function installReplay(page: Page, apiJson: string, log: string[]) {
  const entries: Entry[] = JSON.parse(await readFile(apiJson, "utf8"));
  const queues = new Map<string, Entry[]>();
  for (const e of entries) {
    const k = `${e.method} ${e.path}`;
    if (!queues.has(k)) queues.set(k, []);
    queues.get(k)!.push(e);
  }
  const used = new Map<string, number>();
  await page.route(/https:\/\/amp\.corpora\.inc\/api\//, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const k = `${req.method()} ${u.pathname}${u.search}`;
    const q = queues.get(k);
    if (q?.length) {
      const i = used.get(k) ?? 0;
      used.set(k, i + 1);
      const e = q[Math.min(i, q.length - 1)];
      return route.fulfill({ status: e.status, contentType: "application/json", body: e.res ?? "" });
    }
    // Analytics beacons are swallowed locally (never sent), without noise.
    if (req.method() === "POST" && u.pathname === "/api/v1/events")
      return route.fulfill({ status: 204, body: "" });
    log.push(`replay miss (refused): ${k}`);
    return route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"replay"}' });
  });
}
