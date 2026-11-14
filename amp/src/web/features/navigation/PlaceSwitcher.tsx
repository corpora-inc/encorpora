import { familyPlacesOptions } from "../family/api";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { SignedInMe } from "../../../account/contracts";
import { useLearnerStore } from "../../learner-store";
import { sessionOptions } from "../../lib/query";
import { Menu, MenuItem, MenuLabel } from "../../ui/Menu";
import { rememberPlace } from "../onboarding/place-memory";
import { DemoMark } from "../school/demo/DemoMark";
import {
  currentPlace,
  FIRST_PAGE,
  placeGroups,
  placesOptions,
  type PlaceEntry,
  type PlaceGroup,
} from "../spaces/places";
import { appReturn } from "../spaces/returns";
import styles from "./PlaceSwitcher.module.css";

export type { PlaceEntry } from "../spaces/places";

/** Every place this account can open, grouped by space, from one bounded
 * request (no request per school or class). */
export function usePlaces(me: SignedInMe | null) {
  const session = useQuery(sessionOptions).data;
  const staff =
    !!me &&
    me.account.kind !== "student" &&
    !!session &&
    !session.accountId.startsWith("school:") &&
    !!me.staffOf?.length;
  const places = useQuery({
    ...placesOptions(session ?? { accountId: "", token: "" }),
    enabled: staff,
    refetchOnMount: false,
  });
  const adult =
    !!me &&
    me.account.kind !== "student" &&
    !!session &&
    !session.accountId.startsWith("school:");
  const families = useQuery({
    ...familyPlacesOptions(session ?? { accountId: "", token: "" }),
    enabled: adult,
    refetchOnMount: false,
  });
  if (places.isError) console.warn("Your places did not load", places.error);
  if (families.isError)
    console.warn("Your families did not load", families.error);
  return {
    groups:
      me && me.account.kind !== "student"
        ? placeGroups(
            me,
            staff ? (places.data ?? null) : null,
            adult ? (families.data ?? null) : null,
          )
        : [],
    more: places.data?.more === true,
    loading: (staff && places.isLoading) || (adult && families.isLoading),
  };
}

/** The places of an account without the places read: its family, its own
 * practice and the schools `/me` names. For a screen outside the frame. */
export function placeEntries(me: SignedInMe): PlaceEntry[] {
  return placeGroups(me, null).flatMap((group) => group.entries);
}

/** Choosing a place chooses its learner: the adult's own for their
 * practice, one of the family's children for a family (unless one already
 * is), and nobody for a class or school, where no learner belongs. */
export function choosePlaceLearner(me: SignedInMe, place: PlaceEntry["id"]) {
  const store = useLearnerStore.getState();
  const own = me.adultPractice?.learner?.id ?? null;
  const shared = /^family:(.+)$/.exec(place)?.[1];
  const children =
    place === "home"
      ? me.learners
      : shared
        ? (me.secondParentOf?.find((family) => family.orgId === shared)
            ?.learners ?? [])
        : null;
  if (place === "me") {
    if (own) store.select(own);
  } else if (children) {
    if (!children.some((learner) => learner.id === store.learnerId))
      store.select(children[0]?.id ?? null);
  } else if (
    place.startsWith("school:") ||
    place.startsWith("class:") ||
    place.startsWith("group:")
  )
    store.select(null);
}

/** What "Add a place" can still add: never a place the account has. */
function addPlaceDetail(me: SignedInMe) {
  const options = [
    ...(me.adultPractice?.learner ? [] : ["your own practice"]),
    ...(me.familyClass || me.learners.length ? [] : ["a family"]),
    "a class",
  ];
  const text =
    options.length > 1
      ? `${options.slice(0, -1).join(", ")} or ${options.at(-1)}`
      : options[0]!;
  return text[0]!.toUpperCase() + text.slice(1);
}

/**
 * The one way between the places a person works, grouped as Family,
 * Teaching and My practice, the current one marked. It lists only places
 * this account can open, each with its role, then "Add a place" (the
 * starter). Choosing one lands on that place's home, chooses its learner,
 * and remembers it, so `/` opens there next time; nothing else follows them.
 */
