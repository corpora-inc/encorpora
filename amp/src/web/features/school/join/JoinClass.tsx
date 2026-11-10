import { Link } from "@tanstack/react-router";
import { buttonClass } from "../../../ui/Button";
import { QrCode } from "../../../ui/QrCode";
import { CopyButton } from "../parts";
import styles from "./JoinClass.module.css";

/** A class code as people read and type it: RCV-VFD. */
export const formatJoinCode = (code: string) =>
  code.length === 6 ? `${code.slice(0, 3)}-${code.slice(3)}` : code;
/** The direct way in: the class's name list, the code already filled. */
export const joinLink = (code: string) =>
  `${location.origin}/join/${formatJoinCode(code)}`;

/**
 * One way to get children into a class, everywhere it is offered (the setup
 * step, class Settings, Today, the Start class board): the code in one face,
 * a direct link with Copy, a QR code for that link that opens the class's
 * name list, the full-screen sign-in board, and printing sign-in cards as a
 * quiet extra. `compact` is the one-line form for Today's header.
 */
export function JoinClass({
  code,
  place,
  family,
  compact = false,
  cards = true,
  boardLink = true,
  label = true,
}: {
  code: string;
  place: { org: string; class: string };
  family: boolean;
  compact?: boolean;
  /** Offer printing sign-in cards. */
  cards?: boolean;
  /** Offer the full-screen board here (the bar's Start class may). */
  boardLink?: boolean;
  /** "Class code" before the code; off where a heading already says it. */
  label?: boolean;
}) {
  const link = joinLink(code);
  const shown = formatJoinCode(code);
  const board = (
    <Link
      to="/school/$org/classes/$class/start"
      params={place}
      className={compact ? styles.inlineLink : buttonClass("secondary")}
    >
      {compact ? "Full screen" : "Open the sign-in board"}
    </Link>
  );
  if (compact)
    return (
      <section className={styles.compact} aria-label="Join this class">
        {label && <span className={styles.label}>Class code</span>}
        <strong className={styles.code} data-class-code={code}>
          {shown}
        </strong>
        <CopyButton text={link} label="Copy link" copied="Link copied" />
        {boardLink && board}
      </section>
    );
  return (
    <section className={styles.join} aria-labelledby="join-class">
      <div className={styles.text}>
        <h2 id="join-class" className={styles.title}>
          {family ? "Sign in on their own device" : "Students sign in"}
        </h2>
        <p className={styles.lead}>
          Scan the code, or open the link: it goes straight to{" "}
          {family ? "your children’s" : "the class’s"} names. Each one taps
          their name and their three pictures.
        </p>
        <div className={styles.codeRow}>
          <span className={styles.label}>Class code</span>
          <strong className={styles.code} data-class-code={code}>
            {shown}
          </strong>
        </div>
        <div className={styles.linkRow}>
          <span className={styles.link}>{link.replace(/^https?:\/\//, "")}</span>
          <CopyButton text={link} label="Copy link" copied="Link copied" />
        </div>
        <div className={styles.actions}>
          {board}
          {cards && (
            <Link
              to="/school/$org/classes/$class/cards"
              params={place}
              className={buttonClass("quiet")}
            >
              Print sign-in cards
            </Link>
          )}
        </div>
        <p className={styles.fallback}>
          Or open {location.host}/join and type the code.
        </p>
      </div>
      <QrCode value={link} label={`Join ${shown}`} className={styles.qr} />
    </section>
  );
}
