import { useState, type ReactNode } from "react";
import { Button, buttonClass, type ButtonVariant } from "../../../ui/Button";
import { Checkbox } from "../../../ui/Checkbox";
import { Chips } from "../../../ui/Chips";
import { DatePicker } from "../../../ui/DatePicker";
import { ChoicePicker, Listbox, ListboxDisclosure } from "../../../ui/Listbox";
import { Menu, MenuItem, MenuLabel } from "../../../ui/Menu";
import { SearchField } from "../../../ui/SearchField";
import { Segmented, type SegmentedOption } from "../../../ui/Segmented";
import { BirthYearPicker, Select } from "../../../ui/Select";
import { Stepper } from "../../../ui/Stepper";
import { TextArea, TextField } from "../../../ui/TextField";
import { TileChoice } from "../../../ui/TileChoice";
import { YearField } from "../../../ui/YearField";
import { Section, Specimen } from "../Gallery";
import styles from "../Design.module.css";

const variants: ButtonVariant[] = ["primary", "secondary", "quiet"];
const title = (text: string) => text[0]!.toUpperCase() + text.slice(1);

/** A control that keeps its own value, so every specimen can be used. */
function Live<T>({
  initial,
  children,
}: {
  initial: T;
  children: (value: T, set: (value: T) => void) => ReactNode;
}) {
  const [value, set] = useState(initial);
  return <>{children(value, set)}</>;
}

function ButtonSection() {
  return (
    <Section
      id="buttons"
      title="Buttons"
      source={["ui/Button.tsx", "ui/Controls.module.css", "ui/loading.css"]}
      note="One height (the 44 px target) in three variants. Width comes from the caller; hover and focus are live: point at one, or Tab to it."
    >
      {variants.map((variant) => (
        <Specimen key={variant} label={title(variant)}>
          <div className={styles.inline}>
            <Button variant={variant}>Continue</Button>
            <Button variant={variant} disabled>
              Disabled
            </Button>
            <Button variant={variant} aria-busy="true" disabled>
              Saving
            </Button>
          </div>
        </Specimen>
      ))}
      <Specimen label="A link drawn as a button (buttonClass)">
        <div className={styles.inline}>
          <a href="#buttons" className={buttonClass("primary")}>
            Make a workbook
          </a>
          <a href="#buttons" className={buttonClass("secondary")}>
            Past workbooks
          </a>
        </div>
      </Specimen>
      <Specimen label="Quiet, lined up with its column (align start)">
        <div className={styles.column}>
          <p className={styles.text}>Text that starts at the column edge.</p>
          <Button variant="quiet" align="start">
            Practice as someone else
          </Button>
        </div>
      </Specimen>
      <Specimen label="Full width in a form column" wide>
        <div className={styles.formColumn}>
          {variants.map((variant) => (
            <Button key={variant} variant={variant} className={styles.full}>
              {title(variant)} action
            </Button>
          ))}
        </div>
      </Specimen>
      <Specimen label="A long label in a narrow space">
        <div className={styles.narrow}>
          <Button variant="primary">
            Continue with AMP for the whole family this year
          </Button>
        </div>
      </Specimen>
      <Specimen label="An action row: primary beside secondary">
        <div className={styles.inline}>
          <Button variant="primary">Save</Button>
          <Button variant="secondary">Cancel</Button>
          <Button variant="quiet">Remove</Button>
        </div>
      </Specimen>
    </Section>
  );
}

const minutes: SegmentedOption<string>[] = [
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "60 min" },
];
const plans: SegmentedOption<string>[] = [
  {
    value: "year",
    label: "Yearly",
    detail: "$599 per year",
    badge: "Save $109",
  },
  { value: "month", label: "Monthly", detail: "$59 per month" },
];
/** The adult start ladder (features/me/OwnStartScreen.tsx). */
const roles: SegmentedOption<string>[] = [
  { value: "parent", label: "Parent" },
  { value: "teacher", label: "Teacher" },
  { value: "tutor", label: "Tutor" },
  { value: "myself", label: "Myself" },
];

