import { openaiClickIdentifiersSchema } from "../../advertising/click-identifiers";
import { nativeRuntime } from "../native-runtime";

export function captureOpenAIEntry(): void {
  try {
    if (
      nativeRuntime ||
      location.origin !== "https://amp.corpora.inc" ||
      location.pathname !== "/"
    )
      return;
    const url = new URL(location.href);
    const values = url.searchParams.getAll("oppref");
    if (!values.length) return;
    // Remove the opaque identifier from the address bar before navigation.
    url.searchParams.delete("oppref");
    history.replaceState(
      history.state,
      "",
      url.pathname + url.search + url.hash,
    );
    const optedOut =
      navigator.doNotTrack === "1" ||
      (navigator as Navigator & { globalPrivacyControl?: boolean })
        .globalPrivacyControl;
    if (optedOut || navigator.webdriver || values.length !== 1) return;
    const parsed = openaiClickIdentifiersSchema.safeParse({
      oppref: values[0],
    });
    if (!parsed.success) return;
    void fetch("/api/v1/advertising/acquisition", {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourcePath: "/",
        clicks: [{ provider: "openai", identifiers: parsed.data }],
      }),
    }).catch(() => {});
  } catch {
    /* Acquisition must never interrupt the app. */
  }
}
