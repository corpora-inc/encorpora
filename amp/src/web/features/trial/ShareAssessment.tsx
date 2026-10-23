import { useEffect, useMemo, useRef, useState } from "react";
import { buttonClass } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { mapShareImage, type ShareMap } from "../pathways/share-image";
import styles from "./Trial.module.css";

export function assessmentShare(level: string) {
  return {
    title: "Adaptive Math Pathways",
    text: `My current math estimate on AMP: ${level}. Think you’re good at math? Try the assessment and explore your pathways.`,
    url: "https://amp.corpora.inc/try",
  };
}

/** Share the estimate and optional earned map, never learner identity. */
export function ShareAssessment({
  level,
  map,
}: {
  level: string;
  map?: ShareMap;
}) {
  const imageKey = useMemo(
    () => (map ? JSON.stringify([level, map.skills, map.evidence]) : ""),
    [level, map?.skills, map?.evidence],
  );
  const [imageFailure, setImageFailure] = useState("");
  const [image, setImage] = useState<{
    key: string;
    file: File;
    url: string;
  } | null>(null);
  const card = image?.key === imageKey ? image : null;
  const generating = !!map && !card && imageFailure !== imageKey;
  useEffect(() => {
    if (!map) return;
    let active = true,
      url: string | undefined;
    void mapShareImage(map, level)
      .then((blob) => {
        if (!active) return;
        url = URL.createObjectURL(blob);
        setImage({
          key: imageKey,
          file: new File([blob], "amp-pathways.png", { type: "image/png" }),
          url,
        });
      })
      .catch(() => {
        if (active) {
          setImage(null);
          setImageFailure(imageKey);
        }
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [imageKey]);
  const trigger = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const payload = assessmentShare(level);
  const text = `${payload.text}\n${payload.url}`;
  async function share() {
    setBusy(true);
    try {
      let shared: ShareData = payload;
      let nativeSupported = !!navigator.share;
      try {
        if (card && navigator.canShare?.({ files: [card.file] }))
          shared = { ...payload, files: [card.file] };
        if (navigator.canShare && !navigator.canShare(shared))
          nativeSupported = false;
      } catch {
        nativeSupported = false;
      }
      if (nativeSupported && navigator.share) {
        try {
          await navigator.share(shared);
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError")
            return;
        }
      }
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
      } catch {
        setManual(true);
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {card && (
        <figure className={styles.mapShareCard}>
          <img
            src={card.url}
            alt={`Your AMP curriculum map with your ${level} estimate and earned skill illumination`}
            width="1200"
            height="630"
          />
          <figcaption>
            <a href={card.url} download="amp-pathways.png">
              Save map image
            </a>
          </figcaption>
        </figure>
      )}
      <div className={styles.share}>
        <button
          ref={trigger}
          className={buttonClass("quiet")}
          disabled={busy || generating}
          onClick={() => void share()}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path
              d="M12 16V3m-5 5 5-5 5 5M5 13v7h14v-7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {generating ? "Preparing share image…" : "Share your assessment"}
        </button>
        <span role="status">
          {copied
            ? "Copied. Ready to paste."
            : imageFailure && imageFailure === imageKey
              ? "The map image could not be created. You can share your estimate."
              : ""}
        </span>
      </div>
      <Dialog
        open={manual}
        onOpenChange={setManual}
        title="Share your assessment"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          trigger.current?.focus();
        }}
      >
        <p>
          Copy this text to share your estimate and invite someone to try AMP.
        </p>
        <label className={styles.shareText}>
          Assessment text
          <textarea
            readOnly
            value={text}
            rows={5}
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
      </Dialog>
    </>
  );
}
