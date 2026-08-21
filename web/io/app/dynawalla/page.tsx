import Link from "next/link";
import type { Metadata } from "next";

import "./dynawalla.css";
import { PackArt } from "@/components/dynawalla/PackArt";
import { StoreButtons } from "@/components/dynawalla/StoreButtons";
import {
  DYNAWALLA_GAMES,
  DOMAIN_NAMES,
  domainsOf,
  gameCountWord,
  gameCountWordTitle,
} from "@/lib/dynawallaCatalog";
import { withBasePath } from "@/lib/basePath";

export const metadata: Metadata = {
  title: "Dynawalla — Math is the mechanic",
  description:
    `${gameCountWordTitle()} arcade games in which the mathematics is the mechanic, not a gate in front of the fun. Every game adapts to the player. No ads, no tracking, no account.`,
  openGraph: {
    title: "Dynawalla — Math is the mechanic",
    description:
      `${gameCountWordTitle()} arcade games in which the mathematics is the mechanic. Every game adapts to the player. No ads, no tracking, no account.`,
    images: [
      {
        url: "https://encorpora.io/dynawalla/shots/catalog.webp",
        alt: "The Dynawalla catalogue",
      },
    ],
  },
};

/** The screenshots along the top, in the order they read best. */
const SHOTS = [
  { file: "catalog.webp", alt: "The Dynawalla catalogue of games" },
  { file: "serpent.webp", alt: "SERPENT — a subtraction shown as 5 − 4" },
  { file: "volta.webp", alt: "VOLTA — choosing the correct lane at speed" },
  { file: "forge.webp", alt: "FORGE — an addition feeding a smelting chain" },
  { file: "siege.webp", alt: "SIEGE — answering to power the defence" },
  { file: "abyssal-bloom.webp", alt: "ABYSSAL BLOOM — joining numbers on a reef" },
  { file: "monument.webp", alt: "MONUMENT — stacking a slab on a correct answer" },
  { file: "arena.webp", alt: "ARENA — growing by eating smaller numbers" },
];

const PRINCIPLES = [
  {
    title: "The maths is the mechanic",
    body: "Not a worksheet with a cartoon on it, and not a quiz between rounds. In FORGE, arithmetic is the throttle on a smelting chain. In COUNTERPOISE, a brass balance physically is the equals sign. Doing the arithmetic is how the game is played.",
  },
  {
    title: "Every player gets their own level",
    body: "The difficulty follows the player. Someone fluent is given harder work; someone struggling is quietly given easier work until they are succeeding again. It is never announced, and there is no level to pick.",
  },
  {
    title: "Speed is rewarded, never enforced",
    body: "Answering quickly earns more. Answering slowly costs nothing — most games put no clock on the thinking at all. A countdown that kills you and a bonus that accrues are the same signal with opposite valence, and only one of them is worth building.",
  },
  {
    title: "A wrong answer finishes on screen",
    body: "The sum is completed and held there for as long as you want to look at it. No red cross, no buzzer. Getting it wrong is the moment the game has something to teach, so nothing is hurried past.",
  },
];

