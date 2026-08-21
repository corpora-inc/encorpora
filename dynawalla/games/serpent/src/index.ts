/**
 * Serpent — the package entry point.
 *
 * `mount(el, host)` is the whole public surface. Everything else is internal
 * and will keep moving.
 */

import type { Host, Mounted } from "./contract.ts";
import { mountSerpent } from "./game/mount.ts";

export function mount(el: HTMLElement, host: Host): Mounted {
  return mountSerpent(el, host);
}

export type { Host, Question, Report, Mounted } from "./contract.ts";
export { createStubHost } from "./stub/host.ts";
