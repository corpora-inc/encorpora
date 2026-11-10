import { gradeName } from "../../../../learning/level-check";
import { FrontierMap } from "../../../Home";
import {
  LevelAxis,
  LevelBand,
  LevelTrack,
  LevelTrend,
  levelScale,
  type LevelEstimate,
} from "../../../ui/LevelChart";
import { LevelReadout } from "../../../ui/LevelReadout";
import { CurriculumDetailsFixture } from "../../curriculum/CurriculumDetails";
import {
  RecordLevels,
  RecordObjectives,
  RecordWeeks,
  RecordWork,
  TimeDetail,
} from "../../school/classes/ProgressRecord";
import {
  emptyRecord,
  frontier,
  record,
  strandIds,
  time,
  trend,
} from "../fixtures";
import { Section, Specimen } from "../Gallery";
import styles from "../Design.module.css";

const typical = levelScale(4);
const estimates: [string, LevelEstimate, boolean, string?][] = [
  ["Best guess with a narrow range", { level: 4.4, sd: 0.3 }, false],
  ["Wide range (little evidence)", { level: 4.8, sd: 1.1 }, false],
  ["Estimated, not practiced yet (dashed)", { level: 4, sd: 1.4 }, true],
  ["Far below the age reference", { level: 0.4, sd: 0.4 }, false],
  ["Past the end of the scale", { level: 11.5, sd: 0.5 }, false],
  ["Strand colour (fractions)", { level: 3.4, sd: 0.45 }, false, "fractions"],
];

function Tracks({ size }: { size?: "large" }) {
  return (
    <div className={styles.rows}>
      {estimates.map(([label, estimate, estimated, strand]) => (
        <div key={label} className={styles.row} data-strand={strand}>
          <span className={styles.rowLabel}>{label}</span>
          <LevelTrack
            estimate={estimate}
            scale={typical}
            estimated={estimated}
            size={size}
          />
        </div>
      ))}
      <div className={styles.row}>
        <span />
        <LevelAxis scale={typical} name={gradeName} />
      </div>
    </div>
  );
}

function Bands() {
  const course = [4, 5] as const;
  return (
    <div className={styles.bandRows}>
      {estimates.map(([label, estimate, estimated, strand]) => (
        <div key={label} className={styles.bandRow} data-strand={strand}>
          <span className={styles.rowLabel}>{label}</span>
          <LevelBand
            estimate={estimate}
            scale={typical}
            course={course}
            estimated={estimated}
          />
        </div>
      ))}
      <div className={styles.bandRow}>
        <span className={styles.rowLabel}>Strong (the overall column)</span>
        <LevelBand
          estimate={{ level: 4.4, sd: 0.3 }}
          scale={typical}
          course={course}
          strong
        />
      </div>
      <div className={styles.bandRow}>
        <span />
        <LevelAxis scale={typical} name={(level) => String(level)} />
      </div>
    </div>
  );
}

export function LevelSections() {
  return (
    <>
      <Section
        id="level-track"
        title="Level track and axis"
        source={["ui/LevelChart.tsx", "ui/LevelChart.module.css"]}
        note="Band: the likely range. Dot: the best guess. Tick: typical for the learner's age. Scale centred on grade 4."
      >
        <Specimen label="Regular" wide>
          <Tracks />
        </Specimen>
        <Specimen label="Large" wide>
          <Tracks size="large" />
        </Specimen>
      </Section>
      <Section
        id="level-band"
        title="Level band (table rows)"
        source={["ui/LevelChart.tsx"]}
        note="The course stripe joins down a column of rows; --level-row sets the row height."
      >
        <Specimen label="With the course stripe (grades 4–5)" wide>
          <Bands />
        </Specimen>
      </Section>
      <Section
        id="level-trend"
        title="Level trend"
        source={["ui/LevelChart.tsx"]}
        note="Not used on any screen today; the old trial's level check drew it."
      >
        <Specimen label="A range narrowing over 100 answers" wide>
          <LevelTrend points={trend} label="Level 4.4, range narrowing" />
        </Specimen>
        <Specimen label="One point">
          <LevelTrend points={trend.slice(0, 1)} label="Level 4, wide range" />
        </Specimen>
      </Section>
      <Section
        id="level-readout"
        title="Level readout"
        source={["ui/LevelReadout.tsx", "ui/LevelReadout.module.css"]}
        note="Draws nothing unless grade numbers are shown (Show grade numbers)."
      >
        <Specimen label="Grade 4">
          <CurriculumDetailsFixture shown>
            <LevelReadout estimate={{ level: 4.43, sd: 0.35 }} />
          </CurriculumDetailsFixture>
        </Specimen>
        <Specimen label="Before kindergarten">
          <CurriculumDetailsFixture shown>
            <LevelReadout estimate={{ level: -0.4, sd: 0.6 }} />
          </CurriculumDetailsFixture>
        </Specimen>
        <Specimen label="A high-school course, wide range">
          <CurriculumDetailsFixture shown>
            <LevelReadout estimate={{ level: 10.62, sd: 1.3 }} />
          </CurriculumDetailsFixture>
        </Specimen>
      </Section>
      <Section
        id="record-levels"
        title="Record: where you are"
        source={[
          "features/school/classes/ProgressRecord.tsx",
          "features/school/classes/Teacher.module.css",
        ]}
        note="The /me overview and a teacher's student record share these parts."
      >
        <Specimen label="Levels by strand" wide>
          <div data-dense>
            <RecordLevels record={record} empty="" />
          </div>
        </Specimen>
        <Specimen label="Before any work">
          <div data-dense>
            <RecordLevels
              record={emptyRecord}
              empty="Your levels appear here after your first problems."
            />
          </div>
        </Specimen>
        <Specimen label="Time, last 12 weeks" wide>
          <div data-dense>
            <RecordWeeks record={record} />
          </div>
        </Specimen>
        <Specimen label="Time by day and skill" wide>
          <div data-dense>
            <TimeDetail time={time} who="Ada" />
          </div>
        </Specimen>
        <Specimen label="Objectives gained">
          <div data-dense>
            <RecordObjectives record={record} />
          </div>
        </Specimen>
        <Specimen label="Objectives, none yet">
          <div data-dense>
            <RecordObjectives record={emptyRecord} />
          </div>
        </Specimen>
        <Specimen label="Recent work" wide>
          <div data-dense>
            <RecordWork record={record} />
          </div>
        </Specimen>
      </Section>
      <Section
        id="frontier-map"
        title="Frontier map (learner overview)"
        source={["Home.tsx", "theme.css"]}
        note="Draws its own track markup, a copy of LevelTrack's (see docs/components.md)."
      >
        <Specimen label="Estimates by strand, grade numbers hidden" wide plain>
          <CurriculumDetailsFixture shown={false}>
            <FrontierMap
              name="Ada"
              birthYear={2017}
              frontier={frontier}
              strands={strandIds}
            />
          </CurriculumDetailsFixture>
        </Specimen>
        <Specimen label="Grade numbers shown" wide plain>
          <CurriculumDetailsFixture shown>
            <FrontierMap
              name="Ada"
              birthYear={2017}
              frontier={frontier}
              strands={strandIds}
            />
          </CurriculumDetailsFixture>
        </Specimen>
        <Specimen label="Loading" wide plain>
          <CurriculumDetailsFixture shown={false}>
            <FrontierMap
              name="Ada"
              birthYear={2017}
              frontier={null}
              strands={strandIds}
            />
          </CurriculumDetailsFixture>
        </Specimen>
      </Section>
    </>
  );
}