function SegmentedSection() {
  return (
    <Section
      id="segmented"
      title="Segmented control"
      source={["ui/Segmented.tsx", "ui/Segmented.module.css"]}
    >
      <Specimen label="Regular, with detail and a badge" wide>
        <Live initial={"year" as string | null}>
          {(value, set) => (
            <Segmented
              label="Plan"
              options={plans}
              value={value}
              onChange={set}
            />
          )}
        </Live>
      </Specimen>
      <Specimen label="Nothing chosen yet">
        <Live initial={null as string | null}>
          {(value, set) => (
            <Segmented
              label="Plan"
              options={plans}
              value={value}
              onChange={set}
            />
          )}
        </Live>
      </Specimen>
      <Specimen label="Compact">
        <Live initial={"45" as string | null}>
          {(value, set) => (
            <Segmented
              label="Minutes"
              options={minutes}
              value={value}
              onChange={set}
              compact
            />
          )}
        </Live>
      </Specimen>
      <Specimen label="Compact and dense (a toolbar)">
        <Live initial={"45" as string | null}>
          {(value, set) => (
            <Segmented
              label="Minutes"
              options={minutes}
              value={value}
              onChange={set}
              compact
              dense
            />
          )}
        </Live>
      </Specimen>
      <Specimen label="Compact, four longer names (two rows on a phone)">
        <Live initial={"parent" as string | null}>
          {(value, set) => (
            <Segmented
              label="Role"
              options={roles}
              value={value}
              onChange={set}
              compact
            />
          )}
        </Live>
      </Specimen>
      <Specimen label="Disabled">
        <Segmented
          label="Minutes"
          options={minutes}
          value="30"
          onChange={() => {}}
          compact
          disabled
        />
      </Specimen>
    </Section>
  );
}

function StepperSection() {
  return (
    <Section
      id="stepper"
      title="Stepper"
      source={["ui/Stepper.tsx", "ui/Stepper.module.css"]}
    >
      <Specimen label="In range">
        <Live initial={3}>
          {(value, set) => (
            <Stepper
              label="Children"
              value={value}
              onChange={set}
              min={1}
              max={12}
            />
          )}
        </Live>
      </Specimen>
      <Specimen label="At the minimum">
        <Live initial={1}>
          {(value, set) => (
            <Stepper
              label="Children"
              value={value}
              onChange={set}
              min={1}
              max={12}
            />
          )}
        </Live>
      </Specimen>
      <Specimen label="At the maximum, formatted">
        <Live initial={1000}>
          {(value, set) => (
            <Stepper
              label="Seats"
              value={value}
              onChange={set}
              min={10}
              max={1000}
              step={10}
              format={(seats) => seats.toLocaleString("en-US")}
            />
          )}
        </Live>
      </Specimen>
      <Specimen label="Label hidden (named by its row)">
        <Live initial={45}>
          {(value, set) => (
            <Stepper
              label="Minutes a day"
              value={value}
              onChange={set}
              min={5}
              max={120}
              step={5}
              format={(n) => `${n} min`}
              hideLabel
            />
          )}
        </Live>
      </Specimen>
    </Section>
  );
}

const areas = [
  { value: "number", label: "Numbers" },
  { value: "fractions", label: "Fractions" },
  { value: "measurement", label: "Measurement" },
  { value: "geometry", label: "Geometry" },
  { value: "data", label: "Data" },
  { value: "algebra", label: "Algebra" },
];
const learners = [
  { value: "ada", label: "Ada", detail: "Grade 4 · 212 answers" },
  { value: "ben", label: "Ben", detail: "Grade 2" },
  {
    value: "esperanza",
    label: "Esperanza Villanueva-Castellanos",
    detail: "Algebra 1 · her own practice",
  },
];

