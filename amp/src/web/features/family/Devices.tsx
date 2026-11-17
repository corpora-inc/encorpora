import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { formatJoinCode } from "../../../schools/contracts";
import { Button } from "../../ui/Button";
import { Menu, MenuItem } from "../../ui/Menu";
import { PrintButton } from "../../ui/PrintButton";
import { Sheet } from "../../ui/Sheet";
import { Toast } from "../../ui/Toast";
import { AppError } from "../../lib/AppError";
import { downloadPdf, paperFormat } from "../../lib/pdf-download";
import { useSession } from "../../lib/session";
import {
  presenceOptions,
  rosterOptions,
  useIssueCards,
  useResetPictures,
  useRevokeSessions,
  useRotateCode,
} from "../school/classes/api";
import { JoinWays } from "../school/join/JoinWays";
import { peopleOf } from "./redirects";
import type { FamilyPlace } from "./FamilyFrame";
import type { FamilyChild } from "./api";
import styles from "./Family.module.css";

const DAY = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

type Pending = {
  kind: "reset" | "revoke" | "card";
  person: string;
  name: string;
};

/** Picture recovery belongs with the child's settings as well as their cards. */
export function SignInPictures({
  place,
  child,
}: {
  place: FamilyPlace;
  child: FamilyChild;
}) {
  const own = place.own;
  const person = child.classes.find((entry) => entry.id === own?.id)?.personId;
  const reset = useResetPictures(place.session, {
    org: own?.org ?? place.family,
    class: own?.id ?? "",
  });
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  if (!child.capabilities.manageDevices || !own || !person) return null;
  const resetPictures = async () => {
    setMessage("");
    setFailed(false);
    try {
      await reset.mutateAsync(person);
      setMessage(`${child.name} can choose three new pictures at sign-in.`);
    } catch (error) {
      console.error("Sign-in pictures could not be reset", error);
      setFailed(true);
      setMessage(
        error instanceof AppError
          ? error.message
          : "The pictures couldn’t be reset. Try again.",
      );
    }
  };
  return (
    <div className={styles.setting} data-picture-sign-in="">
      <div className={styles.settingText}>
        <dt>Sign-in pictures</dt>
        <dd role={message ? (failed ? "alert" : "status") : undefined}>
          {message ||
            "Forgotten pictures or locked out? Choose new pictures at sign-in."}
        </dd>
      </div>
      <div className={styles.settingAction}>
        <Button
          variant="secondary"
          disabled={reset.isPending}
          aria-busy={reset.isPending || undefined}
          onClick={() => void resetPictures()}
        >
          Reset pictures
        </Button>
      </div>
    </div>
  );
}

/** What a failed device change says: a typed refusal says what to do (a
 * sign-in still being checked); anything else is the connection. */
const deviceFailure = (failure: unknown) =>
  failure instanceof AppError && failure.code
    ? failure.message
    : "That didn’t save. Check your connection and try again.";

/**
 * Sign-in cards as a PDF (the IA v2 spec, §3.5): making them is the one
 * click, and the PDF downloads. A card's link is kept only as a hash, so a
 * new card replaces the one before it; the line above says so when anyone
 * has one. For one child (`personIds` of one), or every child here.
 */
export function SignInCardsPrint({
  place,
  personIds,
  label,
  children,
  variant = "secondary",
}: {
  place: { org: string; class: string };
  personIds: string[];
  label: string;
  children: string;
  variant?: "primary" | "secondary";
}) {
  const session = useSession();
  const issue = useIssueCards(session, place);
  return (
    <PrintButton
      variant={variant}
      label={label}
      disabled={personIds.length === 0}
      download={async () => {
        const issued = await issue.mutateAsync({ personIds });
        await downloadPdf({
          path: `/school/classes/${encodeURIComponent(place.class)}/cards.pdf`,
          token: session.token,
          body: {
            format: paperFormat(),
            cards: issued.cards.map(({ personId, token }) => ({
              personId,
              token,
            })),
          },
          name: "amp-sign-in-cards.pdf",
        });
      }}
    >
      {children}
    </PrintButton>
  );
}

/** A new family code, asked for in place: the old code, its link and its QR
 * stop working, so one inline confirm says that first. */
