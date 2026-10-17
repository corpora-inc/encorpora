import { invoke } from "@tauri-apps/api/core";
import { useLayoutEffect, useRef, useState } from "react";

interface NativeStatus {
  apiConfiguration: "configured" | "unconfigured" | "invalid";
  authentication: false;
  purchases: false;
  downloads: false;
  exports: false;
}

export function NativePreview() {
  const [status, setStatus] = useState<NativeStatus | null>(null);
  const [connection, setConnection] = useState<
    "idle" | "checking" | "ok" | "error"
  >("idle");
  const [unavailable, setUnavailable] = useState(false);
  const generation = useRef(0);
  useLayoutEffect(() => {
    const current = ++generation.current;
    void invoke<NativeStatus>("native_status").then(
      (value) => {
        if (generation.current === current) setStatus(value);
      },
      () => {
        if (generation.current === current) setUnavailable(true);
      },
    );
    return () => {
      generation.current++;
    };
  }, []);
  async function check() {
    const current = generation.current;
    setConnection("checking");
    try {
      await invoke("read_public_resource", { resource: "health" });
      if (current === generation.current) setConnection("ok");
    } catch {
      if (current === generation.current) setConnection("error");
    }
  }
  return (
    <main className="native-preview">
      <section className="card welcome" aria-labelledby="native-title">
        <p className="eyebrow">AMP · MATHEMATICS</p>
        <h1 id="native-title">Native preview</h1>
        <p>Family sign-in and learning require a configured web application.</p>
        <p>
          Purchases, book downloads and family data exports are unavailable
          here.
        </p>
        <div role="status" aria-live="polite">
          {unavailable
            ? "This preview could not start. Close and reopen it to try again."
            : !status
              ? "Opening preview…"
              : status.apiConfiguration === "configured"
                ? connection === "checking"
                  ? "Checking connection…"
                  : connection === "ok"
                    ? "Service reachable. Native sign-in is unavailable."
                    : connection === "error"
                      ? "The service could not be reached. You can try again."
                      : "You can check the service connection."
                : "A learning service has not been configured for this preview."}
        </div>
        {status?.apiConfiguration === "configured" && (
          <button
            onClick={() => void check()}
            disabled={connection === "checking"}
          >
            Check connection
          </button>
        )}
      </section>
    </main>
  );
}
