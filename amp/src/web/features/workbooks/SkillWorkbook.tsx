import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { skillCatalogOptions, useLearningView } from "../../lib/learning-view";
import { workbookDay } from "../../nav/entities";
import { EntityLink } from "../../nav/links";
import { buttonClass } from "../../ui/Button";
import { familyOptions } from "../family/api";
import { practiceChild, type OpenedFor } from "../practice/CurriculumPractice";
import { addressedIdentity, familyOf } from "../spaces/identity";
import { changeWorkbookDay, workbookDayKey } from "./draft-store";
import { canMakeWorkbook, defaultWorkbookChoices, localDate } from "./model";
import { warmWorkbookLayer } from "./WorkbookLayerSlot";

/** How a workbook opened from a skill starts: the shortest length, and the
 * skill's problems alone, so its first page is the worksheet itself (its
 * title, the skill's name and the first problems). The maker's Length and
 * Today's idea change either. (A lesson card takes a page of its own, so
 * with Today's idea the first page holds only the title.) */
const HELD_MINUTES = 30;
const HELD_LESSON = false;

/**
 * "Workbook", beside Practice in a skill's layer: a printable workbook held
 * to that one skill, for the learner the layer is about.
 *
 * It opens the workbook maker (today's workbook, WorkbookDayScreen.tsx) with
 * the workbook already composed from that skill alone: the one way a
 * workbook is made. Download there saves it, as any workbook, and it joins
 * the learner's workbooks. The maker opens as a layer over this one
 * (nav/LayerHost.tsx, `workbook`), so the screen behind stays the screen
 * the skill was opened on, and closing the maker comes back to this layer.
 * The layer names the learner and the day; that the workbook is held to
 * this skill is the day's draft (draft-store.ts), set as the link is
 * followed.
 *
 * Whose it is follows Practice (CurriculumPractice.tsx `practiceChild`): on
 * a family's screen, the child the layer was opened for or the page names;
 * where it names no child, and in own practice, the adult's own.
 *
 * Offered only where the maker would make one, by the maker's own rules
 * (model.ts `canMakeWorkbook`: learning allowed, and access or a free
 * workbook left; a child's by a parent who reads their workbooks), and only
 * for a skill with a problem type that prints. Otherwise nothing: never a
 * control that leads to a refusal. A class's workbooks are its own tab's.
 */
export function SkillWorkbook({
  skill,
  opened,
}: {
  skill: string;
  /** Whose the layer is, where its stack says (nav/LayerHost.tsx). */
  opened?: OpenedFor;
}) {
  const { pathname } = useLocation();
  const family = familyOf(pathname);
  const view = useLearningView({ records: false });
  const session = view.session.data ?? null;
  const client = useQueryClient();
  const catalog = useQuery(skillCatalogOptions);
  // (The family's own guard: a parent's session, and a family named.)
  const household = useQuery(
    familyOptions(session ?? { accountId: "", token: "" }, family ?? ""),
  ).data;
  const offer = (() => {
    if (!session || !view.account || pathname.startsWith("/school/"))
      return null;
    if (!catalog.data?.skills.find((entry) => entry.id === skill)?.printable)
      return null;
    // Whose: a family's child, else the adult's own learner.
    let child: { id: string; name: string } | undefined;
    let learnerId: string | undefined;
    if (family) {
      const children = household?.familyId === family ? household.children : [];
      const named = practiceChild(children, {
        ...opened,
        addressed: addressedIdentity(pathname)?.id,
      });
      // An id that isn't one of the family's own children: nothing.
      if (named === null) return null;
      if (named) {
        if (!named.capabilities.readWorkbooks) return null;
        child = named;
        learnerId = named.id;
      } else learnerId = view.account.adultPractice?.learner?.id;
    } else if (view.ownPractice && !view.profile) learnerId = view.learner?.id;
    // The learner as their workbooks know them (WorkbookFrame.tsx).
    const learner = view.account.family.learners.find(
      (entry) => entry.id === learnerId && !entry.deletedAt,
    );
    if (!learner || !canMakeWorkbook(learner)) return null;
    return { session, child, learner: learner.id };
  })();
  const date = localDate();
  // The maker's code and the day's reads, while the control is on view: the
  // layer opens whole.
  const learner = offer?.learner;
  const reader = offer?.session;
  useEffect(() => {
    if (reader && learner) warmWorkbookLayer(client, reader, learner, date);
  }, [client, reader, learner, date]);
  if (!offer || !learner) return null;
  const { child } = offer;
  return (
    <EntityLink
      entity={workbookDay(learner, date)}
      className={buttonClass("secondary")}
      aria-label={child ? `Workbook for ${child.name}` : undefined}
      data-skill-workbook={skill}
      data-workbook-for={child ? child.id : "self"}
      // The day opens on a new workbook held to this skill.
      onClick={() =>
        changeWorkbookDay(
          workbookDayKey(offer.session.accountId, learner, date),
          {
            draft: crypto.randomUUID(),
            number: undefined,
            minutes: HELD_MINUTES,
            choices: {
              ...defaultWorkbookChoices,
              lesson: HELD_LESSON,
              skills: [skill],
            },
          },
        )
      }
    >
      Workbook
    </EntityLink>
  );
}
