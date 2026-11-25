import { useQuery } from "@tanstack/react-query";
import { authConfigOptions } from "../../lib/query";
import { cleverEnabled } from "../school/clever/enabled";
import badge from "./clever-certified-partner.png";
import badge2x from "./clever-certified-partner-2x.png";
import styles from "./CleverCertified.module.css";

/** Clever's Certified Partner badge (V1), from Clever's media kit
 * (clever.com/about/media-kit), cut from its tile and otherwise unaltered:
 * Clever's brand terms allow no redrawing or recoloring. One file pair, 11:12;
 * each size below keeps that ratio, and the width and height attributes hold
 * its box before the file arrives. Shown only while Clever is enabled, like
 * every other Clever entry point. */
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

/** The badge and one factual line, beside `/schools`' Clever action. */
export function CleverCertified({ className = "" }: { className?: string }) {
  const clever = cleverEnabled(useQuery(authConfigOptions).data);
  if (!clever) return null;
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

/** The footer's quiet copy of the badge, on every school page. */
export function CleverFooterBadge() {
  const clever = cleverEnabled(useQuery(authConfigOptions).data);
  return clever ? <CleverBadge size="footer" /> : null;
}