function NewCode({
  place,
  locked,
}: {
  place: { org: string; class: string };
  locked: boolean;
}) {
  const session = useSession();
  const rotate = useRotateCode(session, place);
  const [asking, setAsking] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const replace = async () => {
    setError("");
    try {
      const { joinCode } = await rotate.mutateAsync();
      setAsking(false);
      setStatus(`The new family code is ${formatJoinCode(joinCode)}.`);
    } catch (failure) {
      console.error("A new family code could not be made", failure);
      setError(
        "The code wasn’t replaced, so the old one still works. Try again in a moment.",
      );
    }
  };
  return (
    <div className={styles.deviceRow} data-new-code="">
      <span className={styles.deviceName}>
        New code
        <small role={error ? "alert" : status ? "status" : undefined}>
          {error ||
            status ||
            (asking
              ? "The old code, its link and its QR code stop working."
              : locked
                ? "Sign-in is paused after many wrong pictures. A new code opens it."
                : "Replaces the code, its link and its QR code.")}
        </small>
      </span>
      <span className={styles.formActions}>
        {asking ? (
          <>
            <Button
              variant="primary"
              aria-busy={rotate.isPending || undefined}
              disabled={rotate.isPending}
              onClick={() => void replace()}
            >
              Replace code
            </Button>
            <Button
              variant="quiet"
              disabled={rotate.isPending}
              onClick={() => setAsking(false)}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button
            variant={locked ? "primary" : "secondary"}
            data-replace-code=""
            onClick={() => {
              setStatus("");
              setAsking(true);
            }}
          >
            New code
          </Button>
        )}
      </span>
    </div>
  );
}

/**
 * Their own devices (a sheet, `sheet: "devices"`): for children who practice
 * on a device of their own rather than the parent's. The QR and its link
 * first (JoinWays); under Other ways, the family code to type, a new code,
 * and sign-in cards (a PDF) with, per child, a new card, new pictures or
 * signing out everywhere, each confirmed in its own row. Only the family's
 * own children, by the roster people of its own class.
 */
