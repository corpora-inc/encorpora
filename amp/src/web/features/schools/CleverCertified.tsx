import badge from "./clever-certified-partner.webp";
import badge2x from "./clever-certified-partner-2x.webp";
import styles from "./CleverCertified.module.css";

/** Clever's Certified Partner badge (V1), from Clever's media kit
 * (clever.com/about/media-kit), cut from its tile and otherwise unaltered:
 * Clever's brand terms allow no redrawing or recoloring. Lossless WebP (the
 * same pixels as the cut PNG): this repository keeps PNGs in LFS, which the
 * web image's build does not pull. One file pair, 11:12; each size below
 * keeps that ratio, and the width and height attributes hold its box before
 * the file arrives. The certification is a fact about AMP, not a deployment
 * setting, so it shows without asking the server anything: the page paints
 * whole whatever the API does. */
const sizes = {
  hero: { width: 77, height: 84 },
  footer: { width: 55, height: 60 },
} as const;

export function CleverBadge({ size }: { size: keyof typeof sizes }) {
  return (
    <img
      className={styles.badge}
      src={badge}
      srcSet={`${badge} 1x, ${badge2x} 2x`}
      alt="Clever Certified Partner"
      {...sizes[size]}
      decoding="async"
    />
  );
}

/** The badge and one factual line, in `/schools`' opening. */
export function CleverCertified({ className = "" }: { className?: string }) {
  return (
    <p className={`${styles.certified} ${className}`}>
      <CleverBadge size="hero" />
      <span>
        Certified Clever partner: rostering and{" "}
        <span className={styles.whole}>sign-in</span> through Clever.
      </span>
    </p>
  );
}
