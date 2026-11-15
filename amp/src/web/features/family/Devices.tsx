import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button, buttonClass } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { Menu, MenuItem } from "../../ui/Menu";
import { Sheet } from "../../ui/Sheet";
import { Toast } from "../../ui/Toast";
import { AppError } from "../../lib/AppError";
import {
  presenceOptions,
  rosterOptions,
  useResetPictures,
  useRevokeSessions,
} from "../school/classes/api";
import { JoinWays } from "../school/join/JoinWays";
import { peopleOf } from "./redirects";
import { familyHref, type FamilyPlace } from "./FamilyFrame";
import styles from "./Family.module.css";

const DAY = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

type Pending = { kind: "reset" | "revoke"; person: string; name: string };

/**
 * "Their own devices" (`?devices=1`): for children who practice on a device of
 * their own rather than the parent's. One path first: the QR and its link
 * (JoinWays). Under Other ways, the family code to type, and printed
 * sign-in cards with, per child, new pictures or signing out everywhere.
 * Replacing the code is in Settings. Only the family's own children, by the
 * roster people of its own class.
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
  const navigate = useNavigate();
  const [pending, setPending] = useState<Pending | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  // The family's own children, by the person each is in its class.
  const people = peopleOf(data?.children ?? [], classId);
  const rows = (roster.data?.students ?? []).filter((row) =>
    people.has(row.id),
  );
  const code = presence.data?.class.joinCode ?? null;
  // A new code is a setting (family Settings, or the tutoring group's
  // when other families' children share the class), never in this sheet.
  const shared = !!data?.teachingPlace;
  const manage = !shared && (presence.data?.canManage ?? false);
  const confirm = async () => {
    if (!pending) return;
    try {
      if (pending.kind === "reset") {
        await reset.mutateAsync(pending.person);
        setStatus(`${pending.name} picks new pictures at the next sign-in.`);
      } else {
        await revoke.mutateAsync(pending.person);
        setStatus(`${pending.name} is signed out on every device.`);
      }
    } catch (failure) {
      console.error("A device change didn’t save", failure);
      // A typed refusal says what to do (a sign-in still being checked);
      // anything else is the connection.
      setError(
        failure instanceof AppError && failure.code
          ? failure.message
          : "That didn’t save. Check your connection and try again.",
      );
    } finally {
      setPending(null);
    }
  };
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
            <div aria-busy="true" style={{ minHeight: 320 }} />
          ) : !code ? (
            <p className={styles.footnote}>
              Their own devices didn’t load. Close this and try again.
            </p>
          ) : (
            <>
              <JoinWays
                code={code}
                words={place.words}
                notice={
                  presence.data?.class.joinLockedUntil && (
                    <p className={styles.footnote} role="status">
                      Sign-in is paused after many wrong pictures.{" "}
                      {manage ? (
                        <Link
                          to="/$"
                          params={{ _splat: familyHref(family, "settings") }}
                        >
                          Replace the code in Settings
                        </Link>
                      ) : (
                        "A new code opens it."
                      )}
                    </p>
                  )
                }
                cards={
                  <section
                    aria-labelledby="devices-cards"
                    className={styles.cardsWay}
                  >
                    <div className={styles.sectionHead}>
                      <h3 id="devices-cards">Sign-in cards</h3>
                      <Link
                        to="/$"
                        params={{ _splat: familyHref(family, "cards") }}
                        className={buttonClass("secondary")}
                      >
                        Print cards
                      </Link>
                    </div>
                    <p className={styles.footnote}>
                      A card signs a child in with one scan, with no code and no
                      pictures.
                    </p>
                    <ul className={styles.deviceRows}>
                      {rows.map((row) => (
                        <li key={row.id} className={styles.deviceRow}>
                          <span className={styles.deviceName}>
                            {row.name}
                            <small>
                              {[
                                row.cardIssuedAt
                                  ? `Card printed ${DAY.format(new Date(row.cardIssuedAt))}`
                                  : "No card",
                                row.picturesSet
                                  ? "Pictures set"
                                  : "No pictures yet",
                              ].join(" · ")}
                            </small>
                          </span>
                          {roster.data?.canManage && (
                            <Menu
                              label="Manage"
                              aria-label={`Manage ${row.name}`}
                            >
                              <MenuItem
                                onSelect={() =>
                                  void navigate({
                                    to: "/$",
                                    params: {
                                      _splat: familyHref(family, "cards"),
                                    },
                                    search: { student: row.id } as never,
                                  })
                                }
                              >
                                {row.cardIssuedAt
                                  ? "Print a new card"
                                  : "Print a card"}
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
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                }
              />
            </>
          )}
        </div>
      </Sheet>
      <Dialog
        open={!!pending}
        onOpenChange={(next) => {
          if (!next) setPending(null);
        }}
        title={
          pending?.kind === "reset"
            ? `New pictures for ${pending.name}?`
            : `Sign ${pending?.name ?? ""} out everywhere?`
        }
      >
        <p className={styles.footnote}>
          {pending?.kind === "reset"
            ? "They choose three new pictures the next time they sign in with the code."
            : "Every device they’re signed in on returns to sign-in. Their work stays."}
        </p>
        <div className={styles.formActions}>
          <Button
            variant="primary"
            aria-busy={reset.isPending || revoke.isPending || undefined}
            onClick={() => void confirm()}
          >
            {pending?.kind === "reset"
              ? "Give new pictures"
              : "Sign out everywhere"}
          </Button>
          <Button variant="quiet" onClick={() => setPending(null)}>
            Cancel
          </Button>
        </div>
      </Dialog>
      <Toast
        message={status || error}
        onDismiss={() => (setStatus(""), setError(""))}
      />
    </>
  );
}
