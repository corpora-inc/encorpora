import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import "../dynawalla.css";
import { PackArt } from "@/components/dynawalla/PackArt";
import { StoreButtons } from "@/components/dynawalla/StoreButtons";
import {
  DYNAWALLA_GAMES,
  DOMAIN_NAMES,
  domainsOf,
  domainOfSkill,
  gameCountWord,
  getGame,
  shotFor,
  skillLabel,
  type DomainId,
} from "@/lib/dynawallaCatalog";
import { withBasePath } from "@/lib/basePath";

interface PageProps {
  params: Promise<{ gameSlug: string }>;
}

export function generateStaticParams() {
  return DYNAWALLA_GAMES.map((g) => ({ gameSlug: g.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { gameSlug } = await params;
  const game = getGame(gameSlug);
  if (!game) return {};
  return {
    title: `${game.name} — Dynawalla`,
    description: game.description,
    openGraph: {
      title: `${game.name} — Dynawalla`,
      description: game.description,
    },
  };
}

/** The skills this game covers, bucketed by subject and in curriculum order. */
function skillsByDomain(
  skills: readonly string[],
): { domain: DomainId; skills: string[] }[] {
  const buckets = new Map<DomainId, string[]>();
  for (const skill of skills) {
    const domain = domainOfSkill(skill);
    if (domain === null) continue;
    const list = buckets.get(domain) ?? [];
    list.push(skill);
    buckets.set(domain, list);
  }
  return domainsOf(skills).map((domain) => ({
    domain,
    skills: buckets.get(domain) ?? [],
  }));
}

export default async function GamePage({ params }: PageProps) {
  const { gameSlug } = await params;
  const game = getGame(gameSlug);
  if (!game) notFound();

  const index = DYNAWALLA_GAMES.findIndex((g) => g.slug === game.slug);
  const previous =
    DYNAWALLA_GAMES[(index - 1 + DYNAWALLA_GAMES.length) % DYNAWALLA_GAMES.length];
  const next = DYNAWALLA_GAMES[(index + 1) % DYNAWALLA_GAMES.length];
  const buckets = skillsByDomain(game.skills);
  const shot = shotFor(game.slug);

  return (
    <div className="dw-page min-h-screen">
      <div className="px-4 sm:px-6 py-12 sm:py-20">
        <div className="max-w-5xl mx-auto">
          {/* Breadcrumb */}
          <nav className="mb-12 text-sm">
            <Link
              href="/"
              className="text-[#c9b4ff]/60 hover:text-[#e8deff] transition-colors"
            >
              Encorpora
            </Link>
            <span className="mx-2 text-[#c9b4ff]/30">/</span>
            <Link
              href="/dynawalla/"
              className="text-[#c9b4ff]/60 hover:text-[#e8deff] transition-colors"
            >
              Dynawalla
            </Link>
            <span className="mx-2 text-[#c9b4ff]/30">/</span>
            <span className="text-[#e8deff]">{game.name}</span>
          </nav>

          {/* Art, words, and — where one exists — the game actually running.
              Three columns rather than two so the screenshot sits beside the
              description instead of leaving a column-high hole under the art. */}
          <div
            className={[
              "grid gap-10 lg:gap-12 items-start",
              shot
                ? "lg:grid-cols-[280px_minmax(0,1fr)_240px]"
                : "lg:grid-cols-[320px_minmax(0,1fr)]",
            ].join(" ")}
          >
            <div className="overflow-hidden rounded-2xl ring-1 ring-[#c9b4ff]/15">
              <PackArt packId={game.id} />
            </div>

            {/* The game */}
            <div className="order-last lg:order-none">
              {/* Names run to twenty-two characters (THE COIL OF NINETY-SIX)
                  and the tracking widens them further, so both step down on
                  small screens. */}
              <h1 className="text-3xl sm:text-5xl font-bold tracking-[0.06em] sm:tracking-[0.12em] text-[#e8deff]">
                {game.name}
              </h1>

              <p className="mt-6 text-lg leading-relaxed text-[#c9b4ff]">
                {game.description}
              </p>

              {buckets.length > 0 && (
                <div className="mt-8 flex flex-wrap gap-2">
                  {buckets.map(({ domain }) => (
                    <span
                      key={domain}
                      className="rounded-md px-3 py-1.5 text-sm text-[#c9b4ff]/85 ring-1 ring-inset ring-[#c9b4ff]/25"
                    >
                      {DOMAIN_NAMES[domain]}
                    </span>
                  ))}
                </div>
              )}

              {game.minAge !== null && (
                <p className="mt-6 text-sm text-[#c9b4ff]/50">
                  The pack suggests age {game.minAge} and up. The difficulty
                  itself follows the player, not the age.
                </p>
              )}

              <StoreButtons className="mt-10" />
            </div>

            {shot && (
              <img
                src={withBasePath(shot)}
                alt={`${game.name} running on iPhone`}
                className="w-full max-w-[240px] rounded-2xl ring-1 ring-[#c9b4ff]/15"
              />
            )}
          </div>

          {buckets.length > 0 && (
            <>
              <div className="dw-rule my-16" />
              <section aria-labelledby="covers-heading">
                <h2
                  id="covers-heading"
                  className="text-2xl sm:text-3xl font-bold text-[#e8deff]"
                >
                  What it covers
                </h2>
                <p className="mt-3 text-[#c9b4ff]/60">
                  {game.name} draws its questions from these parts of the
                  curriculum. Which of them a player sees, and how hard the
                  questions are, follows the player.
                </p>

                <div className="mt-8 grid gap-8 sm:grid-cols-2">
                  {buckets.map(({ domain, skills }) => (
                    <div key={domain}>
                      <h3 className="text-sm uppercase tracking-widest text-[#e0b15a]">
                        {DOMAIN_NAMES[domain]}
                      </h3>
                      <ul className="mt-3 space-y-1.5">
                        {skills.map((skill) => (
                          <li key={skill} className="text-[#c9b4ff]/80">
                            {skillLabel(skill)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          <div className="dw-rule my-16" />

          {/* Neighbours */}
          <nav
            aria-label="Other games"
            className="grid gap-4 sm:grid-cols-2"
          >
            <Link
              href={`/dynawalla/${previous.slug}/`}
              className="group rounded-xl p-5 ring-1 ring-[#c9b4ff]/12 hover:ring-[#c9b4ff]/35 transition-colors"
            >
              <span className="text-xs uppercase tracking-widest text-[#c9b4ff]/50">
                Previous
              </span>
              <span className="mt-2 block text-lg font-semibold tracking-wider text-[#e8deff]">
                {previous.name}
              </span>
            </Link>
            <Link
              href={`/dynawalla/${next.slug}/`}
              className="group rounded-xl p-5 ring-1 ring-[#c9b4ff]/12 hover:ring-[#c9b4ff]/35 transition-colors sm:text-right"
            >
              <span className="text-xs uppercase tracking-widest text-[#c9b4ff]/50">
                Next
              </span>
              <span className="mt-2 block text-lg font-semibold tracking-wider text-[#e8deff]">
                {next.name}
              </span>
            </Link>
          </nav>

          <div className="mt-12 text-center">
            <Link
              href="/dynawalla/"
              className="text-[#c9b4ff]/70 hover:text-[#e8deff] transition-colors"
            >
              All {gameCountWord()} games
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
