import { Badge, type BadgeTone } from "../../../ui/Badge";
import { Button } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { Loading } from "../../../ui/Loading";
import { LoadingScreen } from "../../../ui/LoadingScreen";
import { Meter } from "../../../ui/Meter";
import { StatRow, StatTile } from "../../../ui/StatTile";
import { Toast } from "../../../ui/Toast";
import { RecordLevels } from "../../school/classes/ProgressRecord";
import { record } from "../fixtures";
import { Section, Specimen, SpecimenFrame } from "../Gallery";
import styles from "../Design.module.css";

const tones: BadgeTone[] = ["neutral", "info", "success", "warning", "danger"];

export function StateSections() {
  return (
    <>
      <Section
        id="empty-state"
        title="Empty state"
        source={["ui/EmptyState.tsx", "ui/EmptyState.module.css"]}
        note="What will appear here, and the next step that works."
      >
        <Specimen label="Title only">
          <EmptyState title="No workbooks yet" />
        </Specimen>
        <Specimen label="With a line">
          <EmptyState title="No classes yet">
            Classes you teach or co-teach appear here.
          </EmptyState>
        </Specimen>
        <Specimen label="With its next step">
          <EmptyState
            title="No students yet"
            action={<Button variant="primary">Add students</Button>}
          >
            Add your students, then print their sign-in cards.
          </EmptyState>
        </Specimen>
        <Specimen label="An error, with retry">
          <EmptyState
            title="Your progress didn’t load"
            action={<Button variant="primary">Try again</Button>}
          >
            Check your connection, then try again.
          </EmptyState>
        </Specimen>
        <Specimen label="Long text" wide>
          <EmptyState
            title="Nothing to mark from Esperanza Villanueva-Castellanos’s workbook of Tuesday, November 10"
            action={<Button variant="secondary">Back to the stack</Button>}
          >
            Every problem in this workbook was answered in the app, so there is
            nothing on paper to mark. Workbooks printed after today will appear
            here once they come back from home.
          </EmptyState>
        </Specimen>
      </Section>
      <Section
        id="loading"
        title="Loading"
        source={["ui/Loading.tsx", "ui/loading.css", "ui/LoadingScreen.tsx"]}
        note="The wave fades in after a moment, so a fast answer never flashes it."
      >
        <Specimen label="In a block">
          <Loading>Loading your workbooks…</Loading>
        </Specimen>
        <Specimen label="Wave alone">
          <Loading />
        </Specimen>
        <Specimen label="Inline, in a heading">
          <h3 className={styles.text}>
            <Loading inline>Opening your book…</Loading>
          </h3>
        </Specimen>
        <Specimen label="Skeleton rows">
          <div className={`${styles.skeleton} amp-skeleton`} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </Specimen>
        <SpecimenFrame
          specimen="loading-screen"
          label="Loading screen (first paint)"
          height={420}
        />
        <SpecimenFrame
          specimen="loading-error"
          label="Loading screen, failed, with retry"
          height={420}
        />
      </Section>
      <Section
        id="toast"
        title="Toast"
        source={["ui/Toast.tsx", "ui/Toast.module.css"]}
        note="Fixed over the content, so it never moves the page. Errors stay until dismissed; a confirmation closes by itself (here it stays, for review)."
      >
        <SpecimenFrame specimen="toast-alert" label="Error" height={360} />
        <SpecimenFrame
          specimen="toast-titled"
          label="Error with a title, long message"
          height={360}
        />
        <SpecimenFrame
          specimen="toast-status"
          label="Confirmation (top)"
          height={360}
        />
      </Section>
      <Section
        id="badge"
        title="Badge"
        source={["ui/Badge.tsx", "ui/Badge.module.css"]}
      >
        <Specimen label="Tones">
          <div className={styles.inline}>
            {tones.map((tone) => (
              <Badge key={tone} tone={tone}>
                {tone[0]!.toUpperCase() + tone.slice(1)}
              </Badge>
            ))}
          </div>
        </Specimen>
        <Specimen label="In use">
          <div className={styles.inline}>
            <Badge tone="success">Active</Badge>
            <Badge tone="warning">Invited</Badge>
            <Badge tone="danger">Locked</Badge>
            <Badge>Co-teacher</Badge>
          </div>
        </Specimen>
      </Section>
      <Section
        id="meter"
        title="Meter and stat tiles"
        source={["ui/Meter.tsx", "ui/StatTile.tsx"]}
      >
        <Specimen label="Meter: 0, 1, 64, 100 of 100">
          <div className={styles.column} data-dense>
            {[0, 1, 64, 100].map((value) => (
              <Meter key={value} value={value} label="Percent correct" />
            ))}
          </div>
        </Specimen>
        <Specimen label="Meter: past its maximum, a large number">
          <div className={styles.column} data-dense>
            <Meter value={140} label="Seats used" />
            <Meter value={12480} max={20000} label="Problems" />
          </div>
        </Specimen>
        <Specimen label="Stat row" wide>
          <StatRow label="This week">
            <StatTile label="active minutes" value="312" />
            <StatTile
              label="problems"
              value="1,204"
              detail="+18% on last week"
            />
            <StatTile label="days worked" value="5" />
            <StatTile label="skills shown on their own" value="0" />
          </StatRow>
        </Specimen>
      </Section>
    </>
  );
}

/** A page behind an overlay, so its scrim and edges read as on a screen. */
export function Backdrop() {
  return (
    <main className={styles.backdrop} data-dense>
      <h1>Ada Okafor</h1>
      <RecordLevels record={record} empty="" />
    </main>
  );
}

export const stateSpecimens = {
  "loading-screen": () => <LoadingScreen />,
  "loading-error": () => (
    <LoadingScreen error="This screen could not be loaded." retry={() => {}} />
  ),
  "toast-alert": () => (
    <>
      <Backdrop />
      <Toast
        message="Your workbook didn't download. Check your connection, then try again."
        onDismiss={() => {}}
      />
    </>
  ),
  "toast-titled": () => (
    <>
      <Backdrop />
      <Toast
        title="Esperanza wasn't added"
        message="A learner named Esperanza Villanueva-Castellanos is already in this class. Use a nickname to tell them apart, then add her again."
        onDismiss={() => {}}
      />
    </>
  ),
  "toast-status": () => (
    <>
      <Backdrop />
      <Toast
        tone="status"
        placement="top"
        message="Saved. Ada's next workbook starts from here."
        onDismiss={() => {}}
      />
    </>
  ),
};
