import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { prepareBuyerHandoff } from "./buyer-session";
import { Button, buttonClass } from "../../../ui/Button";
import { Loading } from "../../../ui/Loading";
import { PublicFrame } from "../../schools/PublicFrame";
import { buyerOptions } from "./api";
import styles from "./Pilot.module.css";

export function BuyerHandoffScreen() {
  const [token] = useState(prepareBuyerHandoff);
  const [copied, setCopied] = useState("");
  const request = useQuery({ ...buyerOptions(token ?? ""), enabled: !!token });
  const data = request.data;
  const purchased = data?.status === "active";
  const paid = data?.pilots.some((pilot) => (pilot.coverage?.paid ?? 0) > 0);
  const ends = [
    ...new Set(
      data?.pilots
        .map((pilot) => pilot.endsAt)
        .filter((date): date is string => !!date),
    ),
  ].sort();
  const subject = data
    ? `AMP seats for ${data.schoolName}`
    : "AMP school seats";
  const body = data
    ? `We would like to discuss ${data.seats} AMP seats for ${data.schoolName}.\n\nRequest reference: ${data.id}\n\nOur purchasing requirements:\n`
    : "";
  return (
    <PublicFrame>
      <main className={styles.page}>
        <meta name="referrer" content="no-referrer" />
        {token && request.isPending ? (
          <Loading>Opening the school’s request</Loading>
        ) : !data ? (
          <>
            <h1>This sharing link is unavailable</h1>
            <p>
              Ask the teacher for a fresh buyer link, or contact
              support@corpora.inc.
            </p>
          </>
        ) : (
          <>
            <header>
              <h1>AMP for {data.schoolName}</h1>
              <p className={styles.lead}>
                {purchased
                  ? "Your school’s seat purchase is confirmed. Teachers and students keep their existing AMP records and learning history."
                  : "Your teacher is ready to discuss seats for adaptive math practice from counting through precalculus."}
              </p>
            </header>
            {purchased && (
              <section className={styles.panel}>
                <h2>{paid ? "Access activated" : "Purchase confirmed"}</h2>
                <p>
                  {paid
                    ? "Paid access is available for rostered students covered by your school’s seats. Teachers can check each class’s coverage in AMP."
                    : "Your seat purchase is recorded. Contact Corpora to confirm the agreed access dates or check coverage with your school administrator."}
                </p>
              </section>
            )}
            <dl className={styles.facts}>
              <div>
                <dt>Seats requested</dt>
                <dd>{data.seats}</dd>
              </div>
              <div>
                <dt>Classes</dt>
                <dd>{data.classCount}</dd>
              </div>
              <div>
                <dt>Students practicing</dt>
                <dd>{data.participating}</dd>
              </div>
            </dl>
            <p>
              {data.students}{" "}
              {data.students === 1 ? "student is" : "students are"} on these
              class rosters.
              {!purchased && ends.length
                ? ` Pilot end date: ${ends.map((date) => new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long", day: "numeric" }).format(new Date(date))).join(" and ")}.`
                : ""}
            </p>
            <p>
              {purchased
                ? "Contact Corpora if your school needs more seats or help with its purchase. Include the request reference below."
                : "Tell us your purchasing requirements and the number of students you want to include. We’ll agree on pricing and help with your school’s purchase order or invoice process."}
            </p>
            <div className={styles.actions}>
              <Link
                to="/schools"
                hash="talk"
                className={buttonClass("primary")}
              >
                {purchased ? "Contact Corpora" : "Discuss seats with Corpora"}
              </Link>
              {!purchased && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(`${subject}\n\n${body}`)
                      .then(
                        () =>
                          setCopied(
                            "Request details copied. Include them when you contact us.",
                          ),
                        () =>
                          setCopied(
                            "Copy the request reference below and include it when you contact us.",
                          ),
                      )
                  }
                >
                  Copy request details
                </Button>
              )}
            </div>
            <p className={styles.status} role="status">
              {copied}
            </p>
            <p className={styles.status}>Request reference: {data.id}</p>
          </>
        )}
      </main>
    </PublicFrame>
  );
}
