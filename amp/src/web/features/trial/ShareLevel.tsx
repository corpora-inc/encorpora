import * as RadixDialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { Button, buttonClass } from "../../ui/Button";
import { Toast } from "../../ui/Toast";
import { track } from "./analytics";
import { CARD_HEIGHT, CARD_WIDTH, renderLevelCard } from "./share-card";
import {
  facebookShareUrl,
  levelShareUrl,
  mayBeChild,
  shareText,
  xShareUrl,
  type LevelCardData,
} from "./share-data";
import styles from "./ShareLevel.module.css";

/** Sharing's words, addressed to the grown-up. */
export const shareCopy = {
  open: (child: boolean) =>
    child ? "Share your child’s level" : "Share your level",
  privacy: "The image shows levels only. The link starts a new level check.",
  grownUps: "Posting online is for a parent or guardian.",
  grownUp: "I’m a parent or guardian",
  share: "Share…",
  facebook: "Facebook",
  x: "X",
  copy: "Copy link",
  copied: "Link copied",
  download: "Download image",
  done: "Done",
  drawing: "Drawing your level card",
  failed: "The level card could not be drawn. Try again.",
  copyFailed: "The link could not be copied. Select it and copy it instead.",
};

type Channel = "system" | "facebook" | "x" | "copy" | "download";

/**
 * "Share your level" during the free level check: a card image with the
 * levels only, and a link that starts a fresh check. If the learner may be
 * under 13, only "Download image" shows until a parent or guardian steps in.
 * Plain links and the system share sheet; no third-party script runs.
 */
export function ShareLevel({
  data,
  birthYear,
  surface,
  className,
}: {
  data: LevelCardData;
  birthYear: number | null | undefined;
  surface: "check" | "map";
  className?: string;
}) {
  const child = mayBeChild(birthYear);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        className={className}
        onClick={() => {
          setOpen(true);
          track("share_open", { surface });
        }}
      >
        <svg
          className={styles.icon}
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" />
        </svg>
        {shareCopy.open(child)}
      </Button>
      {open && (
        <ShareSheet data={data} child={child} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function ShareSheet({
  data,
  child,
  onClose,
}: {
  data: LevelCardData;
  child: boolean;
  onClose: () => void;
}) {
  const [card, setCard] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState("");
  const [grownUp, setGrownUp] = useState(!child);
  const [copied, setCopied] = useState(false);
  const link = levelShareUrl(location.origin);
  // Drawn once per set of levels, not on every parent render.
  const levels = JSON.stringify(data);
  useEffect(() => {
    let url = "";
    let live = true;
    renderLevelCard(JSON.parse(levels) as LevelCardData, location.host)
      .then((blob) => {
        if (!live) return;
        url = URL.createObjectURL(blob);
        setCard({ blob, url });
      })
      .catch((failure: unknown) => {
        console.error("Level card not drawn", failure);
        if (live) setError(shareCopy.failed);
      });
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [levels]);
  const file =
    card && new File([card.blob], "amp-level.png", { type: "image/png" });
  const system =
    !!file &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] });
  const done = (channel: Channel) => track("share_complete", { channel });
  return (
    <RadixDialog.Root open onOpenChange={(next) => !next && onClose()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={styles.overlay} />
        <RadixDialog.Content
          className={styles.sheet}
          aria-describedby="share-level-privacy"
        >
          <div className={styles.body}>
            <RadixDialog.Title className={styles.title}>
              {shareCopy.open(child)}
            </RadixDialog.Title>
            <div
              className={styles.preview}
              style={{ aspectRatio: `${CARD_WIDTH} / ${CARD_HEIGHT}` }}
              aria-busy={!card && !error}
            >
              {card ? (
                <img src={card.url} alt="" />
              ) : (
                <span className="sr-only">{shareCopy.drawing}</span>
              )}
            </div>
            <p id="share-level-privacy" className={styles.privacy}>
              {shareCopy.privacy}
            </p>
          </div>
          <div className={styles.actions}>
            {grownUp && system && (
              <Button
                variant="primary"
                className={styles.wide}
                onClick={() =>
                  void navigator
                    .share({ files: [file!], text: shareText, url: link })
                    .then(() => done("system"))
                    .catch((failure: unknown) => {
                      // Closing the share sheet is a choice, not a failure.
                      if ((failure as Error)?.name !== "AbortError")
                        console.error("System share failed", failure);
                    })
                }
              >
                {shareCopy.share}
              </Button>
            )}
            {grownUp && (
              <>
                <a
                  className={buttonClass("secondary")}
                  href={facebookShareUrl(link)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => done("facebook")}
                >
                  {shareCopy.facebook}
                </a>
                <a
                  className={buttonClass("secondary")}
                  href={xShareUrl(link)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => done("x")}
                >
                  {shareCopy.x}
                </a>
                <Button
                  variant="secondary"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(link)
                      .then(() => {
                        setCopied(true);
                        done("copy");
                      })
                      .catch((failure: unknown) => {
                        console.error("Link not copied", failure);
                        setError(shareCopy.copyFailed);
                      })
                  }
                >
                  {copied ? shareCopy.copied : shareCopy.copy}
                </Button>
              </>
            )}
            {card ? (
              <a
                className={buttonClass("secondary")}
                href={card.url}
                download="amp-level.png"
                onClick={() => done("download")}
              >
                {shareCopy.download}
              </a>
            ) : (
              <Button variant="secondary" disabled>
                {shareCopy.download}
              </Button>
            )}
            {!grownUp && (
              <div className={styles.grownUps}>
                <p>{shareCopy.grownUps}</p>
                <Button variant="quiet" onClick={() => setGrownUp(true)}>
                  {shareCopy.grownUp}
                </Button>
              </div>
            )}
            <RadixDialog.Close
              className={`${buttonClass("quiet")} ${styles.wide}`}
            >
              {shareCopy.done}
            </RadixDialog.Close>
          </div>
          <Toast message={error} onDismiss={() => setError("")} />
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
