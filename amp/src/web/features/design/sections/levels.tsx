import { strandNames } from "../../../BirthYearPrompt";
import {
  fitScale,
  LevelRange,
  LevelRangeStart,
  LevelRows,
} from "../../../ui/level-range";
import { CurriculumDetailsFixture } from "../../curriculum/CurriculumDetails";
import {
  RecordLevels,
  RecordObjectives,
  RecordWeeks,
  RecordWork,
  TimeDetail,
} from "../../school/classes/ProgressRecord";
import { emptyRecord, frontier, record, strandIds, time } from "../fixtures";
import { Section, Specimen } from "../Gallery";

const areas = strandIds
  .filter((id) => frontier.strands[id])
  .map((id) => ({
    id,
    label: strandNames[id] ?? id,
    estimate: frontier.strands[id]!,
  }));
const scale = fitScale(
  [frontier.overall, ...areas.map((area) => area.estimate)],
  { minSpan: 5 },
);

export function LevelSections() {
  return (
    <>
      <Section
        id="level-range"
        title="Level range"
        source={["ui/level-range/"]}
        note="The one level view: a best guess on a likely range, area by area, on a scale fitted to the learner. /me, a child's Overview, the class map's panels, Pathways and the family progress link all draw it."
      >
        <Specimen label="A learner with weeks of work" wide>
          <CurriculumDetailsFixture shown>
            <LevelRange
              overall={frontier.overall}
              answered={frontier.overall.answered}
              areas={areas}
              grade={[4, 5]}
            />
          </CurriculumDetailsFixture>
        </Specimen>
        <Specimen label="Day 0: not measured yet" wide>
          <LevelRangeStart />
        </Specimen>
        <Specimen label="Day 0, read by a parent" wide>
          <LevelRangeStart who="Maya" />
        </Specimen>
        <Specimen label="Rows on a shared scale" wide>
          <LevelRows overall={frontier.overall} areas={areas} scale={scale} />
        </Specimen>
        <Specimen label="Grade numbers hidden" wide>
          <LevelRows
            overall={frontier.overall}
            areas={areas}
            scale={scale}
            numbers={false}
          />
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
        <Specimen label="Skills shown on their own">
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
    </>
  );
}
