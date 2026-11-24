import { FAMILY_REPORT_WORDS } from "../../family/FamilyReport";
import {
  CLASS_REPORT_WORDS,
  Report,
  type ReportKit,
  type ReportLink,
} from "../../school/classes/SessionReportScreen";
import { reportFixture } from "./report-fixture";
import styles from "./LiveGallery.module.css";

/** In the gallery a name opens nothing: the link only shows where the
 * screen's own goes. */
const link: ReportLink = ({ name, className, children }) => (
  <a
    className={className}
    href="#student"
    aria-label={`Open ${name}`}
    onClick={(event) => event.preventDefault()}
  >
    {children}
  </a>
);
const classKit: ReportKit = { words: CLASS_REPORT_WORDS, link };
const familyKit: ReportKit = {
  words: FAMILY_REPORT_WORDS,
  link,
  levelShown: () => true,
};

/** A class's stopped session, alone in its document: fourteen students, one
 * of them with twenty skills (scripts/verify-session-report-ui.ts). */
export function ClassReportSpecimen() {
  return (
    <main className={styles.page}>
      <Report
        report={reportFixture(14)}
        className="Grade 5 Math B"
        kit={classKit}
      />
    </main>
  );
}

/** A family's: three children, in a family's words. */
export function FamilyReportSpecimen() {
  return (
    <main className={styles.page}>
      <Report report={reportFixture(3)} className={undefined} kit={familyKit} />
    </main>
  );
}
