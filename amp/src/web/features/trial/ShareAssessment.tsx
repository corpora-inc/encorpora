import { useEffect, useMemo, useRef, useState } from "react";
import { buttonClass } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { mapShareImage, type ShareMap } from "../pathways/share-image";
import styles from "./ShareAssessment.module.css";

export function assessmentShare(level: string) {
  return {
    title: "Adaptive Math Pathways",
    text: `My current math estimate on AMP: ${level}. Think you’re good at math? Try the assessment and explore your pathways.`,
    url: "https://amp.corpora.inc/try",
  };
}

export function assessmentShareLinks(level: string) {
  const { title, text, url } = assessmentShare(level);
  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?${new URLSearchParams({ u: url })}`,
    whatsapp: `https://wa.me/?${new URLSearchParams({ text: `${text}\n${url}` })}`,
    x: `https://x.com/intent/tweet?${new URLSearchParams({ text, url })}`,
    email: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${text}\n${url}`)}`,
  };
}

type IconName =
  | "facebook"
  | "whatsapp"
  | "x"
  | "email"
  | "link"
  | "copy"
  | "download"
  | "share";
function ShareIcon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
      {name === "facebook" ? (
        <path
          fill="currentColor"
          stroke="none"
          d="M14.5 21v-8h2.8l.5-3.3h-3.3V7.6c0-1 .4-1.7 1.8-1.7H18V3a22 22 0 0 0-2.5-.2c-2.5 0-4.3 1.6-4.3 4.5v2.4H8.5V13h2.7v8z"
        />
      ) : name === "x" ? (
        <path d="m5 4 14 16M19 4 5 20M3.5 4H8l12.5 16H16z" />
      ) : name === "whatsapp" ? (
        <>
          <path d="M20 11.5a8.5 8.5 0 0 1-12.7 7.4L3 20l1.2-4.2A8.5 8.5 0 1 1 20 11.5Z" />
          <path d="M8 7.5c0 4 3 7 7 7l1-2-2-1-1 1c-1.5-.5-2.5-1.5-3-3l1-1-1-2z" />
        </>
      ) : name === "email" ? (
        <>
          <rect x="3" y="5" width="18" height="14" rx="3" />
          <path d="m4 7 8 6 8-6" />
        </>
      ) : name === "link" ? (
        <>
          <path d="m10 7 2-2a5 5 0 0 1 7 7l-2 2M14 17l-2 2a5 5 0 0 1-7-7l2-2m1 6 8-8" />
        </>
      ) : name === "copy" ? (
        <>
          <rect x="8" y="8" width="12" height="13" rx="2" />
          <path d="M15 4H6a2 2 0 0 0-2 2v10" />
        </>
      ) : name === "download" ? (
        <path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4" />
      ) : (
        <path d="M12 16V3m-5 5 5-5 5 5M5 13v7h14v-7" />
      )}
    </svg>
  );
}

/** Explicit sharing destinations; images stay on this device until downloaded. */
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
  const [image, setImage] = useState<{ key: string; url: string } | null>(null);
  const card = image?.key === imageKey ? image : null;
  const failed = !!imageKey && imageFailure === imageKey;
  useEffect(() => {
    if (!map) return;
    let active = true,
      url: string | undefined;
    void mapShareImage(map, level)
      .then((blob) => {
        if (!active) return;
        url = URL.createObjectURL(blob);
        setImage({ key: imageKey, url });
      })
      .catch(() => {
        if (active) setImageFailure(imageKey);
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [imageKey]);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<"link" | "result" | null>(null);
  const [manual, setManual] = useState<"link" | "result" | null>(null);
  const [copying, setCopying] = useState(false);
  const payload = assessmentShare(level);
  const text = `${payload.text}\n${payload.url}`;
  const links = assessmentShareLinks(level);
  async function copy(kind: "link" | "result") {
    setCopying(true);
    setCopied(null);
    setManual(null);
    try {
      await navigator.clipboard.writeText(kind === "link" ? payload.url : text);
      setCopied(kind);
    } catch {
      setManual(kind);
    } finally {
      setCopying(false);
    }
  }
  const preview = (
    <div className={styles.preview}>
      {card ? (
        <img
          src={card.url}
          alt={`Your AMP curriculum map with your ${level} estimate and earned skill illumination`}
          width="1200"
          height="630"
        />
      ) : (
        <span role="status">
          {failed
            ? "Map image unavailable. Your sharing links are ready."
            : "Preparing your map…"}
        </span>
      )}
    </div>
  );
  const download = card && (
    <a
      className={buttonClass("quiet", styles.download)}
      href={card.url}
      download="amp-pathways.png"
      aria-label="Save map image"
    >
      <ShareIcon name="download" />
      Save image
    </a>
  );
  return (
    <>
      {map && (
        <figure className={styles.card}>
          {preview}
          <figcaption>{download}</figcaption>
        </figure>
      )}
      <button
        ref={trigger}
        className={buttonClass("secondary")}
        onClick={() => setOpen(true)}
      >
        <ShareIcon name="share" />
        Share your assessment
      </button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setCopied(null);
            setManual(null);
          }
        }}
        title="Share your assessment"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          trigger.current?.focus();
        }}
      >
        <div className={styles.panel}>
          {map ? (
            preview
          ) : (
            <p className={styles.estimate}>
              My current estimate <strong>{level}</strong>
            </p>
          )}
          <div className={styles.destinations}>
            <a
              href={links.facebook}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Share on Facebook"
            >
              <ShareIcon name="facebook" />
              Facebook
            </a>
            <a
              href={links.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Share on WhatsApp"
            >
              <ShareIcon name="whatsapp" />
              WhatsApp
            </a>
            <a
              href={links.x}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Post on X"
            >
              <ShareIcon name="x" />
              Post on X
            </a>
            <a href={links.email} aria-label="Share by email">
              <ShareIcon name="email" />
              Email
            </a>
            <button disabled={copying} onClick={() => void copy("link")}>
              <ShareIcon name="link" />
              {copied === "link" ? "Link copied" : "Copy link"}
            </button>
            <button disabled={copying} onClick={() => void copy("result")}>
              <ShareIcon name="copy" />
              {copied === "result" ? "Result copied" : "Copy result"}
            </button>
          </div>
          <p className={styles.note}>
            Facebook shares the assessment link. Save your map image to add it
            to your post.
          </p>
          {card && <div className={styles.save}>{download}</div>}
          <div className={styles.status} role="status">
            {copied
              ? `${copied === "link" ? "Link" : "Result and link"} copied.`
              : ""}
          </div>
          {manual && (
            <label className={styles.manual}>
              Copy this {manual === "link" ? "link" : "result"}
              <textarea
                autoFocus
                readOnly
                rows={manual === "link" ? 2 : 5}
                value={manual === "link" ? payload.url : text}
                onFocus={(event) => event.currentTarget.select()}
              />
            </label>
          )}
        </div>
      </Dialog>
    </>
  );
}
