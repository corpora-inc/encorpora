import styles from "./ProviderButtons.module.css";
import { fill, type SocialCopy } from "./social-copy";

export type Provider = "google" | "apple" | "microsoft" | "github";
export const providerNames: Record<Provider, string> = {
  google: "Google",
  apple: "Apple",
  microsoft: "Microsoft",
  github: "GitHub",
};
export const isProvider = (value: unknown): value is Provider =>
  typeof value === "string" && value in providerNames;

/** Official marks, unmodified: Google's four-color G, the Apple logo,
 * Microsoft's four squares and GitHub's Invertocat. The multicolor marks use
 * brand tokens; Apple's and GitHub's take the button's label color. */
function Mark({ provider }: { provider: Provider }) {
  if (provider === "google")
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <path
          fill="var(--color-brand-google-red)"
          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        />
        <path
          fill="var(--color-brand-google-blue)"
          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        />
        <path
          fill="var(--color-brand-google-yellow)"
          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        />
        <path
          fill="var(--color-brand-google-green)"
          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        />
      </svg>
    );
  if (provider === "apple")
    return (
      <svg viewBox="0 0 814 1000" aria-hidden="true" focusable="false">
        <path
          fill="currentColor"
          d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"
        />
      </svg>
    );
  if (provider === "microsoft")
    return (
      <svg viewBox="0 0 21 21" aria-hidden="true" focusable="false">
        <rect
          x="1"
          y="1"
          width="9"
          height="9"
          fill="var(--color-brand-microsoft-red)"
        />
        <rect
          x="11"
          y="1"
          width="9"
          height="9"
          fill="var(--color-brand-microsoft-green)"
        />
        <rect
          x="1"
          y="11"
          width="9"
          height="9"
          fill="var(--color-brand-microsoft-blue)"
        />
        <rect
          x="11"
          y="11"
          width="9"
          height="9"
          fill="var(--color-brand-microsoft-yellow)"
        />
      </svg>
    );
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
  );
}

/** One equal-width stack of provider buttons. Only providers this deployment
 * has configured are passed in, so no button here is guaranteed to fail. */
export function ProviderButtons({
  providers,
  copy,
  busy,
  pending,
  onSelect,
}: {
  providers: Provider[];
  copy: SocialCopy;
  busy: boolean;
  /** The provider whose redirect is starting. */
  pending: Provider | null;
  onSelect: (provider: Provider) => void;
}) {
  if (!providers.length) return null;
  return (
    <div className={styles.stack}>
      {providers.map((provider) => (
        <button
          key={provider}
          type="button"
          className={
            provider === "apple"
              ? `${styles.button} ${styles.apple}`
              : styles.button
          }
          disabled={busy}
          aria-busy={pending === provider || undefined}
          data-provider={provider}
          onClick={() => onSelect(provider)}
        >
          <span className={styles.mark}>
            <Mark provider={provider} />
          </span>
          <span className={styles.label}>
            {fill(copy.continueWith, providerNames[provider])}
          </span>
        </button>
      ))}
    </div>
  );
}

/** Separates the provider stack from the email form. */
export function EmailDivider({ copy }: { copy: SocialCopy }) {
  return (
    <p className={styles.divider}>
      <span>{copy.orEmail}</span>
    </p>
  );
}
