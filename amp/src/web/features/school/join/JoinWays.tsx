import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { formatJoinCode } from "../../../../schools/contracts";
import { QrCode } from "../../../ui/QrCode";
import { CopyButton } from "../parts";
import type { SpaceWords } from "../../spaces/words";
import styles from "./JoinWays.module.css";

/** The direct way in: the code's name list, the code already filled, said
 * as it's shown (275-XKT). */
export const joinLink = (code: string) =>
  `${location.origin}/join/${formatJoinCode(code)}`;

const canShare = () =>
  typeof navigator !== "undefined" && typeof navigator.share === "function";

/**
 * How a child gets onto a device of their own, one path first (family and
 * class alike): the QR, large, and its link with Copy and Share as one
 * control. Scan it or open it and the child taps their name. Everything
 * else (typing the code, printed cards, a class's board) waits under
 * "Other ways", which opens below, so nothing above it moves.
 */
export function JoinWays({
  code,
  words,
  notice,
  cards,
  more,
}: {
  code: string;
  /** Whose code, in the space's words: "Family code", "Class code". */
  words: Pick<SpaceWords, "Code">;
  /** Why the code isn't working right now (sign-in paused), over the QR. */
  notice?: ReactNode;
  /** Printed sign-in cards: who has one, and printing them. */
  cards?: ReactNode;
  /** Any further way in, last (a class's full-screen board). */
  more?: ReactNode;
}) {
  const link = joinLink(code);
  const shown = formatJoinCode(code);
  const text = link.replace(/^https?:\/\//, "");
  const host = location.host;
  const [open, setOpen] = useState(false);
  const [share] = useState(canShare);
  const others = useId();
  return (
    <section className={styles.ways} data-join-ways="">
      {notice}
      <QrCode
        value={link}
        label={`QR code for ${text}`}
        className={styles.qr}
      />
      <p className={styles.lead}>Scan it on their device, or open the link.</p>
      <div className={styles.linkBox} data-join-link="">
        <span
          className={styles.link}
          style={{ "--chars": text.length } as CSSProperties}
          translate="no"
          data-link-text=""
        >
          {text}
        </span>
        <span className={styles.linkActs}>
          <CopyButton
            text={link}
            label="Copy"
            copied="Copied"
            shareUrl={link}
            className={styles.linkAct}
            icon={<Glyph d="M9 9h10v10H9V9Zm-4 6V5h10" />}
          />
          {share && (
            <button
              type="button"
              className={styles.linkAct}
              onClick={() => {
                void navigator.share({ url: link }).catch((error: unknown) => {
                  // Closing the share sheet is a choice, not a failure.
                  if ((error as Error)?.name !== "AbortError")
                    console.error("The link could not be shared", error);
                });
              }}
            >
              <Glyph d="M12 15V4m0 0-4 4m4-4 4 4M6 12v7h12v-7" />
              Share
            </button>
          )}
        </span>
      </div>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={others}
        data-other-ways=""
        onClick={() => setOpen((now) => !now)}
      >
        Other ways
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="m7 10 5 5 5-5" />
        </svg>
      </button>
      <div id={others} className={styles.others} hidden={!open}>
        <section className={styles.way} aria-labelledby={`${others}-code`}>
          <h3 id={`${others}-code`} className={styles.wayTitle}>
            Type the code
          </h3>
          <p className={styles.codeBlock}>
            <span className={styles.codeLabel}>{words.Code}</span>
            <strong className={styles.code} data-class-code={code}>
              {shown}
            </strong>
          </p>
          <p className={styles.note}>
            Open <strong translate="no">{host}/join</strong> on their device and
            type it.
          </p>
        </section>
        {cards && <div className={styles.way}>{cards}</div>}
        {more && <div className={styles.way}>{more}</div>}
      </div>
    </section>
  );
}

function Glyph({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={styles.glyph}
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  );
}
