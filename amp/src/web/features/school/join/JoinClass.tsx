import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Button, buttonClass } from "../../../ui/Button";
import { Dialog } from "../../../ui/Dialog";
import { Menu, MenuItem } from "../../../ui/Menu";
import { QrCode } from "../../../ui/QrCode";
import { Toast } from "../../../ui/Toast";
import { useQuery } from "@tanstack/react-query";
import { sessionOptions } from "../../../lib/query";
import { useRotateCode } from "../classes/api";
import { CopyButton } from "../parts";
import styles from "./JoinClass.module.css";

/** A class code as people read and type it: RCV-VFD. */
export const formatJoinCode = (code: string) =>
  code.length === 6 ? `${code.slice(0, 3)}-${code.slice(3)}` : code;
/** The direct way in: the class's name list, the code already filled. */
export const joinLink = (code: string) =>
  `${location.origin}/join/${formatJoinCode(code)}`;

const GLYPHS = {
  copy: "M9 9h10v10H9V9Zm-4 6V5h10",
  // The Start class board's own mark: four corners opening out.
  expand: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  qr: "M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h2.5v2.5H14V14Zm3.5 3.5H20V20h-2.5v-2.5ZM14 20h1m5-6h-1",
};
function Glyph({ kind }: { kind: keyof typeof GLYPHS | "more" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={styles.glyph}
      data-glyph={kind}
      aria-hidden="true"
      focusable="false"
    >
      {kind === "more" ? (
        <>
          <circle cx="5.5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="18.5" cy="12" r="1.6" />
        </>
      ) : (
        <path d={GLYPHS[kind]} />
      )}
    </svg>
  );
}

/**
 * One way to get children into a class, everywhere it is offered (the setup
 * step, class Settings, Today, People, the Start class board): the code in
 * one face, a direct link with Copy, a QR code for that link that opens the
 * class's name list, the full-screen sign-in board, and printing sign-in
 * cards as a quiet extra. `compact` is the one-line form for a header: the
 * code, then one group of equal controls (Copy link, Full screen, the QR,
 * and More, which holds New code).
 */
export function JoinClass({
  code,
  place,
  family,
  compact = false,
  cards = true,
  boardLink = true,
  label = true,
  manage = false,
  locked = false,
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
  /** This person can make a new code: More offers it. */
  manage?: boolean;
  /** Sign-in is paused by guessing: New code is the way on, so it shows. */
  locked?: boolean;
}) {
  const link = joinLink(code);
  const shown = formatJoinCode(code);
  const [qrOpen, setQrOpen] = useState(false);
  const newCode = manage && (
    <NewCode place={place} code={shown} family={family} locked={locked} />
  );
  if (compact)
    return (
      <section className={styles.compact} aria-label="Join this class">
        <span className={styles.codeGroup}>
          {label && <span className={styles.label}>Class code</span>}
          <strong className={styles.code} data-class-code={code}>
            {shown}
          </strong>
        </span>
        <span className={styles.group}>
          <CopyButton
            text={link}
            label="Copy link"
            copied="Link copied"
            className={`${styles.act} ${styles.copyAct}`}
            icon={<Glyph kind="copy" />}
          />
          {boardLink && (
            <Link
              to="/school/$org/classes/$class/start"
              params={place}
              className={styles.act}
            >
              <Glyph kind="expand" />
              Full screen
            </Link>
          )}
          <button
            type="button"
            className={`${styles.act} ${styles.iconOnly}`}
            aria-label="Show the QR code"
            title="QR code"
            onClick={() => setQrOpen(true)}
          >
            <Glyph kind="qr" />
          </button>
          {newCode}
        </span>
        <Dialog open={qrOpen} onOpenChange={setQrOpen} title={shown}>
          <div className={styles.qrSheet}>
            <QrCode
              value={link}
              label={`Join ${shown}`}
              className={styles.qrLarge}
            />
            <p>
              Scan it with a camera to open{" "}
              {family ? "your children’s" : "the class’s"} names.
            </p>
          </div>
        </Dialog>
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
        <div className={`${styles.group} ${styles.linkRow}`}>
          <span className={styles.link}>
            {link.replace(/^https?:\/\//, "")}
          </span>
          <CopyButton
            text={link}
            label="Copy link"
            copied="Link copied"
            className={`${styles.act} ${styles.copyAct}`}
            icon={<Glyph kind="copy" />}
          />
        </div>
        <div className={`${styles.group} ${styles.actions}`}>
          {boardLink && (
            <Link
              to="/school/$org/classes/$class/start"
              params={place}
              className={styles.act}
            >
              <Glyph kind="expand" />
              Open the sign-in board
            </Link>
          )}
          {cards && (
            <Link
              to="/school/$org/classes/$class/cards"
              params={place}
              className={`${buttonClass("quiet")} ${styles.quietAct}`}
            >
              Print sign-in cards
            </Link>
          )}
          {newCode}
        </div>
        <p className={styles.fallback}>
          Or open {location.host}/join and type the code.
        </p>
      </div>
      <QrCode value={link} label={`Join ${shown}`} className={styles.qr} />
    </section>
  );
}

/** New code, kept out of the way in More: the old code, its link and its QR
 * stop working, so it asks first and says so. While sign-in is paused it is
 * the way on, so it shows as a button of its own. */
function NewCode({
  place,
  code,
  family,
  locked,
}: {
  place: { org: string; class: string };
  code: string;
  family: boolean;
  locked: boolean;
}) {
  const session = useQuery(sessionOptions).data ?? null;
  const rotate = useRotateCode(session, place);
  const [asking, setAsking] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  async function make() {
    try {
      const { joinCode } = await rotate.mutateAsync();
      setAsking(false);
      setStatus(`The new class code is ${formatJoinCode(joinCode)}.`);
    } catch (failure) {
      console.error("A new class code could not be made", failure);
      setError(
        "The new code wasn’t made, so the old one still works. Try again in a moment.",
      );
    }
  }
  let trigger: ReactNode;
  if (locked)
    trigger = (
      <Button
        variant="primary"
        className={styles.primaryAct}
        onClick={() => setAsking(true)}
      >
        New code
      </Button>
    );
  else
    trigger = (
      <Menu
        label={<Glyph kind="more" />}
        aria-label="More for the class code"
        showChevron={false}
        triggerClassName={`${styles.act} ${styles.iconOnly}`}
      >
        <MenuItem onSelect={() => setAsking(true)}>New class code</MenuItem>
      </Menu>
    );
  return (
    <>
      {trigger}
      <Dialog
        open={asking}
        onOpenChange={(open) => {
          if (!rotate.isPending) setAsking(open);
        }}
        title="Make a new class code?"
      >
        <div className={styles.confirm}>
          <p>
            {code} stops working right away, and so do its link and QR code.{" "}
            {family ? "Children" : "Students"} already signed in stay signed in,
            and printed cards keep working.
          </p>
          <div className={styles.confirmActions}>
            <Button
              variant="secondary"
              disabled={rotate.isPending}
              onClick={() => setAsking(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              aria-busy={rotate.isPending}
              disabled={rotate.isPending}
              onClick={() => void make()}
            >
              Make a new code
            </Button>
          </div>
        </div>
      </Dialog>
      <Toast message={status} tone="status" onDismiss={() => setStatus("")} />
      <Toast message={error} onDismiss={() => setError("")} />
    </>
  );
}
