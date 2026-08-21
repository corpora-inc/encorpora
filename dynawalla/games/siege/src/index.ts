/**
 * SIEGE — a molten-forge tower defence.
 *
 * You never buy a tower with gold you were given. You buy it with arithmetic:
 * the anvil at the bottom of the screen mints embers for every problem you
 * strike, and embers are the only thing that holds the line. Upgrades cost a
 * harder problem. When the wave is about to break through, the overcharge asks
 * one big question and answers it with a shockwave.
 */
import "./ui/styles.css";
import type { Host } from "./contract.ts";
import { Siege } from "./mount.ts";

export type { Host, Question } from "./contract.ts";
export { createStubHost } from "./stubHost.ts";

export function mount(el: HTMLElement, host: Host): { unmount(): void } {
  const game = new Siege(el, host);
  return { unmount: () => game.destroy() };
}
