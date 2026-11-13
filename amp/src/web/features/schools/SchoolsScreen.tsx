import { Link, useLoaderData } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { buttonClass } from "../../ui/Button";
import { SCOPE_CSV, SCOPE_PDF } from "./api";
import { CurriculumRibbon } from "./CurriculumRibbon";
import { ProductShot } from "./ProductShot";
import { PublicFrame } from "./PublicFrame";
import { TalkToUs } from "./TalkToUs";
import { productScreens as screens } from "./screens";
import styles from "./Schools.module.css";

const count = (value: number) => value.toLocaleString("en-US");

function Actions({ className = "" }: { className?: string }) {
  return (
    <div className={`${styles.actions} ${className}`}>
      <Link
        to="/$"
        params={{ _splat: "school/start" }}
        className={buttonClass("primary", styles.action)}
      >
        Start with your class
      </Link>
      <Link
        to="/$"
        params={{ _splat: "school/connect" }}
        className={buttonClass("secondary", styles.action)}
      >
        Use Clever
      </Link>
      <Link
        to="/schools"
        hash="talk"
        className={buttonClass("quiet", styles.action)}
      >
        Talk to us
      </Link>
    </div>
  );
}

function Question({
  question,
  children,
}: {
  question: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.question}>
      <dt>{question}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** `/schools`: what a head of school or teacher lands on. The whole curriculum,
 * the product itself on real screens, and plain answers to what schools ask. */
export function SchoolsScreen() {
  const summary = useLoaderData({ from: "/schools" });
  return (
    <PublicFrame>
      <main className={styles.main}>
        <section className={styles.hero} aria-labelledby="schools-title">
          <h1 id="schools-title" className={styles.title}>
            A complete math curriculum for your school, from counting to
            precalculus.
          </h1>
          <div className={styles.heroBody}>
            <p className={styles.lede}>
              Every student works at their own level in every area of math, with
              unlimited problems and unlimited personalized workbooks. Teachers
              see who needs them today, and they decide every grade.
            </p>
            <div className={styles.heroActions}>
              <Actions />
              <p className={styles.note}>
                Bring your roster and choose when to start your class’s pilot.
              </p>
            </div>
          </div>
          {summary && (
            <>
              <CurriculumRibbon summary={summary} />
              <ul className={styles.facts}>
                <li>
                  <strong>{count(summary.objectives)}</strong>
                  <span>
                    objectives mapped to Common Core standards and SAT Math
                    domains
                  </span>
                </li>
                <li>
                  <strong>{count(summary.problemTypes)}</strong>
                  <span>
                    problem types that write new problems, so practice never
                    runs out
                  </span>
                </li>
                <li>
                  <strong>{count(summary.lessons)}</strong>
                  <span>
                    lessons, with a hint and a worked explanation for every
                    problem
                  </span>
                </li>
              </ul>
            </>
          )}
        </section>

        <section className={styles.band} aria-labelledby="schools-start">
          <div className={styles.bandInner}>
            <div className={styles.bandHead}>
              <h2 id="schools-start">Start class</h2>
              <p>
                Put the code on the board and students are in. Names light up as
                they arrive.
              </p>
            </div>
            <div className={styles.boardStage}>
              <ProductShot screen={screens.board} eager />
              <div className={styles.cardsLine}>
                <h3>Or print a card for each student.</h3>
                <p>
                  They hold it up to a camera and they’re in. No email needed.
                </p>
              </div>
              <ProductShot
                screen={screens.cards}
                className={styles.cardsShot}
              />
            </div>
          </div>
        </section>

        <section className={styles.feature} aria-labelledby="schools-today">
          <div className={styles.featureText}>
            <h2 id="schools-today">Today</h2>
            <p>
              Who needs you today, which students share a gap, and the one thing
              to do about it.
            </p>
          </div>
          <ProductShot screen={screens.today} className={styles.featureShot} />
        </section>

        <section className={styles.grades} aria-labelledby="schools-grades">
          <div className={styles.featureText}>
            <h2 id="schools-grades">Gradebook and evidence</h2>
            <p>
              A suggested grade range for every student. You decide the grade,
              and every grade opens to the objectives, dates and problems behind
              it.
            </p>
          </div>
          <div className={styles.gradesStage}>
            <ProductShot
              screen={screens.gradebook}
              className={styles.gradebookShot}
            />
            <ProductShot
              screen={screens.evidence}
              className={styles.evidenceShot}
            />
          </div>
        </section>

        <section
          className={`${styles.feature} ${styles.featureFlip}`}
          aria-labelledby="schools-stack"
        >
          <div className={styles.featureText}>
            <h2 id="schools-stack">Workbook stack</h2>
            <p>
              A different printable workbook for every student, made from their
              own work, then marked on one roster.
            </p>
          </div>
          <ProductShot screen={screens.stack} className={styles.featureShot} />
        </section>

        <section
          className={`${styles.feature} ${styles.standings}`}
          aria-labelledby="schools-boards"
        >
          <div className={styles.featureText}>
            <h2 id="schools-boards">Standings</h2>
            <p>
              A board a class can switch on, counting growth, practice or level.
              It shows the top ten, and you can leave any student off.
            </p>
          </div>
          <ProductShot
            screen={screens.standings}
            className={styles.standingsShot}
          />
        </section>

        <section className={styles.grades} aria-labelledby="schools-overviews">
          <div className={styles.featureText}>
            <h2 id="schools-overviews">School and district overviews</h2>
            <p>
              The morning read for a head: seats, who needs attention, the
              week’s practice and where every student stands against their own
              grade. A district sees each of its schools the same way, and can
              set and lock policy for all of them.
            </p>
          </div>
          <div className={styles.overviewsStage}>
            <ProductShot
              screen={screens.schoolOverview}
              className={styles.schoolOverviewShot}
            />
            <ProductShot
              screen={screens.districtOverview}
              className={styles.districtOverviewShot}
            />
          </div>
        </section>

        <section className={styles.questions} aria-labelledby="schools-asked">
          <h2 id="schools-asked">Questions schools ask</h2>
          <dl className={styles.questionList}>
            <Question question="What’s the scope and sequence?">
              Kindergarten through Precalculus
              {summary ? `, ${count(summary.objectives)} objectives` : ""}, each
              with its standards and prerequisites, generated from the live
              curriculum.{" "}
              <Link to="/schools/scope-and-sequence">Read it here</Link>, or
              download the <a href={SCOPE_PDF}>PDF</a> or the{" "}
              <a href={SCOPE_CSV}>CSV</a>.
            </Question>
            <Question question="Who does setup?">
              A school admin or a single teacher, in one guided flow: school,
              calendar, data agreement, students. Paste a spreadsheet or import
              a OneRoster file, and AMP shows every change before it makes one.
            </Question>
            <Question question="Who grades, and who sees student work?">
              Teachers see and grade their own classes. Admins see their whole
              school. AMP suggests a range from course progress, growth,
              practice and retention, and the teacher decides. A family sees one
              student, through a read-only link the school shares.
            </Question>
            <Question question="What reports are there?">
              Suggested and final grades. Active time by student, day and skill.
              Progress by strand on a class map. Printable report cards and
              progress reports. Gradebook and time exports as CSV, and results
              as OneRoster.
            </Question>
            <Question question="How do students sign in?">
              A printed card held up to a camera, or a class code, their name
              and three pictures they chose. No email address, and nothing for
              IT to set up.
            </Question>
            <Question question="What happens to student data?">
              It stays the school’s. It’s never sold, never used for advertising
              and never used to train general-purpose AI models, and it’s
              exported or deleted when the school asks.{" "}
              <Link to="/schools/trust">
                Read the promises and the agreement
              </Link>
              .
            </Question>
            <Question question="Does it fit one teacher, a school or a district?">
              One teacher with one class never sees an admin screen. A school
              adds staff, classes, a shared calendar and one pool of seats. A
              district adds one level above, with rollups across its schools and
              settings it can lock.
            </Question>
          </dl>
        </section>

        <section
          id="talk"
          className={styles.closing}
          aria-labelledby="schools-talk"
        >
          <div className={styles.closingHead}>
            <h2 id="schools-talk">Talk to us.</h2>
            <p>
              Tell us about your school, and we’ll set AMP up with you, from the
              first class to every school in the district.
            </p>
          </div>
          <TalkToUs />
        </section>
      </main>
    </PublicFrame>
  );
}
