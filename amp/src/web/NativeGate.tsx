import { invoke } from "@tauri-apps/api/core";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import "./native-session.css";
import { NativePreview } from "./NativePreview";
export function NativeGate({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const generation = useRef(0);
  useLayoutEffect(() => {
    const current = ++generation.current;
    void invoke<{ authentication: boolean }>("native_status").then(
      (value) => {
        if (generation.current === current) setEnabled(value.authentication);
      },
      () => {
        if (generation.current === current) setEnabled(false);
      },
    );
    return () => {
      generation.current++;
    };
  }, []);
  if (enabled === null)
    return (
      <main className="native-preview">
        <section className="card welcome" aria-busy="true">
          <h1>Opening AMP…</h1>
        </section>
      </main>
    );
  return enabled ? children : <NativePreview />;
}
export function NativeFamily({
  onClose,
  onSignOut,
}: {
  onClose: () => void;
  onSignOut: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  return (
    <section
      className="card native-family"
      aria-labelledby="native-family-title"
    >
      <div>
        <p className="eyebrow">PARENT ACCOUNT</p>
        <h2 id="native-family-title" ref={heading} tabIndex={-1}>
          Family settings
        </h2>
      </div>
      <p>
        Manage learner profiles, consent, subscriptions, PDF downloads and data
        exports in the configured web application.
      </p>
      <div className="native-family-actions">
        <button onClick={onClose}>Back to learning</button>
        <button className="secondary" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </section>
  );
}
