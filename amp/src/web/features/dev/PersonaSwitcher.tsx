/**
 * `/dev/personas`, development only: sign in as any person of the local design
 * preview in one click (`persona-list.ts`, seeded by
 * `scripts/design-personas.ts`). It signs out, signs in through the ordinary
 * email sign-in, forgets this device's remembered learner and place, and loads
 * the app fresh, so nothing of the last person carries over.
 *
 * "New user", at the top, is a brand-new account on every click, made by the
 * real sign-up, so first-run testing never needs a reseed.
 */
import { useState } from "react";
import { accountClient } from "../../account-client";
import {
  NEW_USER_CONFIRM_PATH,
  PERSONA_PASSPHRASE,
  PREVIEW_PERSONAS,
  newUserEmail,
  personaEmail,
  type PersonaGroup,
  type PreviewPersona,
} from "./persona-list";
import styles from "./PersonaSwitcher.module.css";

const groups: PersonaGroup[] = ["Adults", "Families", "Teaching"];
const NEW_USER = "new-user";

// Development-only identity replacement: sign out and sign in before a full
// reload. It must also recover a preview whose /me renewal cannot finish.
const post = (path: string, body: unknown) =>
  fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

function openFresh(home: string) {
  localStorage.clear();
  sessionStorage.clear();
  location.assign(home);
}

/** A brand-new account, in exactly a real person's state after signing up:
 * the sign-up screen's own call (`SignInScreen.tsx`: no name, return to "/"),
 * then the address confirmed as the emailed link confirms it (the dev
 * server's NEW_USER_CONFIRM_PATH), then home, where the app asks "What brings
 * you to AMP?". */
async function signUpNewUser() {
  await post("/api/auth/sign-out", {}).catch(() => undefined);
  const email = newUserEmail();
  const created = await accountClient.signUp.email({
    name: "",
    email,
    password: PERSONA_PASSPHRASE,
    callbackURL: "/",
  });
  if (created.error)
    throw new Error(
      `Sign-up failed (${created.error.status}): ${created.error.message ?? created.error.statusText} [${email}]`,
    );
  const confirmed = await post(NEW_USER_CONFIRM_PATH, { email });
  if (!confirmed.ok) {
    const { error } = (await confirmed.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(
      `New account not confirmed (${confirmed.status}): ${error ?? "the dev server did not answer"} [${email}]`,
    );
  }
  // Where confirmation comes first (production settings), sign-up issues no
  // session; the confirmed address now signs in, as the link would.
  if (!created.data?.token) {
    const signedIn = await accountClient.signIn.email({
      email,
      password: PERSONA_PASSPHRASE,
      callbackURL: "/",
    });
    if (signedIn.error)
      throw new Error(
        `New account could not sign in (${signedIn.error.status}): ${signedIn.error.message ?? signedIn.error.statusText} [${email}]`,
      );
  }
  openFresh("/");
}

async function signInAs(persona: PreviewPersona) {
  await post("/api/auth/sign-out", {}).catch(() => undefined);
  const response = await post("/api/auth/sign-in/email", {
    email: personaEmail(persona.slug),
    password: PERSONA_PASSPHRASE,
  });
  if (!response.ok)
    throw new Error(
      `${persona.name} could not sign in (${response.status}). Seed the preview: scripts/design-preview.sh reseed`,
    );
  openFresh(persona.home);
}

export function PersonaSwitcher() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const start = (key: string, work: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    work().catch((failure: Error) => {
      console.error(failure);
      setError(failure.message);
      setBusy(null);
    });
  };
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Design preview</h1>
        <p>
          Sign in as anyone below. Everyone is made up; this page exists only in
          development.
        </p>
      </header>
      <button
        type="button"
        className={styles.newUser}
        aria-busy={busy === NEW_USER || undefined}
        disabled={!!busy}
        onClick={() => start(NEW_USER, signUpNewUser)}
      >
        <span className={styles.label}>New user</span>
        <span className={styles.stage}>
          A brand-new account, just signed up: “What brings you to AMP?”
        </span>
      </button>
      <div className={styles.error} role="alert" title={error ?? undefined}>
        {error}
      </div>
      {groups.map((group) => (
        <section key={group} className={styles.group}>
          <h2>{group}</h2>
          <ul>
            {PREVIEW_PERSONAS.filter(
              (p) => p.group === group && p.switcher !== false,
            ).map((p) => (
              <li key={p.slug}>
                <button
                  type="button"
                  className={styles.person}
                  aria-busy={busy === p.slug || undefined}
                  disabled={!!busy}
                  onClick={() => start(p.slug, () => signInAs(p))}
                >
                  <span className={styles.label}>{p.label}</span>
                  <span className={styles.stage}>{p.stage}</span>
                  <span className={styles.who}>
                    {p.name} · {personaEmail(p.slug)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <footer className={styles.footer}>
        <a href="/">Signed out: the pitch</a>
        <a href="/schools">The school page</a>
      </footer>
    </main>
  );
}
