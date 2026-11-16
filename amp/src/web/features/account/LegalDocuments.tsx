import { useState } from "react";
import { Button } from "../../ui/Button";
import styles from "./BillingPage.module.css";

export const legalDocuments = [
  { id: "terms", name: "Terms of use" },
  { id: "privacy", name: "Privacy policy" },
  { id: "refund", name: "Refund policy" },
] as const;
/** Save the published document itself, so there is no second policy to maintain.
 * An HTML copy keeps headings, links and Unicode and can be printed to PDF. */
export async function downloadLegal(id: (typeof legalDocuments)[number]["id"]) {
  const source = `https://corpora.inc/legal/${id}/`;
  const response = await fetch(source, {
    credentials: "omit",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error("The document couldn’t be downloaded. Try again.");
  const doc = new DOMParser().parseFromString(
    await response.text(),
    "text/html",
  );
  const content = doc.querySelector(".legal");
  if (!content)
    throw new Error(
      "The document couldn’t be downloaded. Open it using the link instead.",
    );
  // Preserve text and document structure without copying scripts or site chrome.
  const blocks = [...content.querySelectorAll("h2,h3,p,li")]
    .map((el) => {
      const node = document.createElement(el.tagName.toLowerCase());
      node.textContent = el.textContent;
      return node.outerHTML;
    })
    .join("\n");
  const title = legalDocuments.find((d) => d.id === id)!.name;
  const date = new Date().toISOString().slice(0, 10);
  const blob = new Blob(
    [
      `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AMP · ${title}</title><style>body{max-width:760px;padding:32px;margin:auto;font:16px/1.6 system-ui}h1,h2,h3{line-height:1.25}footer{margin-top:32px;border-top:1px solid #bbb;padding-top:16px}</style><h1>${title}</h1>${blocks}<footer>Published by Corpora Inc. Copy downloaded ${date}.<br><a href="${source}">Current document</a></footer></html>`,
    ],
    { type: "text/html;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `AMP-${id}-${date}.html`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export function LegalDocuments() {
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState("");
  return (
    <section className={styles.section} aria-labelledby="legal-documents-title">
      <h2 id="legal-documents-title">Policies & documents</h2>
      <ul className={styles.plans}>
        {legalDocuments.map((doc) => (
          <li key={doc.id} className={styles.planRow}>
            <a
              href={`https://corpora.inc/legal/${doc.id}/`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {doc.name}
            </a>
            <Button
              variant="quiet"
              disabled={!!busy}
              aria-busy={busy === doc.id || undefined}
              aria-label={`Download ${doc.name.toLowerCase()}`}
              onClick={async () => {
                setBusy(doc.id);
                setError("");
                try {
                  await downloadLegal(doc.id);
                } catch (cause) {
                  setError(
                    cause instanceof Error ? cause.message : "Download failed.",
                  );
                } finally {
                  setBusy(undefined);
                }
              }}
            >
              Download
            </Button>
          </li>
        ))}
      </ul>
      <p className={styles.muted}>Save a readable copy, or print it to PDF.</p>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
