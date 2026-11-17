import { useQuery } from "@tanstack/react-query";
import {
  Link,
  useNavigate,
  useParams,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import type { SignedInMe } from "../../../account/contracts";
import type { AuthSession } from "../../auth";
import { AppError } from "../../lib/AppError";
import { meOptions } from "../../lib/query";
import { useSessionOrNull } from "../../lib/session";
import { LayerHost } from "../../nav/LayerHost";
import type { AreaSource } from "../../nav/AreaLayer";
import { OPEN_KEY, workParts, type Entity } from "../../nav/entities";
import { familyOrgTarget, peopleOf } from "./redirects";
import { Button, buttonClass } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { LoadingScreen } from "../../ui/LoadingScreen";
import { Page } from "../../ui/Page";
import { PageHeader } from "../../ui/PageHeader";
import { ownClassOf } from "../spaces/resolve";
import { spaceWords } from "../spaces/words";
import { familyOptions, type FamilyProjection } from "./api";
import styles from "./Family.module.css";

const NO_SESSION: AuthSession = { accountId: "", token: "" };

/** The family a `/family/<family>/…` screen is about, from its address:
 * the projection (its own children only), this account, and the family's
 * own class when it has one. */
export function useFamilyPlace() {
  const { family = "" } = useParams({ strict: false }) as { family?: string };
  return useFamilyPlaceOf(family);
}
/** A family by its id, from outside its own pages (setup's last step). */
export function useFamilyPlaceOf(family: string) {
  const session = useSessionOrNull();
  const auth = session ?? NO_SESSION;
  // Its own guard (api.ts): signed in as a parent, never a child's session
  // that a handover has just started on this screen.
  const query = useQuery(familyOptions(auth, family));
  const me = useQuery({ ...meOptions(auth), enabled: !!session }).data;
  const account: SignedInMe | null =
    me?.signedIn && me.account.id === session?.accountId ? me : null;
  const data = query.data?.familyId === family ? query.data : undefined;
  return {
    family,
    session: auth,
    signedIn: !!session,
    query,
    data,
    me: account,
    /** The family's own class: its code, cards, grades and workbook stack. */
    own: ownClassOf(account, family, data),
    words: spaceWords("family"),
    holder: data?.role === "holder",
  };
}
export type FamilyPlace = ReturnType<typeof useFamilyPlaceOf>;

/** A child of the family's own, by their learner id. */
export const childOf = (data: FamilyProjection | undefined, id: string) =>
  data?.children.find((child) => child.id === id);

/**
 * An address that opens one of the family's own children by their roster
 * person (`?open=student:<person>`, a link from before): the child's own
 * page instead, their answers over it, in a parent's words. Never the
 * school's student record inside the family.
 */
function useOwnChildLayer(place: FamilyPlace) {
  const navigate = useNavigate();
  const search = useRouterState({
    select: (state) => state.location.search as Record<string, unknown>,
  });
  const open = search[OPEN_KEY];
  const target =
    place.data && place.own && typeof open === "string"
      ? familyOrgTarget({
          family: place.family,
          page: "today",
          search: {
            [OPEN_KEY]: open,
            ...(typeof search.skill === "string"
              ? { skill: search.skill }
              : {}),
          },
          people: peopleOf(place.data.children, place.own.id),
        })
      : null;
  const to = target && target.to.includes("/kids/") ? target : null;
  useEffect(() => {
    if (to)
      void navigate({
        to: to.to,
        search: to.search as never,
        replace: true,
      } as never);
  }, [to?.to, JSON.stringify(to?.search)]);
}

/**
 * The page under the app frame for every family screen: one standard Page
 * column, its header (the title; no way back: the family's tabs and the
 * browser's own Back are the navigation), its wait inside it (the bar is already whole), the family's
 * unavailable state when the address names a family this account isn't a
 * parent of, and the layers opened over the page (a skill, a lesson, one of
 * a child's answers).
 */
export function FamilyFrame({
  place,
  loading = false,
  title,
  description,
  area,
  children,
}: {
  place: FamilyPlace;
  /** The level the screen shows (a child's), for an area opened over it. */
  area?: AreaSource;
  /** The screen's own data is still on its way. */
  loading?: boolean;
  /** Shared page heading: every family tab starts at the same position. */
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  const { query, data } = place;
  useOwnChildLayer(place);
  const content = (body: ReactNode) => (
    <Page
      id="family-content"
      tabIndex={-1}
      className={styles.screen}
      data-dense
      data-family-screen=""
    >
      {data && !loading && title && (
        <PageHeader title={title} subtitle={description} />
      )}
      {body}
      {/* Details opened over the page (?open=): it stays, they stack. A
          family with its own class opens a child's answers too. */}
      {data && (
        <LayerHost
          org={place.own?.org}
          allow={(entity) => ownLayer(place, entity)}
          area={area}
        />
      )}
    </Page>
  );
  if (!data && (query.isPending || !place.signedIn))
    return content(<LoadingScreen overlay />);
  if (!data) {
    const missing =
      !(query.error instanceof AppError) ||
      query.error.status === 404 ||
      query.error.status === 403;
    return content(
      missing ? (
        <EmptyState
          title="This family isn’t available to your account"
          action={
            <Link to={"/family" as never} className={buttonClass("primary")}>
              Open your family
            </Link>
          }
        >
          Ask whoever sent the link to invite this account, or sign in with the
          address they invited.
        </EmptyState>
      ) : (
        <EmptyState
          title="Your family didn’t load"
          action={
            <Button variant="primary" onClick={() => void query.refetch()}>
              Try again
            </Button>
          }
        >
          Check your connection, then try again.
        </EmptyState>
      ),
    );
  }
  return content(loading ? <LoadingScreen overlay /> : children);
}

/** A family screen's address, for links: `/family/<family>/<leaf>`. */
export const familyHref = (family: string, leaf = "") =>
  leaf ? `family/${family}/${leaf}` : `family/${family}`;

/**
 * Whether a layer over a family screen is the family's own (R2): a skill or
 * a lesson always; a child's record or answer only for one of the family's
 * own children, by their person in its own class. Another family's child
 * in a shared class is never opened here, whatever the address says.
 */
export function ownLayer(place: FamilyPlace, entity: Entity): boolean {
  if (entity.kind !== "student" && entity.kind !== "work") return true;
  // A child's record is their own page here, never the school's layer.
  if (entity.kind === "student") return false;
  if (!place.own || !place.data) return false;
  const person = workParts(entity.id).student;
  return peopleOf(place.data.children, place.own.id).has(person);
}
