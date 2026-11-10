import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import type { IssuedCards } from "../../../../schools/contracts";
import { Button, buttonClass } from "../../../ui/Button";
import { PrintButton } from "../../../ui/PrintButton";
import { downloadPdf, paperFormat } from "../../../lib/pdf-download";
import { EmptyState } from "../../../ui/EmptyState";
import { LoadingScreen } from "../../../ui/LoadingScreen";
import { QrCode, loadQrEncoder } from "../../../ui/QrCode";
import { WaveMark } from "../../../ui/NavigationSheet";
// The reset for the legacy global element rules, under `data-dense`.
import "../SchoolFrame.module.css";
import { rosterOptions, useIssueCards, useStaffSession } from "./api";
import styles from "./Cards.module.css";

const PER_PAGE = 8;
function pages<T>(items: readonly T[]) {
  const all: T[][] = [];
  for (let at = 0; at < items.length; at += PER_PAGE)
    all.push(items.slice(at, at + PER_PAGE));
  return all;
}

function Sheets({ issued }: { issued: IssuedCards }) {
  return (
    <div className={styles.sheets}>
      {pages(issued.cards).map((page, index) => (
        <section
          key={index}
          className={styles.sheet}
          aria-label={`Page ${index + 1}`}
        >
          <div className={styles.grid}>
            {page.map((card) => (
              <article key={card.personId} className={styles.card}>
                <div className={styles.cardText}>
                  <span className={styles.cardBrand}>
                    <WaveMark />
                    <span>AMP</span>
                  </span>
                  <h2>{card.name}</h2>
                  <p>{issued.class.name}</p>
                  <p className={styles.how}>
                    Point a camera at the square to start math.
                  </p>
                </div>
                <QrCode
                  className={styles.qr}
                  value={`${location.origin}/c#${card.token}`}
                  label={`Sign-in code for ${card.name}`}
                />
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** `.../cards`: sign-in cards to print, 8 to a letter page, or one student's.
 * Opening this changes nothing. Only a hash of a card's link is kept, so making
 * cards is a choice with a stated cost, and leaving this page ends them. */
export function CardsScreen() {
  const params = useParams({ from: "/school/$org/classes/$class/cards" });
  const { student } = useSearch({ from: "/school/$org/classes/$class/cards" });
  const place = { org: params.org, class: params.class };
  const session = useStaffSession();
  const roster = useQuery(rosterOptions(session, place));
  const issue = useIssueCards(session, place);
  const [issued, setIssued] = useState<IssuedCards | null>(null);
  const back = (
    <Link
      to="/school/$org/classes/$class/roster"
      params={params}
      className={buttonClass("secondary")}
    >
      Back to roster
    </Link>
  );
  async function make(input: { personIds?: string[]; missingOnly?: boolean }) {
    const cards = await issue.mutateAsync(input);
    await loadQrEncoder();
    setIssued(cards);
  }
  if (roster.isError)
    return (
      <main className={styles.center} data-dense>
        <EmptyState title="These cards didn’t load" action={back}>
          {roster.error.message}
        </EmptyState>
      </main>
    );
  if (!roster.data) return <LoadingScreen />;
  const { class: info, students, canManage } = roster.data;
  const chosen = student ? students.filter((s) => s.id === student) : students;
  if (!canManage || !chosen.length)
    return (
      <main className={styles.center} data-dense>
        <EmptyState title="There are no cards to make here" action={back}>
          {canManage
            ? "This student isn’t in this class anymore."
            : "A teacher of this class can print its sign-in cards."}
        </EmptyState>
      </main>
    );
  if (issued)
    return (
      <main className={styles.page} data-dense>
        <header className={styles.toolbar}>
          <div className={styles.toolbarText}>
            <h1>
              {issued.cards.length === 1
                ? "1 card ready"
                : `${issued.cards.length} cards ready`}
            </h1>
            <p>
              Print these now. They can’t be shown again, and any new card
              replaces the one before it.
            </p>
          </div>
          <div className={styles.toolbarActions}>
            <PrintButton
              variant="primary"
              disabled={!session}
              download={() =>
                downloadPdf({
                  path: `/school/classes/${encodeURIComponent(params.class)}/cards.pdf`,
                  token: session!.token,
                  body: {
                    format: paperFormat(),
                    cards: issued.cards.map(({ personId, token }) => ({
                      personId,
                      token,
                    })),
                  },
                  name: "amp-sign-in-cards.pdf",
                })
              }
            >
              Print
            </PrintButton>
            {back}
          </div>
        </header>
        <Sheets issued={issued} />
      </main>
    );
  const holding = chosen.filter((s) => s.cardIssuedAt).length;
  const missing = chosen.length - holding;
  const personIds = student ? [student] : undefined;
  return (
    <main className={styles.center} data-dense>
      <section className={styles.prepare}>
        <h1>
          {student
            ? `Print a card for ${chosen[0]!.name}`
            : `Print cards for ${info.name}`}
        </h1>
        <p>
          {student
            ? "One card opens AMP for this student with no code and no pictures."
            : `${PER_PAGE} cards fit on a letter page. Each one opens AMP for one student with no code and no pictures.`}
        </p>
        {holding > 0 && (
          <p className={styles.warning}>
            {student
              ? "The card this student has now stops working."
              : `${holding === 1 ? "1 student has" : `${holding} students have`} a card already. A new card replaces it, and the old one stops working.`}
          </p>
        )}
        {issue.isError && (
          <p className={styles.problem} role="alert">
            {issue.error.message}
          </p>
        )}
        <div className={styles.choices}>
          {!student && holding > 0 && missing > 0 && (
            <Button
              variant="primary"
              aria-busy={issue.isPending}
              disabled={issue.isPending}
              onClick={() => void make({ missingOnly: true })}
            >
              {missing === 1
                ? "Make the 1 missing card"
                : `Make the ${missing} missing cards`}
            </Button>
          )}
          <Button
            variant={
              !student && holding > 0 && missing > 0 ? "secondary" : "primary"
            }
            aria-busy={issue.isPending}
            disabled={issue.isPending}
            onClick={() => void make({ personIds })}
          >
            {student
              ? "Make the card"
              : holding > 0
                ? `Make ${chosen.length} new cards`
                : chosen.length === 1
                  ? "Make the card"
                  : `Make ${chosen.length} cards`}
          </Button>
          {back}
        </div>
      </section>
    </main>
  );
}
