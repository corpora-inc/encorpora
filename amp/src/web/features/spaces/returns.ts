import { returnTarget, VIEW_KEYS } from "../../lib/return-to";
import { OPEN_KEY, readStack, writeStack } from "../../nav/entities";
import { spaceOfPath } from "./space";

/**
 * The one return contract for leaving a place and coming back
 * (docs/architecture/spaces.md, "Returns"): "Add a place" and its steps
 * today, every family redirect in P2.
 *
 * A return is a path inside the app, at most `RETURN_LIMIT` characters, to a
 * place a signed-in adult works in: a family, class, school, their own
 * practice, a learning screen or account settings. It never carries a
 * fragment (where a link's secret lives), never a link with its own
 * authority (an invitation, approval, buyer's link, progress share or a
 * student's sign-in), never a first-run or payment step, and only the
 * search keys that describe a view: the list's view keys, a valid layer
 * stack, the learner or practice profile, and the class a record was opened
 * from. Anything else is dropped; an unusable address returns nothing, and
 * the caller falls back to its own home.
 */
export const RETURN_LIMIT = 2048;

const KEPT = new Set<string>([
  ...VIEW_KEYS,
  OPEN_KEY,
  "skill",
  "learner",
  "profile",
  "class",
  "term",
  "week",
  "student",
]);
const STEPS =
  /^\/(start|continue|sign-in|sign-up|reset-password|purchase|invoice|consent|access|school\/(new|start|connect|adopt|invite))(\/|$)/;

export function appReturn(value: unknown): string | undefined {
  const target = returnTarget(value);
  if (!target) return undefined;
  const url = new URL(target, "https://amp.invalid");
  const path = url.pathname;
  const space = spaceOfPath(path);
  if (space === "public" || space === "student" || STEPS.test(path))
    return undefined;
  const kept = new URLSearchParams();
  for (const [key, raw] of url.searchParams) {
    if (!KEPT.has(key)) continue;
    if (key === OPEN_KEY) {
      const stack = writeStack(readStack(raw));
      if (stack) kept.set(key, stack);
      continue;
    }
    if (raw.length <= 200) kept.set(key, raw);
  }
  const search = kept.toString();
  const result = search ? `${path}?${search}` : path;
  return result.length <= RETURN_LIMIT ? result : path;
}
