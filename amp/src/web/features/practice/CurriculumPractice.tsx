import {
  addressedIdentity,
  familyOf,
  practiceParams,
} from "../spaces/identity";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { strandNames } from "../../BirthYearPrompt";
import { skillCatalogOptions, useLearningView } from "../../lib/learning-view";
import { useSession } from "../../lib/session";
import { Button, buttonClass } from "../../ui/Button";
import { familyOptions } from "../family/api";
import { useHandOver } from "../school/classes/today/use-hand-over";
import type { PracticeFilter } from "./curriculum-filter";

export function PracticeLabel() {
  return (
    <>
      Practice <span aria-hidden="true">›</span>
    </>
  );
}

/**
 * Whose curriculum a control sits in, where the address alone doesn't say:
 * the learner its layer was opened for (a child's block on a family's
 * Today, `?for=`, nav/entities.ts), or the roster person whose answer it
 * was opened over.
 */
export type OpenedFor = { learner?: string; person?: string };

type Named = OpenedFor & {
  /** The child the page's own address names (`/family/<f>/kids/<child>`). */
  addressed?: string;
};
type OwnChild = {
  id: string;
  classes: readonly { personId: string }[];
};

/**
 * The family's child a practice control on a family's screen starts, from
 * what names them, nearest first: the answer it was opened over, the
 * learner its layer was opened for, the page's own child. Null when the one
 * named isn't the family's own child (an id from an edited address): no
 * control. Undefined when nobody is named: nobody's child, so the adult's
 * own practice. Never the learner last selected on this device. Pure.
 */
export function practiceChild<Child extends OwnChild>(
  children: readonly Child[],
  named: Named,
): Child | null | undefined {
  if (named.person)
    return (
      children.find((child) =>
        child.classes.some((entry) => entry.personId === named.person),
      ) ?? null
    );
  const id = named.learner ?? named.addressed;
  if (!id) return undefined;
  return children.find((child) => child.id === id) ?? null;
}

/** What the control practices, for its name: the problem type, the skill
 * or the area's title. Nothing for mixed practice, or while titles load. */
function useFocusTitle(filter: PracticeFilter, enabled: boolean) {
  const catalog = useQuery({ ...skillCatalogOptions, enabled });
  if (filter.template)
    return catalog.data?.templates.find((type) => type.id === filter.template)
      ?.title;
  if (filter.skill)
    return catalog.data?.skills.find((skill) => skill.id === filter.skill)
      ?.title;
  return filter.strand ? strandNames[filter.strand] : undefined;
}

/**
 * Practice from the curriculum: an area, a skill or a problem type.
 *
 * On a family's screen it is for the child the control is about: the one
 * its layer was opened for or whose answer it sits over (`opened`), else
 * the page's own child. It starts as that child's own Practice button does
 * (the hand-over: their session, their record), held to this filter. Where
 * a family's screen names no child, it is the adult's own. A learner's own
 * session starts directly. In a school or class nobody answers as a
 * student.
 */
export function CurriculumPractice({
  filter,
  opened,
}: {
  filter: PracticeFilter;
  opened?: OpenedFor;
}) {
  const location = useLocation();
  const family = familyOf(location.pathname);
  const view = useLearningView({ records: false });
  if (family)
    return view.session.data ? (
      <FamilyPractice
        family={family}
        named={{
          ...opened,
          addressed: addressedIdentity(location.pathname)?.id,
        }}
        // A layer on a screen that shows several children names its skill.
        detailed={!!opened}
        own={view.account?.adultPractice?.learner?.id}
        filter={filter}
      />
    ) : null;
  // A class record is not permission to answer as one of its students.
  if (
    location.pathname.startsWith("/school/") ||
    !view.canPractice ||
    view.viewOnly
  )
    return null;
  // Practice held to this area, skill or type, at its own address.
  if (!view.learner) return null;
  return (
    <Link
      to="/$"
      params={practiceParams(view.learner.id, filter)}
      className={buttonClass("primary")}
      data-curriculum-practice
    >
      <PracticeLabel />
    </Link>
  );
}

function FamilyPractice({
  family,
  named,
  detailed,
  own,
  filter,
}: {
  family: string;
  named: Named;
  detailed: boolean;
  /** The adult's own learner, once they practice themselves. */
  own: string | undefined;
  filter: PracticeFilter;
}) {
  const session = useSession();
  const location = useLocation();
  const data = useQuery(familyOptions(session, family)).data;
  const { handOver, starting, error } = useHandOver(session);
  const focus = useFocusTitle(filter, detailed);
  // Only this family's own children, whatever the address names.
  const children = data?.familyId === family ? data.children : [];
  const child = practiceChild(children, named);
  // Nobody's child: the adult's own practice, as their row on Today.
  if (child === undefined)
    return own ? (
      <Link
        to="/$"
        params={practiceParams(own, filter)}
        className={buttonClass("primary")}
        aria-label={focus ? `Practice ${focus} as yourself` : undefined}
        data-curriculum-practice
        data-practice-for="self"
      >
        <PracticeLabel />
      </Link>
    ) : null;
  // The same permissions as the child's own row: never a button that fails.
  if (!child?.capabilities.practiceHere || !child.access.canPractice)
    return null;
  return (
    <div
      data-curriculum-practice
      data-practice-for={child.id}
      // In a layer over a screen of several children the control fills the
      // sheet's column, as the link it took the place of did.
      style={detailed ? { display: "grid" } : undefined}
    >
      <Button
        variant="primary"
        aria-label={
          detailed && focus
            ? `Practice ${focus} with ${child.name}`
            : `Practice with ${child.name}`
        }
        aria-busy={!!starting || undefined}
        onClick={() => {
          if (!starting) void handOver(child.id, filter, location.href);
        }}
      >
        <PracticeLabel />
      </Button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
