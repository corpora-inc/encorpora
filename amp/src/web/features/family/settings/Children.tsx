import { useRouterState } from "@tanstack/react-router";
import { buttonClass } from "../../../ui/Button";
import { ColumnList, ColumnRow, type Column } from "../../../ui/ColumnList";
import { PageSection } from "../../../ui/PageSection";
import { sheetOf, useSheet, useSheetNav } from "../../../nav/sheet";
import { PayLink } from "../../pay/link";
import { AddChildrenSheet } from "../AddChildren";
import { AddAction } from "../TutoringGroup";
import type { FamilyChild } from "../api";
import { accessUntil } from "../access";
import { ChildSettingsSheet } from "../Child";
import type { FamilyPlace } from "../FamilyFrame";
import styles from "../Family.module.css";
import people from "../../school/classes/people/People.module.css";

/** The sheet a child's row opens (nav/sheet.ts). */
export const childSheet = (learner: string) => `child:${learner}`;

/** A child's line under their name: born, and their access or free
 * problems left. */
export function childMeta(child: FamilyChild): string {
  const born = child.birthYear
    ? `Born ${child.birthYear}`
    : "Birth year not set";
  if (child.access.hasAccess) {
    const until = accessUntil(child);
    return until ? `${born} · Active through ${until}` : `${born} · Active`;
  }
  const left = child.access.freeAllowance.problems.remaining;
  return `${born} · ${left} free ${left === 1 ? "problem" : "problems"} left`;
}

const COLUMNS: Column[] = [
  { key: "name", track: "minmax(0, 1fr)", part: "title" },
  { key: "meta", track: "minmax(0, 1.4fr)" },
  { key: "action", track: "auto", part: "action" },
];

/**
 * Settings › Children (the IA v2 spec, §3.1): a row a child, each opening
 * that child's settings in a sheet over Settings (founder, 2026-11-16), and
 * for the parent who buys, Continue with AMP beside a child whose free
 * problems are used, opening Pay over Settings. Adding a child is a sheet
 * too: consent is never asked first.
 */
export function ChildrenSection({ place }: { place: FamilyPlace }) {
  const { data } = place;
  const children = data?.children ?? [];
  const sheets = useSheetNav();
  const open = useRouterState({
    select: (state) => sheetOf(state.location.state),
  });
  const adding = useSheet("add-children");
  const add = !!data?.capabilities.addChildren;
  const shown = children.find((child) => open === childSheet(child.id));
  return (
    <PageSection
      title="Children"
      titleId="family-children"
      data-settings-children=""
    >
      {children.length ? (
        <ColumnList label="Children" columns={COLUMNS} data-settings-kids="">
          {children.map((child) => (
            <ColumnRow
              key={child.id}
              data-settings-child={child.id}
              cells={{
                name: (
                  <button
                    type="button"
                    className={styles.kidName}
                    aria-label={`${child.name}’s settings`}
                    data-child-settings-open={child.id}
                    onClick={() => sheets.show(childSheet(child.id))}
                  >
                    {child.name}
                    <svg viewBox="0 0 12 12" aria-hidden="true">
                      <path d="m4.5 2.5 3.5 3.5-3.5 3.5" />
                    </svg>
                  </button>
                ),
                meta: (
                  <span className={styles.footnote}>{childMeta(child)}</span>
                ),
                action:
                  child.capabilities.continuePurchase &&
                  !child.access.hasAccess &&
                  child.access.freeAllowance.problems.remaining === 0 ? (
                    <PayLink
                      learnerId={child.id}
                      className={buttonClass("primary")}
                      data-continue={child.id}
                    >
                      Continue with AMP
                    </PayLink>
                  ) : undefined,
              }}
            />
          ))}
        </ColumnList>
      ) : (
        <p className={styles.footnote}>No children yet.</p>
      )}
      {add && (
        <div className={people.actions}>
          <AddAction onClick={adding.show}>Add a child</AddAction>
        </div>
      )}
      {shown && (
        <ChildSettingsSheet
          place={place}
          child={shown}
          open
          onOpenChange={(next) => {
            if (!next) sheets.close(childSheet(shown.id));
          }}
        />
      )}
      {add && (
        <AddChildrenSheet
          open={adding.open}
          onOpenChange={adding.onOpenChange}
        />
      )}
    </PageSection>
  );
}
