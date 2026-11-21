import { Changed } from "./Changed";
import { counted } from "./format";
import styles from "./HelpCounts.module.css";

type Help = {
  hints: number;
  lessons: number;
  examples: number;
  videos: number;
};

export const HELP_KINDS = [
  { key: "hints", header: "Hints", one: "hint" },
  { key: "lessons", header: "Lessons", one: "lesson" },
  { key: "examples", header: "Explanations", one: "explanation" },
  { key: "videos", header: "Videos", one: "video" },
] as const;

/** Help opened, in words: "2 hints, 1 lesson, 0 explanations, 0 videos". */
export const helpWords = (help: Help) =>
  HELP_KINDS.map((kind) => counted(help[kind.key], kind.one)).join(", ");

/** Each kind's small drawing: a bulb, a book, numbered steps, a play mark. */
export function HelpGlyph({
  kind,
}: {
  kind: (typeof HELP_KINDS)[number]["key"];
}) {
  return (
    <svg className={styles.glyph} viewBox="0 0 16 16" aria-hidden="true">
      {kind === "hints" ? (
        <path d="M6 13.5h4M6.5 11.5h3M8 1.75a4.25 4.25 0 0 0-2.6 7.6c.5.4.85.95.85 1.6v.55h3.5v-.55c0-.65.35-1.2.85-1.6A4.25 4.25 0 0 0 8 1.75Z" />
      ) : kind === "lessons" ? (
        <path d="M8 4.2C6.6 3 4.6 2.6 2 2.75v9.5c2.6-.15 4.6.25 6 1.5 1.4-1.25 3.4-1.65 6-1.5v-9.5C11.4 2.6 9.4 3 8 4.2Zm0 0v9.5" />
      ) : kind === "examples" ? (
        <path d="M6.5 4h7M6.5 8h7M6.5 12h7M2.5 3.25h1.25v1.5M2.5 7.25H4l-1.5 1.5H4M2.5 11.25H4l-.75.75.75.75H2.5" />
      ) : (
        <path d="M5.25 3.25v9.5L12.75 8l-7.5-4.75Z" />
      )}
    </svg>
  );
}

/**
 * Help opened as four small counts behind their drawings (hints, lessons,
 * explanations, videos), for a row with no room for four columns. Each
 * count has a fixed width and changes in place.
 */
export function HelpCounts({ help }: { help: Help }) {
  return (
    <span
      className={styles.counts}
      role="img"
      aria-label={`Help: ${helpWords(help)}`}
    >
      {HELP_KINDS.map((kind) => (
        <span
          key={kind.key}
          className={styles.count}
          data-zero={help[kind.key] === 0 || undefined}
        >
          <HelpGlyph kind={kind.key} />
          <Changed value={help[kind.key]}>{help[kind.key]}</Changed>
        </span>
      ))}
    </span>
  );
}
