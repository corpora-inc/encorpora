import { FocusDialog } from "../../../PracticeWorkspace";
import { Avatar } from "../../../ui/Avatar";
import { Button } from "../../../ui/Button";
import { Dialog } from "../../../ui/Dialog";
import { Sheet } from "../../../ui/Sheet";
import { TextField } from "../../../ui/TextField";
import { WorkList } from "../../school/classes/teacher-shared";
import { record } from "../fixtures";
import { Section, SpecimenFrame } from "../Gallery";
import { Backdrop } from "./states";
import styles from "../Design.module.css";

export function OverlaySections() {
  return (
    <Section
      id="overlays"
      title="Sheets and dialogs"
      source={[
        "ui/Sheet.tsx",
        "ui/Dialog.tsx",
        "PracticeWorkspace.tsx (FocusDialog)",
      ]}
      note="Three modal surfaces with three styles today; see docs/components.md."
    >
      <SpecimenFrame specimen="sheet" label="Sheet: detail beside the work" />
      <SpecimenFrame
        specimen="sheet-form"
        label="Sheet with a form and actions"
      />
      <SpecimenFrame specimen="dialog" label="Dialog: a reading sheet" />
      <SpecimenFrame
        specimen="focus-dialog"
        label="Focus dialog (practice's panels)"
      />
    </Section>
  );
}

const noop = () => {};

export const overlaySpecimens = {
  sheet: () => (
    <>
      <Backdrop />
      <Sheet
        open
        onOpenChange={noop}
        title="Ada Okafor"
        description="Grade 4 · Room 4B"
        lead={<Avatar name="Ada Okafor" size="large" />}
      >
        <div data-dense>
          <WorkList work={record.work} />
        </div>
      </Sheet>
    </>
  ),
  "sheet-form": () => (
    <>
      <Backdrop />
      <Sheet open onOpenChange={noop} title="Invite a co-teacher">
        <div className={styles.column}>
          <p className={styles.text}>
            They see this class and can hand a device to a child. They can’t
            add children from other families or buy access.
          </p>
          <TextField
            label="Email"
            defaultValue="sam@example"
            error="Enter an email address with a domain, like name@example.com."
          />
          <Button variant="primary">Send invitation</Button>
        </div>
      </Sheet>
    </>
  ),
  dialog: () => (
    <>
      <Backdrop />
      <Dialog open onOpenChange={noop} title="Where you are">
        <p>
          Dots show estimates; bands show uncertainty. Vertical marks show the
          age reference. Striped bands mark areas not practiced yet.
        </p>
        <p>
          Grades describe each skill’s curriculum placement, not your
          estimated level.
        </p>
      </Dialog>
    </>
  ),
  "focus-dialog": () => (
    <>
      <Backdrop />
      <FocusDialog title="Hint" close={noop}>
        <p>
          Each tray holds the same number of muffins. What operation joins
          equal groups?
        </p>
      </FocusDialog>
    </>
  ),
};