export function PlaceSwitcher({
  me,
  current,
  label,
  onNavigate,
  groups: given,
  more = false,
}: {
  me: SignedInMe;
  /** The place on screen now (`SpaceDescriptor.place`). */
  current: string | null;
  groups?: PlaceGroup[];
  /** The places read stopped at its limit: `/school` lists them all. */
  more?: boolean;
  /** The trigger's text when the screen isn't one of the places (a class
   * this admin doesn't teach, a school below their district). */
  label?: string;
  onNavigate?: () => void;
}) {
  const navigate = useNavigate();
  // Where "Add a place" returns: a place, never a link's secret
  // (features/spaces/returns.ts).
  const origin = appReturn(
    useLocation({ select: (location) => location.href }),
  );
  const [expanded, setExpanded] = useState(false);
  const groups = given ?? placeGroups(me, null);
  const all = groups.flatMap((group) => group.entries);
  // One place still shows the menu: it is where another place is added.
  if (!all.length) return null;
  const here = currentPlace(groups, current);
  const name = here?.name ?? label ?? "Your places";
  const choose = (place: PlaceEntry) => {
    if (place.id === here?.id) return;
    choosePlaceLearner(me, place.id);
    // A place `/` can return to; starting or trying a level is a step.
    if (place.id === "home" || (place.id === "me" && place.path === "me"))
      rememberPlace(me.account.id, place.id);
    else if (place.id.startsWith("school:"))
      rememberPlace(me.account.id, place.id as `school:${string}`);
    else if (place.id.startsWith("family:"))
      rememberPlace(me.account.id, `school:${place.id.slice(7)}`);
    onNavigate?.();
    void navigate(
      place.path ? { to: "/$", params: { _splat: place.path } } : { to: "/" },
    );
  };
  return (
    <Menu
      align="start"
      aria-label={`${name}: switch place`}
      triggerClassName={styles.trigger}
      label={
        <span className={styles.triggerLabel}>
          <span className={styles.triggerText} title={name}>
            {name}
          </span>
          {here?.demo && <DemoMark />}
        </span>
      }
    >
      {groups.map((group) => {
        const cut =
          group.id === "teaching" &&
          !expanded &&
          group.entries.length > FIRST_PAGE + 1;
        // The open place always shows, even past the first page.
        const shown = cut
          ? group.entries.filter(
              (entry, index) => index < FIRST_PAGE || entry.id === here?.id,
            )
          : group.entries;
        return [
          <MenuLabel key={`${group.id}-label`}>{group.label}</MenuLabel>,
          ...shown.map((place) => (
            <MenuItem key={place.id} onSelect={() => choose(place)}>
              <PlaceRow place={place} here={place.id === here?.id} />
            </MenuItem>
          )),
          ...(cut
            ? [
                <MenuItem
                  key={`${group.id}-more`}
                  onSelect={(event) => {
                    event.preventDefault();
                    setExpanded(true);
                  }}
                >
                  <span className={styles.item} data-place="more">
                    <span className={styles.name}>More places</span>
                    <span className={styles.detail}>
                      {group.entries.length - shown.length} more
                    </span>
                  </span>
                </MenuItem>,
              ]
            : []),
          ...(group.id === "teaching" && more && (expanded || !cut)
            ? [
                <MenuItem
                  key="all-schools"
                  onSelect={() => {
                    onNavigate?.();
                    void navigate({ to: "/$", params: { _splat: "school" } });
                  }}
                >
                  <span className={styles.item} data-place="all">
                    <span className={styles.name}>All your schools</span>
                    <span className={styles.detail}>Every place you work</span>
                  </span>
                </MenuItem>,
              ]
            : []),
        ];
      })}
      <MenuItem
        onSelect={() => {
          onNavigate?.();
          // Adding a place returns to here if they change their mind.
          void navigate({
            to: "/start",
            search: (origin ? { from: origin } : {}) as never,
          });
        }}
      >
        <span className={styles.item} data-place="add">
          <span className={styles.name}>Add a place</span>
          <span className={styles.detail}>{addPlaceDetail(me)}</span>
        </span>
      </MenuItem>
    </Menu>
  );
}

function PlaceRow({ place, here }: { place: PlaceEntry; here: boolean }) {
  return (
    <>
      <span className={styles.item} data-place={place.id}>
        <span className={styles.nameLine}>
          <span className={styles.name}>{place.name}</span>
          {place.demo && <DemoMark />}
        </span>
        <span className={styles.detail}>
          {place.detail}
          {here && <span className={styles.hidden}>, open now</span>}
        </span>
      </span>
      <svg
        className={styles.check}
        viewBox="0 0 16 16"
        aria-hidden="true"
        data-here={here || undefined}
      >
        <path d="m3.5 8.5 3 3 6-7" />
      </svg>
    </>
  );
}
