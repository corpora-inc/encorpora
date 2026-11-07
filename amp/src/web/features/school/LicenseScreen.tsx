import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { formatDay } from "../../../schools/calendar";
import { AppError } from "../../lib/AppError";
import { useLoggedError } from "../../feedback";
import { Badge } from "../../ui/Badge";
import { Button, buttonClass } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { Meter } from "../../ui/Meter";
import { StatRow, StatTile } from "../../ui/StatTile";
import { Stepper } from "../../ui/Stepper";
import { TextArea } from "../../ui/TextField";
import { currentSession, licenseOptions, orgOptions, school } from "./api";
import { OrgFrame } from "./OrgFrame";
import { FormNote, PageHead } from "./parts";
import { orgPath } from "./paths";
import styles from "./School.module.css";

/** A seat count as the overview writes it: 9,992, not 9992. */
const count = (value: number | undefined) =>
  value === undefined ? "–" : value.toLocaleString("en-US");

function RequestSeats({ orgId, waiting }: { orgId: string; waiting: number }) {
  const session = currentSession();
  const [seats, setSeats] = useState(Math.max(10, waiting));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  useLoggedError(error);
  return (
    <form
      className={styles.seatRequest}
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        setStatus("");
        void school
          .requestSeats(session, orgId, {
            seats,
            ...(note.trim() ? { note: note.trim() } : {}),
          })
          .then(() => {
            setStatus(
              "Request sent. We’ll write to you shortly, and any students waiting get seats as soon as they’re added.",
            );
            setNote("");
          })
          .catch((failure) =>
            setError(
              failure instanceof AppError
                ? failure.message
                : "The request didn’t send. Email support@corpora.inc.",
            ),
          )
          .finally(() => setBusy(false));
      }}
    >
      <h2>Request more seats</h2>
      <Stepper
        label="Seats wanted"
        value={seats}
        onChange={setSeats}
        min={1}
        max={10_000}
        step={5}
      />
      <TextArea
        label="Note, if it helps"
        maxLength={1000}
        rows={3}
        value={note}
        placeholder="Renewal dates, a purchase order, anything we should know"
        onChange={(event) => setNote(event.target.value)}
      />
      <FormNote error={error} status={status} />
      <Button
        variant="primary"
        type="submit"
        aria-busy={busy}
        disabled={busy}
        className={styles.sheetAction}
      >
        Request seats
      </Button>
    </form>
  );
}

/** Seats and dates. Never a price: that conversation happens with a person. */
export function LicenseScreen() {
  const { org: orgId } = useParams({ strict: false }) as { org: string };
  const session = currentSession();
  const org = useQuery(orgOptions(session, orgId)).data;
  const view = useQuery(licenseOptions(session, orgId));
  const data = view.data;
  const license = data?.license;
  const ended = !!license && Date.parse(license.endsAt) <= Date.now();
  return (
    <OrgFrame orgId={orgId} nav="license" title="License">
      <PageHead
        title="License"
        detail={
          license
            ? ended
              ? `Ended ${formatDay(license.endsAt.slice(0, 10))}`
              : `${license.evaluation ? "Evaluation, through" : "Through"} ${formatDay(license.endsAt.slice(0, 10))}`
            : " "
        }
      />
      {view.isError ? (
        <EmptyState
          title="Your license didn’t load"
          action={
            <Button variant="secondary" onClick={() => void view.refetch()}>
              Try again
            </Button>
          }
        />
      ) : (
        <div className={styles.licenseBody}>
          <section className={styles.licenseFacts}>
            <StatRow label="Seats">
              <StatTile label="in use" value={count(data?.used)} />
              <StatTile label="available" value={count(data?.available)} />
              <StatTile label="total" value={count(data?.seats)} />
            </StatRow>
            {data && data.seats > 0 && (
              <Meter value={data.used} max={data.seats} label="Seats in use" />
            )}
            {data && data.waiting > 0 && (
              <p className={styles.waitingNote}>
                <Badge tone="warning">
                  {count(data.waiting)}{" "}
                  {data.waiting === 1 ? "student needs" : "students need"} a
                  seat
                </Badge>{" "}
                <Link
                  to="/$"
                  params={{ _splat: orgPath(orgId, "students") }}
                  className={buttonClass("quiet")}
                >
                  See students
                </Link>
              </p>
            )}
            {license?.reference && (
              <p className={styles.quiet}>Reference: {license.reference}</p>
            )}
          </section>
          {org?.can?.includes("license.request") && (
            <RequestSeats orgId={orgId} waiting={data?.waiting ?? 0} />
          )}
        </div>
      )}
    </OrgFrame>
  );
}
