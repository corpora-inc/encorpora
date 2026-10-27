import {
  googleClickIdentifiersSchema,
  metaClickIdentifiersSchema,
  openaiClickIdentifiersSchema,
  type ClickEvidence,
} from "../../advertising/click-identifiers";
import { fundedAttribution } from "./funded-entry";
import { nativeRuntime } from "../native-runtime";

export let entryCapture: Promise<unknown> = Promise.resolve();
export function captureOpenAIEntry(): void {
  try {
    if (
      nativeRuntime ||
      location.origin !== "https://amp.corpora.inc" ||
      !["/", "/sign-up"].includes(location.pathname)
    )
      return;
    const url = new URL(location.href);
    const keys = ["oppref", "gclid", "gbraid", "wbraid", "fbclid"];
    const original = new URLSearchParams(url.search);
    const values = original.getAll("oppref");
    if (keys.some((key) => original.has(key))) {
      // Remove the opaque identifier from the address bar before navigation.
      keys.forEach((key) => url.searchParams.delete(key));
      history.replaceState(
        history.state,
        "",
        url.pathname + url.search + url.hash,
      );
    }
    const optedOut =
      navigator.doNotTrack === "1" ||
      (navigator as Navigator & { globalPrivacyControl?: boolean })
        .globalPrivacyControl;
    if (optedOut) {
      void fetch("/api/v1/advertising/acquisition", {
        method: "POST",
        credentials: "same-origin",
        keepalive: true,
        signal: AbortSignal.timeout(1500),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optOut: true }),
      }).catch(() => {});
      return;
    }
    if (navigator.webdriver) return;
    const clicks: ClickEvidence[] = [];
    const parsed =
      values.length === 1
        ? openaiClickIdentifiersSchema.safeParse({ oppref: values[0] })
        : null;
    if (parsed?.success)
      clicks.push({ provider: "openai", identifiers: parsed.data });
    const googleFields = ["gclid", "gbraid", "wbraid"];
    if (googleFields.every((key) => original.getAll(key).length <= 1)) {
      const google = googleClickIdentifiersSchema.safeParse(
        Object.fromEntries(
          googleFields
            .filter((key) => original.has(key))
            .map((key) => [key, original.get(key)]),
        ),
      );
      if (google.success)
        clicks.push({ provider: "google", identifiers: google.data });
    }
    if (original.getAll("fbclid").length === 1) {
      const meta = metaClickIdentifiersSchema.safeParse({
        fbclid: original.get("fbclid"),
      });
      if (meta.success)
        clicks.push({ provider: "meta", identifiers: meta.data });
    }
    if (!clicks.length) return;
    entryCapture = fetch("/api/v1/advertising/acquisition", {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
      signal: AbortSignal.timeout(1500),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourcePath: location.pathname,
        clicks,
        labels: fundedAttribution(Object.fromEntries(original)),
      }),
    }).catch(() => {});
  } catch {
    /* Acquisition must never interrupt the app. */
  }
}
