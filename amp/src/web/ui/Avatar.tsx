import type { CSSProperties } from "react";
import styles from "./Avatar.module.css";

const AVATAR_HUES = 8;

/** A stable hue index for a name (FNV-1a), so a person keeps their color on
 * every screen, whatever list they appear in. */
export function avatarHue(name: string) {
  let hash = 0x811c9dc5;
  for (const char of name.trim().toLowerCase()) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % AVATAR_HUES;
}

/** First and last initials: "Amara Osei" is AO, "Cher" is C. Only words that
 * begin with a letter count, so "Ana Ruiz (2)" is AR. */
export function initials(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => /^\p{L}/u.test(word));
  const first = [...(words[0] ?? "")][0] ?? "";
  const last = words.length > 1 ? ([...words.at(-1)!][0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

/** A person's initials on their tint. Decorative beside a visible name. */
export function Avatar({
  name,
  size = "regular",
}: {
  name: string;
  /** `fill`: as big as the surrounding `--avatar-size`. */
  size?: "small" | "regular" | "large" | "fill";
}) {
  const hue = avatarHue(name);
  return (
    <span
      className={`${styles.avatar} ${styles[size]}`}
      style={
        {
          "--avatar": `var(--color-avatar-${hue})`,
          "--on-avatar": `var(--color-on-avatar-${hue})`,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

/** A group of people as overlapping avatars. `label` names them for
 * assistive technology; the row itself is decorative. */
export function AvatarStack({
  names,
  label,
  size = "regular",
}: {
  names: readonly string[];
  label: string;
  size?: "small" | "regular" | "large";
}) {
  return (
    <span className={styles.stack} role="img" aria-label={label}>
      {/* Two children can share a name: the place in the stack is the key. */}
      {names.map((name, at) => (
        <Avatar key={`${at}:${name}`} name={name} size={size} />
      ))}
    </span>
  );
}