function ChoiceSection() {
  return (
    <Section
      id="choices"
      title="Chips, checkboxes, lists and pickers"
      source={[
        "ui/Chips.tsx",
        "ui/Checkbox.tsx",
        "ui/Listbox.tsx",
        "ui/Select.tsx",
        "ui/DatePicker.tsx",
        "ui/Menu.tsx",
      ]}
    >
      <Specimen label="Chips (several choices)" wide>
        <Live initial={["fractions", "geometry"] as string[]}>
          {(value, set) => (
            <Chips label="Areas" options={areas} value={value} onChange={set} />
          )}
        </Live>
      </Specimen>
      <Specimen label="Chips, disabled">
        <Chips
          label="Areas"
          options={areas.slice(0, 3)}
          value={["number"]}
          onChange={() => {}}
          disabled
        />
      </Specimen>
      <Specimen label="Checkbox rows">
        <div className={styles.column}>
          <Live initial={true}>
            {(value, set) => (
              <Checkbox checked={value} onChange={set}>
                Include today's idea
              </Checkbox>
            )}
          </Live>
          <Live initial={false}>
            {(value, set) => (
              <Checkbox checked={value} onChange={set}>
                I am this child's parent or legal guardian, and I agree to AMP's
                collection of the information described in the notice.
              </Checkbox>
            )}
          </Live>
          <Checkbox checked={false} onChange={() => {}} disabled>
            Disabled
          </Checkbox>
        </div>
      </Specimen>
      <Specimen label="Listbox (three or fewer choices in view)">
        <Live initial={"ada" as string | null}>
          {(value, set) => (
            <ChoicePicker
              label="Learner"
              options={learners}
              value={value}
              onChange={set}
            />
          )}
        </Live>
      </Specimen>
      <Specimen label="Listbox behind a button">
        <Live initial={null as string | null}>
          {(value, set) => (
            <ListboxDisclosure
              label="Learner"
              options={learners}
              value={value}
              onChange={set}
              placeholder="Choose a learner"
            />
          )}
        </Live>
      </Specimen>
      <Specimen label="Listbox, plain">
        <Live initial={"ben" as string | null}>
          {(value, set) => (
            <Listbox
              label="Learner"
              options={learners}
              value={value}
              onChange={set}
            />
          )}
        </Live>
      </Specimen>
      <Specimen label="Select (opens a sheet of options)">
        <Live initial={"30"}>
          {(value, set) => (
            <Select aria-label="Minutes" value={value} onValueChange={set}>
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">60 minutes</option>
            </Select>
          )}
        </Live>
      </Specimen>
      <Specimen label="Birth year picker">
        <Live initial={""}>
          {(value, set) => <BirthYearPicker value={value} onChange={set} />}
        </Live>
      </Specimen>
      <Specimen label="Select, disabled">
        <Select aria-label="Minutes" value="45" disabled>
          <option value="45">45 minutes</option>
        </Select>
      </Specimen>
      <Specimen label="Date picker">
        <Live initial={"2026-11-10"}>
          {(value, set) => (
            <DatePicker label="First day" value={value} onChange={set} />
          )}
        </Live>
      </Specimen>
      <Specimen label="Date picker, empty with an error">
        <Live initial={""}>
          {(value, set) => (
            <DatePicker
              label="Last day"
              value={value}
              onChange={set}
              error="Choose the last day of the term."
            />
          )}
        </Live>
      </Specimen>
      <Specimen label="Menu">
        <Menu label="Showing Overall" align="start">
          <MenuLabel>Strand</MenuLabel>
          <MenuItem onSelect={() => {}}>Overall</MenuItem>
          <MenuItem onSelect={() => {}}>Operations</MenuItem>
          <MenuItem onSelect={() => {}}>Fractions</MenuItem>
          <MenuItem onSelect={() => {}} disabled>
            Geometry (no work yet)
          </MenuItem>
        </Menu>
      </Specimen>
    </Section>
  );
}

function FieldSection() {
  return (
    <Section
      id="fields"
      title="Text fields and search"
      source={[
        "ui/TextField.tsx",
        "ui/Controls.module.css",
        "ui/SearchField.tsx",
      ]}
    >
      <Specimen label="Text field">
        <Live initial={"Ada"}>
          {(value, set) => (
            <TextField
              label="Nickname"
              value={value}
              onChange={(event) => set(event.target.value)}
            />
          )}
        </Live>
      </Specimen>
      <Specimen label="With an error">
        <TextField
          label="Email"
          defaultValue="parent@example"
          error="Enter an email address with a domain, like name@example.com."
        />
      </Specimen>
      <Specimen label="Empty with a placeholder">
        <TextField label="School name" placeholder="Maple Grove" />
      </Specimen>
      <Specimen label="Disabled">
        <TextField label="Class code" value="K7M-24Q" disabled readOnly />
      </Specimen>
      <Specimen label="Text area with its count" wide>
        <Live
          initial={
            "The fraction model on problem 3 shows quarters, but the question asks about eighths."
          }
        >
          {(value, set) => (
            <TextArea
              label="What's wrong with this problem?"
              maxLength={500}
              value={value}
              onChange={(event) => set(event.target.value)}
            />
          )}
        </Live>
      </Specimen>
      <Specimen label="Search, empty">
        <Live initial={""}>
          {(value, set) => (
            <SearchField
              label="Search students"
              value={value}
              onChange={set}
              placeholder="Name or ID"
            />
          )}
        </Live>
      </Specimen>
      <Specimen label="Search, typed (clear button)">
        <Live initial={"Villanueva"}>
          {(value, set) => (
            <SearchField label="Search students" value={value} onChange={set} />
          )}
        </Live>
      </Specimen>
    </Section>
  );
}

