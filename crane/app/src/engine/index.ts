import type { Engine } from "./types.ts";
import { openFixture, type RawPack } from "./fixture.ts";

let current: Engine | null = null;

/**
 * Open the pack. Today: the fixture pack, loaded as its own chunk. When
 * harvest-core ships, a Tauri build opens the signed SQLite pack through it.
 */
export async function openEngine(): Promise<Engine> {
  if (current) return current;
  const raw = (await import("./fixture/pack.json")).default as unknown as RawPack;
  current = openFixture(raw);
  return current;
}

export function engine(): Engine {
  if (!current) throw new Error("Engine used before openEngine resolved");
  return current;
}
