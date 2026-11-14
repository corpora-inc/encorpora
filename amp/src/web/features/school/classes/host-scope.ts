/**
 * Which of a class's people a host shows, and what it may do to the whole
 * class (features/school/classes/host.tsx). Pure, so the scope rules are
 * tested on their own (tests/class-host-scope.test.ts).
 */
export type HostScope = {
  /** Which of the class's people this host shows (by roster person). */
  keep?: (person: string) => boolean;
  /** The class also holds people this host doesn't show (a family's class
   * with other families' children in it). Whatever acts on the whole class
   * (an export, closing a term, the curve) belongs to the class's own
   * screens then, never to this host's. */
  shared?: boolean;
};

/** A person a host may open, or undefined: someone it doesn't show never opens
 * here, whatever the address says. */
export function keptPerson(
  host: HostScope,
  person: string | null | undefined,
): string | undefined {
  if (!person) return undefined;
  return !host.keep || host.keep(person) ? person : undefined;
}

/** Whether this host offers what acts on the whole class: only where every
 * person the class holds is one it shows. */
export const offersWholeClass = (host: HostScope) => !host.shared;

/** Whether a whole-class action (an export, closing a term, the curve) is
 * offered on a page that shows `shown` of the class's `total` people: only
 * when the host offers it and the page shows everyone, so what the action
 * says it changes is what the server changes. */
export const wholeClass = (host: HostScope, shown: number, total: number) =>
  offersWholeClass(host) && shown === total;
