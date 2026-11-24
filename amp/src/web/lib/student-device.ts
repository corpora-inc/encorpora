import { forgetEveryLink } from "../features/links/forget";
/** A school student's sign-in, and whose this tab is.
 *
 * One tab is one person. Session storage is a tab's own; local storage is
 * the whole browser's, every tab's at once. So:
 *
 * - A shared device's sign-in, and a parent's hand-over, live in session
 *   storage (`amp.student`): this tab's, ended with it.
 * - A personal device's sign-in also goes to local storage, so the browser
 *   still knows the child the next time it is opened. Local storage only
 *   says who a tab that is nobody yet STARTS as. The tab that signed in,
 *   and a tab that started as that child, keep their own copy in session
 *   storage (`amp.tab`) and read that from then on.
 * - A tab an adult's session loaded in, and a tab a sign-in ended in, hold
 *   no student (`amp.tab`), whatever the browser remembers.
 *
 * Another tab's sign-in therefore never changes who this tab is; only what
 * happens in this tab does (a sign-in, a sign-out, a hand-over), across a
 * reload too. In its own tab a student's sign-in still wins over a parent's
 * session until the student signs out.
 *
 * A synchronous check on purpose: analytics and engagement consult it before
 * they start. This module imports nothing that could start them. */
const studentKey = "amp.student";
/** Which student sign-in is this tab's: `{ student }` (a personal one, made
 * or found here), `{ student: null }` (none: an adult's tab, or signed out
 * here), or `{ student: null, load }` (none was remembered when this page
 * loaded; the next load looks again). */
const tabKey = "amp.tab";
/** When a shared device was last used, so a reload doesn't restart the clock. */
const activeKey = "amp.student.active";
/** A parent handed this device to their child ("Let Maya practice here"), so
 * signing out returns to the parent rather than to the class sign-in. */
const handedKey = "amp.student.handed";
/** Where a handed device goes back to, when the adult handed it over from a
 * particular screen (a demo's roster, say); `/` otherwise. */
const returnKey = "amp.student.return";
/** The name of the place a handed device returns to ("Grade 5 Math"). */
const returnNameKey = "amp.student.return-name";
export const STUDENT_IDLE_MS = 30 * 60_000;

export type StudentSession = { accountId: string; token: string };

function parsed(saved: unknown): StudentSession | null {
  if (saved === null || typeof saved !== "object") return null;
  const { accountId, token } = saved as Record<string, unknown>;
  return typeof accountId === "string" &&
    accountId.startsWith("school:") &&
    typeof token === "string" &&
    token.startsWith("st_")
    ? { accountId, token }
    : null;
}
function read(store: () => Storage): StudentSession | null {
  try {
    return parsed(JSON.parse(store().getItem(studentKey) ?? "null"));
  } catch (error) {
    console.warn("Student sign-in on this device wasn’t read", error);
    return null;
  }
}
/** This page load: a reload is another. */
const pageLoad = () => globalThis.performance?.timeOrigin ?? 0;
type TabStudent = {
  student: StudentSession | null;
  /** Decided for this page load only. */
  untilReload: boolean;
};
/** Which student sign-in is this tab's, once decided: undefined in a tab
 * that is nobody yet (a new tab, or one that found no sign-in on an earlier
 * load). */
function tabStudent(): TabStudent | undefined {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(tabKey) ?? "null");
    if (saved === null || typeof saved !== "object" || !("student" in saved))
      return undefined;
    const { student, load } = saved as Record<string, unknown>;
    if (load !== undefined)
      return load === pageLoad()
        ? { student: null, untilReload: true }
        : undefined;
    return { student: parsed(student), untilReload: false };
  } catch (error) {
    console.warn("Whose tab this is wasn’t read", error);
    return undefined;
  }
}
function keepTabStudent(student: StudentSession | null, untilReload = false) {
  try {
    sessionStorage.setItem(
      tabKey,
      JSON.stringify(untilReload ? { student, load: pageLoad() } : { student }),
    );
  } catch (error) {
    console.warn("Whose tab this is wasn’t kept", error);
  }
}
/** This tab's student sign-in. A tab that is nobody yet takes the one this
 * browser remembers, once, as the page loads: after that, another tab's
 * sign-in changes nothing here. */
export function studentSession(): StudentSession | null {
  const shared = read(() => sessionStorage);
  if (shared) return shared;
  const mine = tabStudent();
  if (mine) return mine.student;
  const remembered = read(() => localStorage);
  keepTabStudent(remembered, !remembered);
  return remembered;
}
/** The session this tab resolved to (the session check, or a sign-in made
 * here). An adult's makes the tab theirs: it never becomes the child this
 * browser remembers, now or after a reload. A student's sign-in held here
 * still wins, as it does in the check itself (auth.ts `accessSession`). */
export function settleTab(session: { accountId: string } | null) {
  if (!session || session.accountId.startsWith("school:")) return;
  if (read(() => sessionStorage) || tabStudent()?.student) return;
  keepTabStudent(null);
}
/** Signed in as a student, or on the screens a student signs in from, whose
 * URLs can carry a card's secret and which a parent has no reason to open. A
 * family's progress link (`/p`) is held to the same silence: it can carry a
 * secret too, and nothing on it is measured. */
