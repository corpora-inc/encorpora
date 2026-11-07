import type { ReactNode } from "react";
import type { SchoolPicture } from "../../../../schools/contracts";
import styles from "./Pictures.module.css";

/* Sixteen stickers, one hand: a soft round ground, one strong color, plain
   round shapes, a face or a detail. Colors are the app's own, so each theme
   stays itself. Eyes stay black on white in both themes. */
const ground = (hue: number) => `var(--color-avatar-${hue})`;
const orange = "var(--color-strand-fractions)";
const purple = "var(--color-strand-operations)";
const blue = "var(--color-strand-number)";
const teal = "var(--color-strand-geometry)";
const green = "var(--color-strand-measurement)";
const gold = "var(--color-strand-decimals)";
const berry = "var(--color-strand-ratio)";
const cyan = "var(--color-strand-functions)";
const rust = "var(--color-strand-modeling)";
const pine = "var(--color-strand-algebra)";
const grey = "var(--color-figure-axis)";
const bark = "var(--color-figure-warm)";
const ink = "var(--color-figure-ink)";
const white = "var(--color-print-paper)";
const black = "var(--color-print-ink)";

const art: Record<SchoolPicture, { hue: number; draw: ReactNode }> = {
  fox: {
    hue: 2,
    draw: (
      <>
        <path
          d="M12 13 24 24Q32 21 40 24L52 13Q55 30 50 40 44 52 32 57 20 52 14 40 9 30 12 13Z"
          fill={orange}
        />
        <path
          d="M14 38Q22 35 28 40 31 46 32 57 20 52 14 40ZM50 38Q42 35 36 40 33 46 32 57 44 52 50 40Z"
          fill={white}
        />
        <path d="M15.5 18 23 25 17 28ZM48.5 18 41 25 47 28Z" fill={black} />
        <circle cx="25" cy="33.5" r="2.7" fill={black} />
        <circle cx="39" cy="33.5" r="2.7" fill={black} />
        <path
          d="M28.5 49.5Q32 47.5 35.5 49.5 34.5 54 32 55 29.5 54 28.5 49.5Z"
          fill={black}
        />
      </>
    ),
  },
  moon: {
    hue: 1,
    draw: (
      <>
        <path
          d="M25.5 9.1A25 25 0 1 0 51.7 41.9 21 21 0 1 1 25.5 9.1Z"
          fill={gold}
        />
        <path
          d="M45 13 46.9 18.1 52 20 46.9 21.9 45 27 43.1 21.9 38 20 43.1 18.1Z"
          fill={gold}
        />
        <circle cx="36" cy="32" r="2" fill={gold} />
      </>
    ),
  },
  turtle: {
    hue: 7,
    draw: (
      <>
        <circle cx="54" cy="36" r="6.8" fill={green} />
        <circle cx="56" cy="34.2" r="1.6" fill={black} />
        <path d="M11 41.5 4 45 11 46Z" fill={green} />
        <rect x="16" y="42" width="9" height="11" rx="4" fill={green} />
        <rect x="37" y="42" width="9" height="11" rx="4" fill={green} />
        <path d="M9 44C9 28 19 18 30 18 41 18 50 28 50 44Z" fill={teal} />
        <path
          d="M24 28 30 24.5 36 28V35L30 38.5 24 35ZM30 18V24.5M36 28 45 25M24 28 15 25M36 35 44.5 44M24 35 15.5 44M30 38.5V44"
          fill={ground(7)}
          stroke={ground(7)}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </>
    ),
  },
  umbrella: {
    hue: 3,
    draw: (
      <>
        <path
          d="M32 34V52Q32 58 38 58 43.5 58 43.5 52.5"
          fill="none"
          stroke={ink}
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <rect x="30.4" y="4" width="3.2" height="7" rx="1.6" fill={ink} />
        <path
          d="M5 35C5 19 17 9 32 9S59 19 59 35Q52 28 45.5 35 39 28 32 35 25 28 18.5 35 12 28 5 35Z"
          fill={rust}
        />
        <path
          d="M32 9C24 15 19 24 18.5 35 25 28 32 35 32 35 32 35 39 28 45.5 35 45 24 40 15 32 9Z"
          fill={gold}
        />
      </>
    ),
  },
  apple: {
    hue: 5,
    draw: (
      <>
        <path
          d="M32 22C26 16 11 17 10.5 33 10 46 20 58.5 27 57.5 30 57 34 57 37 57.5 44 58.5 54 46 53.5 33 53 17 38 16 32 22Z"
          fill={berry}
        />
        <path
          d="M32 22C32 16 33.5 12 37 9.5"
          fill="none"
          stroke={ink}
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M37 15.5C41 8 49 7.5 53 10.5 50 17.5 42 19.5 37 15.5Z"
          fill={teal}
        />
        <path
          d="M18.5 30C17.5 36 19.5 42.5 23 46"
          fill="none"
          stroke={white}
          strokeWidth="3"
          strokeLinecap="round"
          opacity=".7"
        />
      </>
    ),
  },
  owl: {
    hue: 0,
    draw: (
      <>
        <path
          d="M15 21 12 9 24 15.5Q32 13 40 15.5L52 9 49 21Q53 29 52 39 50.5 57 32 58 13.5 57 12 39 11 29 15 21Z"
          fill={purple}
        />
        <circle cx="23.5" cy="28.5" r="9" fill={white} />
        <circle cx="40.5" cy="28.5" r="9" fill={white} />
        <circle cx="24.5" cy="28.5" r="4.2" fill={black} />
        <circle cx="39.5" cy="28.5" r="4.2" fill={black} />
        <path d="M32 33 28 38.5 32 43.5 36 38.5Z" fill={gold} />
        <path
          d="M21 46Q24.5 50 28 46 32 50 36 46 39.5 50 43 46"
          fill="none"
          stroke={white}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
  },
  boat: {
    hue: 4,
    draw: (
      <>
        <rect x="30.7" y="7" width="2.8" height="36" rx="1.4" fill={ink} />
        <path d="M36 9.5 53 38H36Z" fill={rust} />
        <path d="M28.2 17 13.5 38H28.2Z" fill={gold} />
        <path d="M8 42H56L49 54Q48 56 45 56H19Q16 56 15 54Z" fill={blue} />
        <path
          d="M12 60.5Q17 57 22 60.5T32 60.5 42 60.5 52 60.5"
          fill="none"
          stroke={cyan}
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </>
    ),
  },
  frog: {
    hue: 3,
    draw: (
      <>
        <circle cx="20" cy="22" r="9.5" fill={green} />
        <circle cx="44" cy="22" r="9.5" fill={green} />
        <path
          d="M8 38C8 28 18 24 32 24S56 28 56 38C56 50 45 56 32 56S8 50 8 38Z"
          fill={green}
        />
        <circle cx="20" cy="21" r="6" fill={white} />
        <circle cx="44" cy="21" r="6" fill={white} />
        <circle cx="20.5" cy="21.5" r="3" fill={black} />
        <circle cx="43.5" cy="21.5" r="3" fill={black} />
        <path
          d="M18 39Q32 52 46 39"
          fill="none"
          stroke={black}
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <circle cx="29" cy="33.5" r="1.3" fill={black} />
        <circle cx="35" cy="33.5" r="1.3" fill={black} />
      </>
    ),
  },
  sun: {
    hue: 2,
    draw: (
      <>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <rect
            key={angle}
            x="29"
            y="4"
            width="6"
            height="11"
            rx="3"
            fill={gold}
            transform={`rotate(${angle} 32 32)`}
          />
        ))}
        <circle cx="32" cy="32" r="14.5" fill={orange} />
      </>
    ),
  },
  whale: {
    hue: 0,
    draw: (
      <>
        <path
          d="M49 34C53 30 54 25 53 19 57 21 60.5 20 62.5 16.5 63.5 24 61 30 57 32.5 58 36 56.5 41 51 44Z"
          fill={blue}
        />
        <path
          d="M5 38C5 26 17 19 31 19 44 19 51 27 53.5 36 49 47 40 52.5 28 52.5 14 52.5 5 47 5 38Z"
          fill={blue}
        />
        <path d="M7 43C13 51 31 54.5 44 47 33 45 18 45 7 43Z" fill={white} />
        <circle cx="18" cy="33" r="2.7" fill={black} />
        <path
          d="M30 15V10M30 10C30 6.5 26.5 5 24 6.5M30 10C30 6.5 33.5 5 36 6.5"
          fill="none"
          stroke={cyan}
          strokeWidth="2.8"
          strokeLinecap="round"
        />
      </>
    ),
  },
  tree: {
    hue: 7,
    draw: (
      <>
        <rect x="27.5" y="38" width="9" height="21" rx="2.5" fill={bark} />
        <circle cx="32" cy="19" r="14" fill={pine} />
        <circle cx="19.5" cy="31" r="12" fill={pine} />
        <circle cx="44.5" cy="31" r="12" fill={pine} />
        <circle cx="32" cy="34" r="12" fill={pine} />
      </>
    ),
  },
  bee: {
    hue: 6,
    draw: (
      <>
        <ellipse
          cx="26"
          cy="18.5"
          rx="8.5"
          ry="12"
          fill={white}
          transform="rotate(-16 26 18.5)"
          opacity=".92"
        />
        <ellipse
          cx="41"
          cy="18.5"
          rx="8.5"
          ry="12"
          fill={white}
          transform="rotate(16 41 18.5)"
          opacity=".92"
        />
        <path
          d="M15 28.5Q10 21 6 21M21 26Q19 18 15 15.5"
          fill="none"
          stroke={black}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path d="M49 34.5 60 38 49 42Z" fill={black} />
        <ellipse cx="32" cy="38" rx="21" ry="15" fill={gold} />
        <path
          d="M26 23.8Q22.5 38 26 52.2L33.5 53Q30 38 33.5 23ZM41.5 25.3Q38 38 41.5 50.7L47 48Q44.5 38 47 28Z"
          fill={black}
        />
        <circle cx="18.5" cy="34.5" r="2.5" fill={black} />
      </>
    ),
  },
  kite: {
    hue: 4,
    draw: (
      <>
        <path
          d="M32 46C27 50 37 53 32 59"
          fill="none"
          stroke={ink}
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <path
          d="M25.5 52 32 54.5 25.5 57ZM38.5 52 32 54.5 38.5 57Z"
          fill={berry}
        />
        <path d="M32 4 32 25 11 25Z" fill={gold} />
        <path d="M32 4 53 25 32 25Z" fill={berry} />
        <path d="M11 25 32 25 32 47Z" fill={blue} />
        <path d="M53 25 32 25 32 47Z" fill={teal} />
      </>
    ),
  },
  rabbit: {
    hue: 5,
    draw: (
      <>
        <path d="M19.5 30C14 18 15 4 21.5 4 28 4 29 18 27.5 30Z" fill={grey} />
        <path d="M44.5 30C50 18 49 4 42.5 4 36 4 35 18 36.5 30Z" fill={grey} />
        <path
          d="M21.5 27C19 18 19.5 10 21.8 10 24 10 25 18 24.5 27Z"
          fill={berry}
        />
        <path
          d="M42.5 27C45 18 44.5 10 42.2 10 40 10 39 18 39.5 27Z"
          fill={berry}
        />
        <circle cx="32" cy="41" r="18.5" fill={grey} />
        <ellipse cx="32" cy="47.5" rx="9.5" ry="7.5" fill={white} />
        <circle cx="24.5" cy="37.5" r="2.8" fill={black} />
        <circle cx="39.5" cy="37.5" r="2.8" fill={black} />
        <path d="M29 43.5H35L32 47Z" fill={black} />
        <path
          d="M32 47V50M32 50Q29.5 53 27 51M32 50Q34.5 53 37 51"
          fill="none"
          stroke={black}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </>
    ),
  },
  rocket: {
    hue: 2,
    draw: (
      <>
        <path d="M26 44H38Q38.5 54 32 61 25.5 54 26 44Z" fill={gold} />
        <path d="M21 32 11 47 21 45ZM43 32 53 47 43 45Z" fill={berry} />
        <path d="M32 4C42 12 45 26 44 44H20C19 26 22 12 32 4Z" fill={teal} />
        <path
          d="M32 4C37 8 40.3 13.5 42 20H22C23.7 13.5 27 8 32 4Z"
          fill={berry}
        />
        <circle cx="32" cy="29" r="6.5" fill={white} />
        <circle cx="32" cy="29" r="3.8" fill={blue} />
      </>
    ),
  },
  fish: {
    hue: 4,
    draw: (
      <>
        <path d="M45 31 60 17Q57 32 60 47L45 33Z" fill={purple} />
        <path d="M30 19Q36 9 43 13L42 23Z" fill={purple} />
        <path d="M6 32C14 17 38 15 49 31 38 47 14 47 6 32Z" fill={cyan} />
        <circle cx="18" cy="28.5" r="5" fill={white} />
        <circle cx="17.5" cy="28.5" r="2.5" fill={black} />
        <path
          d="M27 21Q32 32 27 43M36 24Q40 32 36 40"
          fill="none"
          stroke={white}
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </>
    ),
  },
};

export const pictureNames: Record<SchoolPicture, string> = {
  fox: "Fox",
  moon: "Moon",
  turtle: "Turtle",
  umbrella: "Umbrella",
  apple: "Apple",
  owl: "Owl",
  boat: "Boat",
  frog: "Frog",
  sun: "Sun",
  whale: "Whale",
  tree: "Tree",
  bee: "Bee",
  kite: "Kite",
  rabbit: "Rabbit",
  rocket: "Rocket",
  fish: "Fish",
};

/** One picture. Decorative: whatever holds it says its name. */
export function Picture({ name }: { name: SchoolPicture }) {
  const { hue, draw } = art[name];
  return (
    <svg className={styles.picture} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="32" fill={ground(hue)} />
      <g transform="translate(32 32) scale(.86) translate(-32 -32)">{draw}</g>
    </svg>
  );
}