export function DevicesSheet({
  place,
  classId,
  open,
  onOpenChange,
}: {
  place: FamilyPlace;
  classId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { session, family, data } = place;
  // The class's own org: a family's id need not be it.
  const where = { org: place.own?.org ?? family, class: classId };
  const presence = useQuery({
    ...presenceOptions(session, where),
    enabled: open,
  });
  const roster = useQuery({ ...rosterOptions(session, where), enabled: open });
  const reset = useResetPictures(session, where);
  const revoke = useRevokeSessions(session, where);
  const issue = useIssueCards(session, where);
  const [pending, setPending] = useState<Pending | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  // The family's own children, by the person each is in its class.
  const people = peopleOf(data?.children ?? [], classId);
  const rows = (roster.data?.students ?? []).filter((row) =>
    people.has(row.id),
  );
  const code = presence.data?.class.joinCode ?? null;
  // With other families' children in the class, the code is the tutoring
  // group's, and changes there.
  const shared = !!data?.teachingPlace;
  const manage = !shared && (presence.data?.canManage ?? false);
  const locked = !!presence.data?.class.joinLockedUntil;
  const busy = reset.isPending || revoke.isPending || issue.isPending;
  const confirm = async () => {
    if (!pending) return;
    setError("");
    try {
      if (pending.kind === "reset") {
        await reset.mutateAsync(pending.person);
        setStatus(`${pending.name} picks new pictures at the next sign-in.`);
      } else if (pending.kind === "revoke") {
        await revoke.mutateAsync(pending.person);
        setStatus(`${pending.name} is signed out on every device.`);
      } else {
        const issued = await issue.mutateAsync({ personIds: [pending.person] });
        await downloadPdf({
          path: `/school/classes/${encodeURIComponent(where.class)}/cards.pdf`,
          token: session.token,
          body: {
            format: paperFormat(),
            cards: issued.cards.map(({ personId, token }) => ({
              personId,
              token,
            })),
          },
          name: "amp-sign-in-card.pdf",
        });
        setStatus(`${pending.name}’s new card is downloading.`);
      }
      setPending(null);
    } catch (failure) {
      console.error("A device change didn’t save", failure);
      setError(deviceFailure(failure));
    }
  };
  const confirmText = (kind: Pending["kind"]) =>
    kind === "reset"
      ? "They choose three new pictures the next time they sign in with the code."
      : kind === "revoke"
        ? "Every device they’re signed in on returns to sign-in. Their work stays."
        : "Their card now stops working.";
  const confirmLabel = (kind: Pending["kind"]) =>
    kind === "reset"
      ? "Give new pictures"
      : kind === "revoke"
        ? "Sign out everywhere"
        : "Download a new card";
  const holding = rows.some((row) => row.cardIssuedAt);
  return (
    <>
      <Sheet
        open={open}
        onOpenChange={onOpenChange}
        title="Their own devices"
        tall
      >
        <div className={styles.devices} data-devices-sheet="">
          {presence.isPending || roster.isPending || !family ? (
            <div
              className="amp-skeleton"
              aria-busy="true"
              style={{ minHeight: 320 }}
            />
          ) : !code ? (
            <p className={styles.footnote}>
              Their own devices didn’t load. Close this and try again.
            </p>
          ) : (
            <JoinWays
              code={code}
              words={place.words}
              notice={
                locked && (
                  <p className={styles.footnote} role="status">
                    Sign-in is paused after many wrong pictures. A new code
                    opens it.
                  </p>
                )
              }
              cards={
                <section
                  aria-labelledby="devices-cards"
                  className={styles.cardsWay}
                >
                  {manage && <NewCode place={where} locked={locked} />}
                  <div className={styles.sectionHead}>
                    <h3 id="devices-cards">Sign-in cards</h3>
                    {roster.data?.canManage && (
                      <SignInCardsPrint
                        place={where}
                        personIds={rows.map((row) => row.id)}
                        label="Download sign-in cards for every child, PDF"
                      >
                        Download sign-in cards
                      </SignInCardsPrint>
                    )}
                  </div>
                  <p className={styles.footnote}>
                    A card signs a child in with one scan, with no code and no
                    pictures.
                    {holding && " A new card replaces the one before it."}
                  </p>
                  <ul className={styles.deviceRows}>
                    {rows.map((row) => (
                      <li key={row.id} className={styles.deviceRow}>
                        <span className={styles.deviceName}>
                          {row.name}
                          <small
                            role={
                              pending?.person === row.id && error
                                ? "alert"
                                : undefined
                            }
                          >
                            {pending?.person === row.id
                              ? error || confirmText(pending.kind)
                              : [
                                  row.cardIssuedAt
                                    ? `Card printed ${DAY.format(new Date(row.cardIssuedAt))}`
                                    : "No card",
                                  row.picturesSet
                                    ? "Pictures set"
                                    : "No pictures yet",
                                ].join(" · ")}
                          </small>
                        </span>
                        {pending?.person === row.id ? (
                          <span className={styles.formActions}>
                            <Button
                              variant="primary"
                              aria-busy={busy || undefined}
                              disabled={busy}
                              onClick={() => void confirm()}
                            >
                              {confirmLabel(pending.kind)}
                            </Button>
                            <Button
                              variant="quiet"
                              disabled={busy}
                              onClick={() => {
                                setPending(null);
                                setError("");
                              }}
                            >
                              Cancel
                            </Button>
                          </span>
                        ) : (
                          roster.data?.canManage && (
                            <Menu
                              label="Manage"
                              aria-label={`Manage ${row.name}`}
                            >
                              <MenuItem
                                onSelect={() =>
                                  row.cardIssuedAt
                                    ? setPending({
                                        kind: "card",
                                        person: row.id,
                                        name: row.name,
                                      })
                                    : void confirmCard(row.id, row.name)
                                }
                              >
                                {row.cardIssuedAt
                                  ? "Download a new card"
                                  : "Download a card"}
                              </MenuItem>
                              {row.picturesSet && (
                                <MenuItem
                                  onSelect={() =>
                                    setPending({
                                      kind: "reset",
                                      person: row.id,
                                      name: row.name,
                                    })
                                  }
                                >
                                  New pictures
                                </MenuItem>
                              )}
                              {row.activeSessions > 0 && (
                                <MenuItem
                                  onSelect={() =>
                                    setPending({
                                      kind: "revoke",
                                      person: row.id,
                                      name: row.name,
                                    })
                                  }
                                >
                                  Sign out everywhere
                                </MenuItem>
                              )}
                            </Menu>
                          )
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              }
            />
          )}
        </div>
      </Sheet>
      <Toast message={status} onDismiss={() => setStatus("")} />
    </>
  );
  /** A first card replaces nothing, so it downloads at once. */
  async function confirmCard(person: string, name: string) {
    setError("");
    try {
      const issued = await issue.mutateAsync({ personIds: [person] });
      await downloadPdf({
        path: `/school/classes/${encodeURIComponent(where.class)}/cards.pdf`,
        token: session.token,
        body: {
          format: paperFormat(),
          cards: issued.cards.map(({ personId, token }) => ({
            personId,
            token,
          })),
        },
        name: "amp-sign-in-card.pdf",
      });
      setStatus(`${name}’s card is downloading.`);
    } catch (failure) {
      console.error("A sign-in card wasn’t made", failure);
      setStatus("");
      setError(deviceFailure(failure));
      setPending({ kind: "card", person, name });
    }
  }
}
