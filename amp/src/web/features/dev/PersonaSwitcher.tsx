/**
 * `/dev/personas`, development only: sign in as any person of the local design
 * preview in one click (`persona-list.ts`, seeded by
 * `scripts/design-personas.ts`). It signs out, signs in through the ordinary
 * email sign-in, forgets this device's remembered learner and place, and loads
 * the app fresh, so nothing of the last person carries over.
 */
import { useState } from "react";
import {
  PERSONA_PASSPHRASE,
  PREVIEW_PERSONAS,
  personaEmail,
  type PersonaGroup,
  type PreviewPersona,
} from "./persona-list";
import styles from "./PersonaSwitcher.module.css";

const groups: PersonaGroup[] = ["Adults", "Families", "Teaching"];

async function signInAs(persona: PreviewPersona) {
  // Development-only identity replacement: sign out and sign in before a full
  // reload. It must also recover a preview whose /me renewal cannot finish.
  const post = (path: string, body: unknown) =>
    fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  await post("/api/auth/sign-out", {}).catch(() => undefined);
  const response = await post("/api/auth/sign-in/email", {
    email: personaEmail(persona.slug),
    password: PERSONA_PASSPHRASE,
  });
  if (!response.ok)
    throw new Error(
      `${persona.name} could not sign in (${response.status}). Seed the preview: scripts/design-preview.sh reseed`,
    );
  localStorage.clear();
  sessionStorage.clear();
  location.assign(persona.home);
}

export function PersonaSwitcher() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Design preview</h1>
        <p>Sign in as anyone below. Everyone is made up; this page exists only in development.</p>
      </header>
      <div className={styles.error} role="alert">
        {error}
      </div>
      {groups.map((group) => (
        <section key={group} className={styles.group}>
          <h2>{group}</h2>
          <ul>
            {PREVIEW_PERSONAS.filter((p) => p.group === group).map((p) => (
              <li key={p.slug}>
                <button
                  type="button"
                  className={styles.person}
                  aria-busy={busy === p.slug || undefined}
                  disabled={!!busy}
                  onClick={() => {
                    setBusy(p.slug);
                    setError(null);
                    signInAs(p).catch((failure: Error) => {
                      console.error(failure);
                      setError(failure.message);
                      setBusy(null);
                    });
                  }}
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
