import type { ReactNode } from "react";
import { RETENTION } from "../../../privacy/retention-periods";
import {
  agreementLead,
  agreementPromises,
  agreementSections,
  agreementTitle,
  AGREEMENT_VERSION,
} from "../../../schools/agreement";
import { SUPPORT_EMAIL } from "../support/SupportHelp";
import { PublicFrame } from "./PublicFrame";
import styles from "./Trust.module.css";

const PRIVACY_POLICY = "https://corpora.inc/legal/privacy/";

function Topic({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.topic}>
      <h2>{title}</h2>
      <div className={styles.topicBody}>{children}</div>
    </section>
  );
}

/** `/schools/trust`: the plain version above, and below it the student data
 * agreement exactly as a school accepts it, from the same source. */
export function TrustScreen() {
  return (
    <PublicFrame>
      <main className={styles.main}>
        <section className={styles.intro} aria-labelledby="trust-title">
          <h1 id="trust-title" className={styles.title}>
            How AMP handles student data
          </h1>
          <ul className={styles.promises}>
            {agreementPromises.map((promise) => (
              <li key={promise.title}>
                <strong>{promise.title}</strong>
                <span>{promise.detail}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className={styles.topics}>
          <Topic title="What’s collected">
            <p>
              Name, optional display name, grade level, optional email address
              and school-assigned identifier, and class enrollments. Sign-in
              records, active time, the problems a student was given, their
              answers, and what AMP works out from those answers: skill
              evidence, working levels and suggested grades.
            </p>
            <p>The school decides which students and which details to add.</p>
          </Topic>
          <Topic title="What isn’t">
            <ul>
              <li>No home address, phone number or government identifier.</li>
              <li>No advertising of any kind.</li>
              <li>
                No advertising trackers or analytics on a student’s device.
              </li>
              <li>No marketing mail for students.</li>
            </ul>
          </Topic>
          <Topic title="Who signs in, and how">
            <p>
              <strong>Students</strong> hold a printed card to a camera, or type
              a class code, tap their name and pick three pictures. A student
              needs no email address. On a shared device they’re signed out
              after 30 idle minutes. Cards and pictures are stored only as
              hashes, and printing a new card stops the old one working.
            </p>
            <p>
              <strong>Teachers and admins</strong> have their own accounts.
              Teachers see the classes they teach, and admins see their school.
              Ending a role stops access on that person’s next request.
            </p>
            <p>
              <strong>Families</strong> see one student through a read-only link
              the school shares. The school can revoke it at any time.
            </p>
          </Topic>
          <Topic title="How long it’s kept">
            <p>
              Student data is kept for {RETENTION.learnerInactivityMonths}{" "}
              months after the later of the student’s last activity and the end
              of the school’s license, then deleted automatically, and it leaves
              backups as they expire. The school can direct deletion sooner.
            </p>
            <p>
              A “Report a problem” note goes after{" "}
              {RETENTION.problemFlagNoteDays} days, and the report itself after{" "}
              {RETENTION.problemFlagDays} days.
            </p>
          </Topic>
          <Topic title="Export and deletion">
            <p>
              Admins can correct a student’s details at any time. Removing a
              student deletes that student’s learning data at once and frees
              their seat. Final grades stay with the school’s records unless it
              asks for full erasure.
            </p>
            <p>
              Teachers export grades and time as CSV, and results as OneRoster.
              For a whole-school export or deletion, an admin writes to{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. It’s done
              within 30 days and confirmed.
            </p>
          </Topic>
          <Topic title="Where it lives, and who processes it">
            <p>
              Student data lives in AMP’s own database, reached over encrypted
              connections, with access limited by role. Workbook PDFs are made
              on request and aren’t stored.
            </p>
            <p>
              Corpora uses service providers to host AMP and to deliver email,
              under written obligations consistent with the agreement, and stays
              responsible for how they handle student data. A current list is
              available from{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
            </p>
            <p>
              AMP’s <a href={PRIVACY_POLICY}>privacy policy</a> covers parent
              accounts and the family product.
            </p>
          </Topic>
        </div>

        <article className={styles.agreement} aria-labelledby="agreement-title">
          <header className={styles.agreementHead}>
            <h2 id="agreement-title">{agreementTitle}</h2>
            <p>Version {AGREEMENT_VERSION}</p>
            <p>The same text a school accepts during setup.</p>
          </header>
          <div className={styles.agreementText}>
            <p className={styles.agreementLead} data-agreement-lead="">
              {agreementLead}
            </p>
            {agreementSections.map((section) => (
              <section
                key={section.heading}
                className={styles.agreementSection}
                data-agreement-section=""
              >
                <h3>{section.heading}</h3>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </section>
            ))}
          </div>
        </article>
      </main>
    </PublicFrame>
  );
}