export default function DynawallaPage() {
  return (
    <div className="dw-page min-h-screen">
      <div className="px-4 sm:px-6 py-12 sm:py-20">
        <div className="max-w-6xl mx-auto">
          {/* Breadcrumb */}
          <nav className="mb-12 text-sm">
            <Link
              href="/"
              className="text-[#c9b4ff]/60 hover:text-[#e8deff] transition-colors"
            >
              Encorpora
            </Link>
            <span className="mx-2 text-[#c9b4ff]/30">/</span>
            <span className="text-[#e8deff]">Dynawalla</span>
          </nav>

          {/* Hero */}
          <header className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              {/* The wordmark is letter-spaced, which makes it much wider than
                  its font size suggests: at 36px and 0.18em it overruns a
                  390px viewport. Both the size and the tracking step down on
                  small screens. */}
              <div className="flex items-center gap-4 sm:gap-5">
                <img
                  src={withBasePath("/logos/dynawalla-logo.webp")}
                  alt=""
                  aria-hidden="true"
                  className="h-14 w-14 sm:h-20 sm:w-20 shrink-0 rounded-2xl"
                />
                <div className="min-w-0">
                  <h1 className="text-[1.75rem] sm:text-5xl lg:text-6xl font-bold tracking-[0.08em] sm:tracking-[0.16em] text-[#e8deff]">
                    DYNAWALLA
                  </h1>
                  <p className="mt-2 text-base sm:text-xl text-[#e0b15a]">
                    Math is the mechanic
                  </p>
                </div>
              </div>

              <p className="mt-8 max-w-2xl text-lg leading-relaxed text-[#c9b4ff]">
                {gameCountWordTitle()} arcade games in which the mathematics is the
                game rather than a toll you pay to play it. Every one of them
                meets you where you are and climbs for as long as you do.
              </p>

              <p className="mt-4 max-w-2xl leading-relaxed text-[#c9b4ff]/70">
                The collection concentrates on the ground covered in grades 1 to
                5 — addition and subtraction in depth, regrouping and across
                zero, times tables, long multiplication, division, fractions and
                the meaning of equality. That is where it concentrates, not
                where it stops.
              </p>

              <StoreButtons className="mt-10" />

              <p className="mt-5 text-sm text-[#c9b4ff]/50">
                All {gameCountWord()} games install with the app and play
                without a network connection.
              </p>
            </div>

            <div className="hidden lg:block">
              <img
                src={withBasePath("/dynawalla/shots/catalog.webp")}
                alt="The Dynawalla catalogue on iPhone"
                className="w-[300px] rounded-[2rem] ring-1 ring-[#c9b4ff]/15 shadow-2xl"
              />
            </div>
          </header>

          <div className="dw-rule my-16 sm:my-24" />

          {/* Screenshots */}
          <section aria-labelledby="shots-heading">
            <h2 id="shots-heading" className="sr-only">
              Screenshots
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
              {SHOTS.map((shot) => (
                <img
                  key={shot.file}
                  src={withBasePath(`/dynawalla/shots/${shot.file}`)}
                  alt={shot.alt}
                  loading="lazy"
                  className="w-[210px] shrink-0 rounded-2xl ring-1 ring-[#c9b4ff]/15"
                />
              ))}
            </div>
          </section>

          <div className="dw-rule my-16 sm:my-24" />

          {/* Principles */}
          <section aria-labelledby="how-heading">
            <h2
              id="how-heading"
              className="text-3xl sm:text-4xl font-bold text-[#e8deff]"
            >
              How it works
            </h2>
            <div className="mt-10 grid gap-8 sm:grid-cols-2">
              {PRINCIPLES.map((p) => (
                <div key={p.title}>
                  <h3 className="text-xl font-semibold text-[#e8deff]">
                    {p.title}
                  </h3>
                  <p className="mt-3 leading-relaxed text-[#c9b4ff]/75">
                    {p.body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <div className="dw-rule my-16 sm:my-24" />

          {/* The games */}
          <section aria-labelledby="games-heading">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <h2
                id="games-heading"
                className="text-3xl sm:text-4xl font-bold text-[#e8deff]"
              >
                {gameCountWordTitle()} games
              </h2>
              <p className="text-[#c9b4ff]/60">More arriving.</p>
            </div>

            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {DYNAWALLA_GAMES.map((game) => {
                const domains = domainsOf(game.skills);
                return (
                  <li key={game.id}>
                    <Link
                      href={`/dynawalla/${game.slug}/`}
                      className="dw-card group block h-full overflow-hidden rounded-2xl ring-1 ring-[#c9b4ff]/12 hover:ring-[#c9b4ff]/35 transition-colors"
                    >
                      <div className="overflow-hidden">
                        <PackArt packId={game.id} className="dw-card-art" />
                      </div>
                      <div className="p-5 bg-[#0b0618]">
                        <h3 className="text-lg font-semibold tracking-wider text-[#e8deff]">
                          {game.name}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-[#c9b4ff]/70 line-clamp-3">
                          {game.description}
                        </p>
                        {domains.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {domains.map((d) => (
                              <span
                                key={d}
                                className="rounded-md px-2 py-1 text-xs text-[#c9b4ff]/80 ring-1 ring-inset ring-[#c9b4ff]/20"
                              >
                                {DOMAIN_NAMES[d]}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="dw-rule my-16 sm:my-24" />

          {/* What is not in it */}
          <section className="max-w-2xl">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#e8deff]">
              What is not in it
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-[#c9b4ff]/75">
              No advertising. No third-party analytics. No tracking. No account
              and no sign-in. Nothing to buy inside a game.
            </p>
            <p className="mt-6 text-[#c9b4ff]/60">
              Dynawalla is made by Corpora Inc.
            </p>
            <StoreButtons className="mt-10" />
          </section>
        </div>
      </div>
    </div>
  );
}
