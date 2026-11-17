import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { IssuedCards } from "../../../../schools/contracts";
import { Button } from "../../../ui/Button";
import { Page } from "../../../ui/Page";
import { PageHeader } from "../../../ui/PageHeader";
import { PrintButton } from "../../../ui/PrintButton";
import { Toast } from "../../../ui/Toast";
import { downloadPdf, paperFormat } from "../../../lib/pdf-download";
import { EmptyState } from "../../../ui/EmptyState";
import { LoadingScreen } from "../../../ui/LoadingScreen";
import { QrCode, loadQrEncoder } from "../../../ui/QrCode";
import { WaveMark } from "../../../ui/NavigationSheet";
// The reset for the legacy global element rules, under `data-dense`.
import "../SchoolFrame.module.css";
import { rosterOptions, useIssueCards, useStaffSession } from "./api";
import { useClassHost, type ClassHost } from "./host";
import { useClassView } from "./teacher-shared";
import styles from "./Cards.module.css";
import { ClosedSignIn, useClassAccess } from "../pilots/ClassAccess";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
export function CardsScreen({ host: given }: { host?: ClassHost } = {}) {
  const host = useClassHost(given);
  const place = host.place;
  const words = host.words;
  // One student's card, chosen where the cards were opened (the roster).
  const [raw] = useClassView();
  const student =
    typeof raw.student === "string" && UUID.test(raw.student)
      ? raw.student
      : undefined;
  const session = useStaffSession();
  const roster = useQuery(rosterOptions(session, place));
  const access = useClassAccess(place);
  // Cards made while practice ran go when it closes, on a page left open:
  // they would only lead to a closed class (CP-3 r3 H1).
  // Only when the server says so: while a recheck is asked, they wait.
  const closedNow = access.practice !== "open";
  useEffect(() => {
    if (closedNow) setIssued(null);
  }, [closedNow]);
  const issue = useIssueCards(session, place);
  const [issued, setIssued] = useState<IssuedCards | null>(null);
  async function make(input: { personIds?: string[]; missingOnly?: boolean }) {
    try {
      const cards = await issue.mutateAsync(input);
      await loadQrEncoder();
      setIssued(cards);
    } catch (failure) {
      // The toast says what happened; the log keeps it.
      console.error("The sign-in cards weren’t made", failure);
    }
  }
  if (roster.isError)
    return (
      <Page className={styles.page} data-dense>
        <EmptyState
          title="These cards didn’t load"
          action={
            <Button variant="secondary" onClick={() => void roster.refetch()}>
              Try again
            </Button>
          }
        >
          {roster.error.message}
        </EmptyState>
      </Page>
    );
  if (!roster.data || access.pending) return <LoadingScreen />;
  // A card leads nowhere until practice runs: never print one before.
  if (access.closed || access.unavailable)
    return (
      <Page className={styles.page} data-dense>
        <ClosedSignIn place={place} />
      </Page>
    );
  const { class: info, canManage } = roster.data;
  const students = roster.data.students.filter(
    (entry) => !host.keep || host.keep(entry.id),
  );
  const chosen = student ? students.filter((s) => s.id === student) : students;
  if (!canManage || !chosen.length)
    return (
      <Page className={styles.page} data-dense>
        <EmptyState title="There are no cards to make here">
          {canManage
            ? `This ${words.learner} isn’t here anymore.`
            : `A teacher of this class can print its sign-in cards.`}
        </EmptyState>
      </Page>
    );
  if (issued)
    return (
      <Page className={styles.page} data-dense>
        <PageHeader
          title={
            issued.cards.length === 1
              ? "1 card ready"
              : `${issued.cards.length} cards ready`
          }
          subtitle="Print these now. They can’t be shown again, and any new card replaces the one before it."
          actions={
            <PrintButton
              variant="primary"
              disabled={!session}
              download={() =>
                downloadPdf({
                  path: `/school/classes/${encodeURIComponent(place.class)}/cards.pdf`,
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
          }
        />
        <Sheets issued={issued} />
      </Page>
    );
  const holding = chosen.filter((s) => s.cardIssuedAt).length;
  const missing = chosen.length - holding;
  // A host that shows only some of the class names them; the class itself
  // asks for all of them.
  const personIds = student
    ? [student]
    : host.keep
      ? chosen.map((entry) => entry.id)
      : undefined;
  const missingIds = host.keep
    ? chosen.filter((entry) => !entry.cardIssuedAt).map((entry) => entry.id)
    : undefined;
  return (
    <Page className={styles.page} data-dense>
      <PageHeader
        title={
          student
            ? `Print a card for ${chosen[0]!.name}`
            : host.keep
              ? `Print sign-in cards for ${words.group}`
              : `Print cards for ${info.name}`
        }
        subtitle={
          student
            ? `The card signs this ${words.learner} in with no code and no pictures.`
            : `Each card signs one ${words.learner} in with no code and no pictures.`
        }
      />
      <section className={styles.prepare} aria-label="Make cards">
        {holding > 0 && (
          <p className={styles.warning}>
            {student
              ? `The card this ${words.learner} has now stops working.`
              : `${holding === 1 ? `1 ${words.learner} has` : `${holding} ${words.learners} have`} a card already. A new card stops the old one working.`}
          </p>
        )}
        <div className={styles.choices}>
          {!student && holding > 0 && missing > 0 && (
            <Button
              variant="primary"
              aria-busy={issue.isPending}
              disabled={issue.isPending}
              onClick={() =>
                void make(
                  missingIds
                    ? { personIds: missingIds }
                    : { missingOnly: true },
                )
              }
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
        </div>
      </section>
      {/* What went wrong overlays the page, so nothing moves. */}
      <Toast
        message={issue.error?.message ?? ""}
        onDismiss={() => issue.reset()}
      />
    </Page>
  );
}
