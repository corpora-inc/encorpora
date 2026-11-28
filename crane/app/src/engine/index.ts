import type { Engine } from "./types.ts";
import { openFixture } from "./fixture.ts";
import { fromShow, type ShowPack } from "./show.ts";

let current: Engine | null = null;

/** Where the app reads the pack: the browser copy build-pack.sh writes, served with the app. */
export const PACK_URL = `${import.meta.env.BASE_URL}pack/crane-us.browser.json`;

/**
 * Open the real pack: the harvest-show/1 copy of the signed pack, built in
 * CI and by scripts/build-browser-pack.sh (never committed). There is no
 * fallback: without the pack the app says so. The fixture is for tests only.
 */
export async function openEngine(): Promise<Engine> {
  if (current) return current;
  const res = await fetch(PACK_URL);
  const hint = "Build it with crane/app/scripts/build-browser-pack.sh";
  if (!res.ok) throw new Error(`pack ${PACK_URL}: HTTP ${res.status}. ${hint}`);
  // A dev server answers a missing file with index.html: say what is missing, not "Unexpected token <".
  const show = (await res.json().catch(() => {
    throw new Error(`pack ${PACK_URL} is not JSON (missing?). ${hint}`);
  })) as ShowPack;
  current = openFixture(fromShow(show));
  return current;
}

export function engine(): Engine {
  if (!current) throw new Error("Engine used before openEngine resolved");
  return current;
}