export function isStudentDevice(): boolean {
  return (
    !!studentSession() ||
    /^\/(join|c|p)(\/|$)/.test(globalThis.location?.pathname ?? "")
  );
}
export function rememberStudentSession(
  session: StudentSession,
  mode: "shared" | "personal",
  handed = false,
  returnTo?: string,
  returnName?: string,
) {
  clearStudentDevice();
  if (mode === "shared") {
    sessionStorage.setItem(studentKey, JSON.stringify(session));
    sessionStorage.setItem(activeKey, String(Date.now()));
  } else {
    // The browser remembers it for its next tab; this tab keeps its own.
    localStorage.setItem(studentKey, JSON.stringify(session));
    keepTabStudent(session);
  }
  if (handed) sessionStorage.setItem(handedKey, "1");
  if (handed && returnTo) sessionStorage.setItem(returnKey, returnTo);
  if (handed && returnName) sessionStorage.setItem(returnNameKey, returnName);
}
/** The name of the place a handed device goes back to, when it was named
 * at the handoff (a class); a family's is "family". */
export function handedReturnName(): string | null {
  try {
    return sessionStorage.getItem(returnNameKey);
  } catch (error) {
    console.warn("The place this device returns to couldn’t be read", error);
    return null;
  }
}
/** This student's sign-in was handed over by a parent on their own device. */
export function handedStudentDevice(): boolean {
  try {
    return sessionStorage.getItem(handedKey) === "1";
  } catch (error) {
    console.warn("Whether this device was handed over wasn’t read", error);
    return false;
  }
}
/** The screen a handed device returns to: a path on this site, or `/`. */
export function handedReturnPath(): string {
  try {
    const path = sessionStorage.getItem(returnKey) ?? "/";
    return /^\/(?!\/)[^\s\\]*$/.test(path) ? path : "/";
  } catch (error) {
    console.warn("The place this device returns to couldn’t be read", error);
    return "/";
  }
}
/** Where a handed device's home control goes: the family's Today when it
 * was handed over from one of the family's screens (`/family/<id>/…`), the
 * screen it was handed from otherwise (a class's roster), else `/`. */
export function handedHome(): string {
  const path = handedReturnPath();
  const family = /^\/family\/([^/?#]+)/.exec(path);
  return family ? `/family/${family[1]}` : path;
}
/** Ends the student sign-in this tab holds; the tab holds none until one is
 * made in it. The browser forgets the sign-in it remembers when that is this
 * tab's, or when this tab is nobody yet (a new tab stands for the browser).
 * A child signed in on another tab stays remembered: a parent's hand-over
 * here, or a sibling signing out here, never signs them out. */
export function clearStudentDevice() {
  // A parent's or teacher's held link never stays beside a child's session.
  forgetEveryLink();
  const shared = read(() => sessionStorage);
  const mine = tabStudent();
  const remembered = read(() => localStorage);
  const forget =
    !mine ||
    mine.untilReload ||
    !remembered ||
    [shared, mine.student].some((held) => held?.token === remembered.token);
  for (const [store, keys] of [
    [
      () => sessionStorage,
      [studentKey, activeKey, handedKey, returnKey, returnNameKey],
    ],
    [() => localStorage, forget ? [studentKey] : []],
  ] as const)
    try {
      for (const key of keys) store().removeItem(key);
    } catch (error) {
      console.warn("Student sign-in not cleared", error);
    }
  keepTabStudent(null);
}
/** Parent-only routes also answer a student 401, so only `/me` can say that the
 * sign-in itself has ended. */
export async function studentSignInEnded(session: StudentSession) {
  const response = await fetch("/api/v1/me", {
    headers: { Authorization: `Bearer ${session.token}` },
    signal: AbortSignal.timeout(10000),
  });
  return response.status === 401;
}
/** A shared device signs out when it's left alone. Timers sleep with the tab,
 * so waking up checks too. A personal device, or no student, does nothing. */
export function watchStudentIdle(signOut: () => void) {
  const shared = () => !!read(() => sessionStorage);
  const check = () => {
    if (!shared()) return;
    const active = sessionStorage.getItem(activeKey);
    if (active === null) sessionStorage.setItem(activeKey, String(Date.now()));
    else if (Date.now() - Number(active) >= STUDENT_IDLE_MS) signOut();
  };
  let last = 0;
  const used = () => {
    if (!shared() || Date.now() - last < 5000) return;
    check();
    last = Date.now();
    if (shared()) sessionStorage.setItem(activeKey, String(last));
  };
  const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
  for (const event of events)
    window.addEventListener(event, used, { capture: true, passive: true });
  document.addEventListener("visibilitychange", check);
  window.addEventListener("pageshow", check);
  const timer = setInterval(check, 15_000);
  check();
  return () => {
    for (const event of events)
      window.removeEventListener(event, used, { capture: true });
    document.removeEventListener("visibilitychange", check);
    window.removeEventListener("pageshow", check);
    clearInterval(timer);
  };
}
