import { AccountSections } from "../../account/AccountSections";
import { FamilyFrame, useFamilyPlace } from "../FamilyFrame";
import styles from "../Family.module.css";
import { ChildrenSection } from "./Children";
import { DevicesSection } from "./Devices";
import { PeopleSection } from "./People";
import { SchoolYearPart } from "./SchoolYear";

/**
 * A family's Settings (`/family/<family>/settings`, the IA v2 spec, §3): the
 * family's one settings hub, one page. Children (where per-child pay is),
 * then Plan, People, School year, Devices, and Privacy and Account last,
 * one row each. Every row opens an overlay over this page, a sheet in
 * history state or a routed overlay under its address, and nothing here
 * navigates away, except a child's Progress and the tutoring group, which
 * are other places. A section shows only where the reader has something in
 * it: a second parent sees the read-only set.
 */
export function FamilySettingsScreen() {
  const place = useFamilyPlace();
  const { data } = place;
  return (
    <FamilyFrame place={place} title="Settings">
      {data && (
        <div className={styles.page} data-family-settings="">
          <ChildrenSection place={place} />
          <AccountSections
            plan={
              data.capabilities.manageBilling
                ? { kind: "manage" }
                : data.role === "second-parent"
                  ? { kind: "note", holder: data.holderName }
                  : null
            }
            consent={data.capabilities.manageConsent}
            part="plan"
          />
          <PeopleSection place={place} />
          <SchoolYearPart place={place} />
          <DevicesSection place={place} />
          <AccountSections plan={null} part="rest" />
        </div>
      )}
    </FamilyFrame>
  );
}
