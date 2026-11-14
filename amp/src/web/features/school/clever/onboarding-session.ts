import {
  clearStudentDevice,
  studentSession,
} from "../../../lib/student-device";

export type CleverOnboardingSession = {
  token: string;
  accountId: string;
  expiresAt: string;
};
const key = "amp.clever.onboarding";
const tokenPattern = /^po_[\w-]{43}$/;
let memoryToken: string | null = null;
let completing = false;
let replacingStudentToken: string | null = null;
let pending: Promise<CleverOnboardingSession | null> | null = null;

export function clearCleverOnboardingSession() {
  memoryToken = null;
  completing = false;
  replacingStudentToken = null;
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* Storage is optional. */
  }
}

/** A setup-only credential never becomes an AuthSession or an account cookie.
 * Each read checks server expiry/revocation; a browser reload can resume setup. */
export function cleverOnboardingSession(): Promise<CleverOnboardingSession | null> {
  if (pending) return pending;
  pending = load().finally(() => {
    pending = null;
  });
  return pending;
}
async function load(): Promise<CleverOnboardingSession | null> {
  const params = new URLSearchParams(location.hash.slice(1));
  const completion = params.get("clever-onboarding");
  if (completion !== null) {
    params.delete("clever-onboarding");
    history.replaceState(
      history.state,
      "",
      location.pathname + location.search + (params.size ? `#${params}` : ""),
    );
    clearCleverOnboardingSession();
    if (!tokenPattern.test(completion)) return null;
    memoryToken = completion;
    completing = true;
    replacingStudentToken = studentSession()?.token ?? null;
  }
  let token = memoryToken;
  if (!token) {
    try {
      token = sessionStorage.getItem(key);
    } catch {
      /* Storage is optional. */
    }
  }
  if (!token || !tokenPattern.test(token)) return null;
  const response = await fetch("/api/v1/provider/onboarding-session", {
    headers: { Authorization: `Bearer ${token}` },
    credentials: "omit",
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (response.status === 401 || response.status === 403) {
    clearCleverOnboardingSession();
    return null;
  }
  if (!response.ok)
    throw new Error(
      "Clever setup sign-in could not be checked. Please try again.",
    );
  const proof = (await response.json()) as CleverOnboardingSession;
  if (
    proof.token !== token ||
    !proof.accountId?.startsWith("amp|") ||
    !Number.isFinite(Date.parse(proof.expiresAt)) ||
    Date.parse(proof.expiresAt) <= Date.now()
  ) {
    clearCleverOnboardingSession();
    return null;
  }
  if (
    completing &&
    (studentSession()?.token ?? null) !== replacingStudentToken
  ) {
    // A later student sign-in supersedes this handoff, including when the
    // earlier proof needed a network retry. Never clear the newer student.
    clearCleverOnboardingSession();
    return null;
  }
  memoryToken = token;
  try {
    sessionStorage.setItem(key, token);
  } catch {
    /* Memory holds this tab's proof. */
  }
  if (completing) {
    completing = false;
    replacingStudentToken = null;
    clearStudentDevice();
    window.dispatchEvent(new Event("amp-account-session-changed"));
  }
  return proof;
}
