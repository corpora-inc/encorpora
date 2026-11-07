import { useNavigate } from "@tanstack/react-router";
import type { SignedInMe } from "../../../account/contracts";
import { useLearnerStore } from "../../learner-store";
import { Menu, MenuItem, MenuLabel } from "../../ui/Menu";
import { placesFor, type PlaceId } from "../onboarding/guard";
import { rememberPlace } from "../onboarding/place-memory";
import styles from "./PlaceSwitcher.module.css";

const roleNames = {
  admin: "Admin",
  teacher: "Teacher",
  aide: "Aide",
  viewer: "Viewer",
} as const;

export type PlaceEntry = {
  id: PlaceId;
  name: string;
  /** The role here, or what's next. */
  detail: string;
  /** Its URL path, without the leading slash: `/` decides the family side. */
  path: string;
};

/** Every place this account can open, named for the switcher. */
export function placeEntries(me: SignedInMe): PlaceEntry[] {
  return placesFor(me).map((id) => {
    if (id === "home")
      return {
        id,
        name: "Family and practice",
        detail:
          me.learners.length === 1
            ? me.learners[0]!.name
            : me.learners.length > 1
              ? `${me.learners.length} learners`
              : me.trial
                ? "Free assessment"
                : "Getting started",
        path: "",
      };
    if (id === "me") {
      // Their own learner, by their name; or the way to start one.
      const own = me.adultPractice?.learner;
      return own
        ? {
            id,
            name: "My practice",
            detail: own.name,
            path: "me",
          }
        : {
            id,
            name: "Start my own practice",
            detail: "Free for you",
            path: "me/start",
          };
    }
    const org = me.staffOf!.find((entry) => `school:${entry.orgId}` === id)!;
    return {
      id,
      name: org.orgName,
      detail: org.setupPending ? "Finish setting up" : roleNames[org.role],
      path: `school/${org.orgId}`,
    };
  });
}

/** Choosing a place chooses its learner: the adult's own for their practice,
 * and the family's first for the family side, unless one of theirs already is. */
export function choosePlaceLearner(me: SignedInMe, place: PlaceId) {
  const store = useLearnerStore.getState();
  const own = me.adultPractice?.learner?.id ?? null;
  if (place === "me" && own) store.select(own);
  else if (
    place === "home" &&
    !me.learners.some((learner) => learner.id === store.learnerId)
  )
    store.select(me.learners[0]?.id ?? null);
}

/**
 * The one way between the places a person works: their family and practice
 * side, their own practice, and each school with their role there. It lists
 * only places this account can open, and shows nothing when there's only one.
 * Choosing a place remembers it, so `/` opens there next time.
 */
export function PlaceSwitcher({
  me,
  current,
  label,
  onNavigate,
}: {
  me: SignedInMe;
  /** The place on screen now. */
  current: PlaceId | null;
  /** The trigger's text, when the screen names its place more exactly (a
   * school within the district this person works for, say). */
  label?: string;
  onNavigate?: () => void;
}) {
  const navigate = useNavigate();
  const places = placeEntries(me);
  if (places.length < 2) return null;
  const here = places.find((place) => place.id === current);
  const name = label ?? here?.name ?? "Your places";
  return (
    <Menu
      align="start"
      aria-label={`${name}: switch place`}
      triggerClassName={styles.trigger}
      label={
        <span className={styles.triggerText} title={name}>
          {name}
        </span>
      }
    >
      <MenuLabel>Your places</MenuLabel>
      {places.map((place) => {
        const isHere = place.id === current;
        return (
          <MenuItem
            key={place.id}
            onSelect={() => {
              if (isHere) return;
              choosePlaceLearner(me, place.id);
              // Starting is a step on the way there; the place is theirs once
              // they have it.
              if (place.path !== "me/start")
                rememberPlace(me.account.id, place.id);
              onNavigate?.();
              void navigate(
                place.path
                  ? { to: "/$", params: { _splat: place.path } }
                  : { to: "/" },
              );
            }}
          >
            <span className={styles.item} data-place={place.id}>
              <span className={styles.name}>{place.name}</span>
              <span className={styles.detail}>
                {place.detail}
                {isHere && <span className={styles.hidden}>, open now</span>}
              </span>
            </span>
            <svg
              className={styles.check}
              viewBox="0 0 16 16"
              aria-hidden="true"
              data-here={isHere || undefined}
            >
              <path d="m3.5 8.5 3 3 6-7" />
            </svg>
          </MenuItem>
        );
      })}
    </Menu>
  );
}
