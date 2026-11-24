import { useEffect, useRef, useState } from "react";
import { useCurrentLearner } from "../../learner-store";
import { queryClient } from "../../lib/query-client";
import { useSessionOrNull } from "../../lib/session";
import { useAddressedIdentity } from "../spaces/useAddressed";
import {
  practiceSettingsOptions,
  type PracticeScope,
} from "./practice-settings";

/**
 * A learner's menu paints what is known of their look, and what is known is
 * read before the menu paints.
 *
 * The menu has their Look and Color rows, or (an adult has "Allow Colorful"
 * off) neither. That can have changed a moment ago on another device, and a
 * menu drawn from what this screen last read would paint two rows and take
 * them away a frame later, with everything under them jumping up. So opening
 * the menu reads the learner's practice settings first and the sheet comes
 * in when they are in hand:
 *
 * - the read starts at the press on the menu's button, ahead of its click,
 *   so on most taps it is back by the time the menu would open anyway;
 * - the sheet waits for it at most `HOLD_MS`; on a network slower than that
 *   it opens from what was last read, and the rows it opens with stay for
 *   that opening (LookSetting.tsx), so nothing moves either way.
 *
 * It is the request the menu's rows already made as they mounted, made
 * before them instead of after. A menu with no learner's look in it (a
 * parent's, a teacher's) waits for nothing.
 */
const HOLD_MS = 400;
/** A press and its click are this close at most; a read begun at the press
 * is the opening's own. */
const PRESS_MS = 1_000;
const TRIGGER = "[data-navigation-trigger]";

const keyOf = (scope: PracticeScope) => `${scope.identity}:${scope.learnerId}`;

/** Reads a learner's practice settings now. Settles when they are in the
 * cache every screen reads them from, or when the read failed (logged; what
 * was known stands). */
const read = (scope: PracticeScope): Promise<void> =>
  queryClient
    .fetchQuery({ ...practiceSettingsOptions(scope), staleTime: 0 })
    .then(
      () => undefined,
      (error: unknown) =>
        console.warn("The look wasn’t read before the menu opened", error),
    );

/** The read a press on the menu's button began, for the opening it leads
 * to: used once, so every opening has a read of its own. */
let pressed: { key: string; at: number; done: Promise<void> } | null = null;
function lookAhead(scope: PracticeScope) {
  pressed = { key: keyOf(scope), at: performance.now(), done: read(scope) };
}
/** The read for an opening: its press's, else one begun now. */
export function lookNow(scope: PracticeScope): Promise<void> {
  const ahead = pressed;
  pressed = null;
  return ahead &&
    ahead.key === keyOf(scope) &&
    performance.now() - ahead.at < PRESS_MS
    ? ahead.done
    : read(scope);
}

/** Whose look a learner's own menu sets: the learner the screen names, else
 * the one it addresses, else the one chosen on this device. Null where the
 * menu is not a learner's own. */
export function useMenuLook(
  learning: boolean,
  named: string | null,
): PracticeScope | null {
  const session = useSessionOrNull();
  const addressed = useAddressedIdentity();
  const current = useCurrentLearner();
  const learnerId = named ?? addressed?.id ?? current;
  if (!learning || !session || !learnerId) return null;
  return { identity: session.accountId, learnerId, token: session.token };
}

/**
 * Whether a menu that was asked to open may paint: at once where it has no
 * learner's look (`scope` null), else once their look has been read for
 * this opening, or `HOLD_MS` has passed.
 */
export function useLookKnown(open: boolean, scope: PracticeScope | null) {
  const key = scope ? keyOf(scope) : "";
  const now = useRef(scope);
  now.current = scope;
  const [known, setKnown] = useState(false);
  // A press on the menu's button reads ahead of its click.
  useEffect(() => {
    if (!key) return;
    const ahead = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(TRIGGER) && now.current) lookAhead(now.current);
    };
    document.addEventListener("pointerdown", ahead, true);
    return () => document.removeEventListener("pointerdown", ahead, true);
  }, [key]);
  useEffect(() => {
    if (!open || !key || !now.current) return;
    let live = true;
    const settle = () => {
      if (live) setKnown(true);
    };
    const bound = window.setTimeout(settle, HOLD_MS);
    // A task later: the screens that show the look hear of the answer
    // first (the cache tells them in a task of its own), so the page
    // behind the menu is already right in the menu's first frame.
    let after = 0;
    void lookNow(now.current).then(() => {
      after = window.setTimeout(settle, 0);
    });
    return () => {
      live = false;
      window.clearTimeout(bound);
      window.clearTimeout(after);
      setKnown(false);
    };
  }, [open, key]);
  return open && (!key || known);
}
