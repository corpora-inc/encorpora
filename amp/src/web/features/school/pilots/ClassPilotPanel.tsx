import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { AGREEMENT_VERSION } from "../../../../schools/agreement";
import { AppError } from "../../../lib/AppError";
import { Button, buttonClass } from "../../../ui/Button";
import { TextArea, TextField } from "../../../ui/TextField";
import { Loading } from "../../../ui/Loading";
import { currentSession, refreshSchool } from "../api";
import { Authorization } from "./Authorization";
import { pilotApi, pilotOptions } from "./api";
import { pilotPresentation } from "./presentation";
import styles from "./Pilot.module.css";

export function ClassPilotPanel({
  orgId,
  classId,
  students,
}: {
  orgId: string;
  classId: string;
  students: number;
}) {
  const session = currentSession();
  const state = useQuery(pilotOptions(session, classId));
  const [working, setWorking] = useState<"activate" | "purchase" | null>(null);
  const busy = working !== null;
  const [error, setError] = useState("");
  const [name, setName] = useState(session.name ?? "");
  const [title, setTitle] = useState("Teacher");
  const [authorized, setAuthorized] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [seats, setSeats] = useState(String(Math.max(1, students)));
  const [note, setNote] = useState("");
  const [buyerUrl, setBuyerUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const pilot = state.data;
  async function activate() {
    if (busy || !pilot) return;
    setWorking("activate");
    setError("");
    try {
      if (!pilot.authorized)
        await pilotApi.authorize(session, classId, {
          version: AGREEMENT_VERSION,
          signerName: name,
          signerTitle: title,
          authorized: true,
        });
      await pilotApi.activate(session, classId);
      await refreshSchool(session);
    } catch (failure) {
      setError(
        failure instanceof AppError
          ? failure.message
          : "The pilot didn’t start. Try again.",
      );
    } finally {
      setWorking(null);
    }
  }
  async function requestSeats() {
    const count = Number(seats);
    if (!Number.isInteger(count) || count < 1 || count > 1_000_000) {
      setError("Enter the number of seats your school needs.");
      return;
    }
    setWorking("purchase");
    setError("");
    try {
      const result = await pilotApi.purchase(session, {
        orgId,
        classIds: [classId],
        seats: count,
        note,
      });
      setBuyerUrl(result.url);
    } catch (failure) {
      setError(
        failure instanceof AppError
          ? failure.message
          : "The sharing link didn’t save. Try again.",
      );
    } finally {
      setWorking(null);
    }
  }
  if (state.isPending)
    return (
      <section className={styles.panel}>
        <Loading>Checking class access</Loading>
      </section>
    );
  if (!pilot)
    return (
      <section className={styles.panel}>
        <p>Class access couldn’t be checked.</p>
        <Button variant="secondary" onClick={() => void state.refetch()}>
          Try again
        </Button>
      </section>
    );
  const view = pilotPresentation(pilot, students);
  return (
    <section className={styles.panel} aria-label="Class access">
      <h2>{view.title}</h2>
      <p>{view.detail}</p>
      {view.action && !pilot.authorized && (
        <Authorization
          name={name}
          title={title}
          authorized={authorized}
          onName={setName}
          onTitle={setTitle}
          onAuthorized={setAuthorized}
          disabled={busy}
        />
      )}
      <div className={styles.actions}>
        {view.action && (
          <Button
            variant="primary"
            onClick={() => void activate()}
            aria-busy={working === "activate"}
            disabled={
              busy ||
              (!pilot.authorized &&
                (!authorized || !name.trim() || !title.trim()))
            }
          >
            {view.action}
          </Button>
        )}
        {!students && (
          <Link
            to="/$"
            params={{ _splat: `school/${orgId}/classes/${classId}/import` }}
            className={buttonClass("primary")}
          >
            Import students
          </Link>
        )}
        {students > 0 && (
          <Button
            variant={
              pilot.status === "expired" || !pilot.eligible
                ? "primary"
                : "secondary"
            }
            onClick={() => {
              setRequesting(!requesting);
              setSeats(String(Math.max(students, Number(seats) || 0)));
            }}
          >
            Request seats
          </Button>
        )}
      </div>
      {requesting && (
        <div className={styles.form}>
          <h3>Share with the person who buys for your school</h3>
          <p>
            The link shows your school’s name, participation counts and pilot
            dates. We’ll work with your buyer on pricing and purchasing.
          </p>
          {buyerUrl ? (
            <>
              <TextField
                label="Buyer link"
                value={buyerUrl}
                readOnly
                onFocus={(event) => event.target.select()}
              />
              <div className={styles.actions}>
                <Button
                  variant="secondary"
                  onClick={() => {
                    void navigator.clipboard.writeText(buyerUrl).then(
                      () => setCopied(true),
                      () =>
                        setError("Select the buyer link above and copy it."),
                    );
                  }}
                >
                  {copied ? "Link copied" : "Copy buyer link"}
                </Button>
                <a
                  href={buyerUrl}
                  className={buttonClass("quiet")}
                  referrerPolicy="no-referrer"
                >
                  Preview buyer page
                </a>
              </div>
            </>
          ) : (
            <>
              <TextField
                label="Seats to discuss"
                value={seats}
                onChange={(event) => setSeats(event.target.value)}
                inputMode="numeric"
                maxLength={7}
              />
              <TextArea
                label="Purchasing context (optional)"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={1000}
                rows={3}
              />
              <Button
                variant="primary"
                aria-busy={working === "purchase"}
                disabled={busy}
                onClick={() => void requestSeats()}
              >
                Create buyer link
              </Button>
            </>
          )}
        </div>
      )}
      <p className={styles.error} role={error ? "alert" : undefined}>
        {error}
      </p>
    </section>
  );
}