/** Every input-like control in one row, so one field style can be judged:
 * the same surface, edge, radius, height and placeholder (tokens.css
 * --field-*). */
function FieldFamilySection() {
  return (
    <Section
      id="field-family"
      title="One field style"
      source={[
        "ui/tokens.css (--field-*)",
        "ui/Controls.module.css",
        "ui/YearField.tsx",
        "ui/Listbox.module.css",
        "ui/Stepper.module.css",
        "ui/SearchField.module.css",
      ]}
      note="A text field, a year, a picker, a stepper and a search side by side: one surface, one edge, one height."
    >
      <Specimen label="A child's row" wide>
        <Live initial={{ name: "", year: "" }}>
          {(value, set) => (
            <div className={styles.fieldRow}>
              <TextField
                label="Name"
                placeholder="Child 1"
                value={value.name}
                onChange={(event) =>
                  set({ ...value, name: event.target.value })
                }
              />
              <label className={styles.fieldLabelled}>
                <span>Birth year</span>
                <YearField
                  label="Birth year, Child 1"
                  value={value.year}
                  onChange={(year) => set({ ...value, year })}
                />
              </label>
            </div>
          )}
        </Live>
      </Specimen>
      <Specimen label="A missing year, asked for">
        <YearField
          label="Birth year, Child 2"
          value=""
          invalid
          onChange={() => undefined}
        />
      </Specimen>
      <Specimen label="Picker">
        <Live initial={"all"}>
          {(value, set) => (
            <ListboxDisclosure
              label="Math area"
              value={value}
              onChange={(next) => set(next || "all")}
              options={[
                { value: "all", label: "Every math area" },
                { value: "fractions", label: "Fractions" },
              ]}
            />
          )}
        </Live>
      </Specimen>
      <Specimen label="Stepper">
        <Live initial={60}>
          {(value, set) => (
            <Stepper
              label="Weekly target"
              value={value}
              onChange={set}
              min={10}
              max={300}
              step={10}
            />
          )}
        </Live>
      </Specimen>
    </Section>
  );
}

/** One choice among equal tiles (ui/TileChoice): birth years and grades. */
function TileSection() {
  const now = new Date().getFullYear();
  return (
    <Section
      id="tiles"
      title="Tile choice"
      source={["ui/TileChoice.tsx", "ui/TileChoice.module.css"]}
      note="Paper tiles, the chosen one filled. One tab stop; arrows, Home and End move the choice. An optional choice clears with a second tap."
    >
      <Specimen label="Birth years, with Adult" wide>
        <Live<number | null> initial={null}>
          {(value, set) => (
            <TileChoice
              label="Birth year"
              tiles={[
                ...Array.from({ length: 16 }, (_, i) => ({
                  value: now - 4 - i,
                  label: String(now - 4 - i),
                })),
                { value: now - 25, label: "Adult", span: "row" as const },
              ]}
              value={value}
              onChange={set}
            />
          )}
        </Live>
      </Specimen>
      <Specimen label="Grades, optional (tap again to clear)" wide>
        <Live<number | null> initial={4}>
          {(value, set) => (
            <TileChoice
              label="Grade"
              clearable
              tiles={[
                { value: 0, label: "K", name: "Kindergarten" },
                ...Array.from({ length: 12 }, (_, i) => ({
                  value: i + 1,
                  label: String(i + 1),
                })),
                { value: 13, label: "College", span: 2 as const },
              ]}
              value={value}
              onChange={set}
              columns={{ narrow: 5, wide: 7 }}
            />
          )}
        </Live>
      </Specimen>
    </Section>
  );
}

export function ControlSections() {
  return (
    <>
      <FieldFamilySection />
      <TileSection />
      <ButtonSection />
      <SegmentedSection />
      <StepperSection />
      <ChoiceSection />
      <FieldSection />
    </>
  );
}
