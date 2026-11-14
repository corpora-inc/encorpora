import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { SignedInMe } from "../../../account/contracts";
import type { AuthSession } from "../../auth";
import { AppError } from "../../lib/AppError";
import { meOptions, sessionOptions } from "../../lib/query";
import { LayerHost } from "../../nav/LayerHost";
import { workParts, type Entity } from "../../nav/entities";
import { peopleOf } from "./redirects";
import { Button, buttonClass } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { LoadingScreen } from "../../ui/LoadingScreen";
import frame from "../school/SchoolFrame.module.css";
import { ownClassOf } from "../spaces/resolve";
import { spaceWords } from "../spaces/words";
import { familyOptions, type FamilyProjection } from "./api";

const NO_SESSION: AuthSession = { accountId: "", token: "" };

/** The family a `/family/<family>/…` screen is about, from its address:
 * the projection (its own children only), this account, and the family's
 * own class when it has one. */
export function useFamilyPlace() {
  const { family = "" } = useParams({ strict: false }) as { family?: string };
  const session = useQuery(sessionOptions).data ?? null;
  const auth = session ?? NO_SESSION;
  const query = useQuery({
    ...familyOptions(auth, family),
    enabled: !!session && !!family,
  });
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
export type FamilyPlace = ReturnType<typeof useFamilyPlace>;

/** A child of the family's own, by their learner id. */
export const childOf = (data: FamilyProjection | undefined, id: string) =>
  data?.children.find((child) => child.id === id);

/**
 * The page under the app frame for every family screen: one content column,
 * its wait inside it (the bar is already whole), the family's unavailable
 * state when the address names a family this account isn't a parent of, and
 * the layers opened over the page (a skill, a lesson, one of a child's
 * answers).
 */
export function FamilyFrame({
  place,
  loading = false,
  narrow = false,
  children,
}: {
  place: FamilyPlace;
  /** The screen's own data is still on its way. */
  loading?: boolean;
  /** One focused, centred column (Settings, People). */
  narrow?: boolean;
  children: ReactNode;
}) {
  const { query, data } = place;
  const content = (body: ReactNode) => (
    <main
      id="family-content"
      tabIndex={-1}
      className={frame.content}
      data-dense
      data-family-screen=""
      data-narrow={narrow ? "" : undefined}
    >
      {body}
      {/* Details opened over the page (?open=): it stays, they stack. A
          family with its own class opens a child's answers too. */}
      {data && (
        <LayerHost
          org={place.own?.org}
          allow={(entity) => ownLayer(place, entity)}
        />
      )}
    </main>
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
          If someone sent you this link, ask them to invite this account as a
          parent, or sign in with the address they invited.
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
  if (!place.own || !place.data) return false;
  const person =
    entity.kind === "student" ? entity.id : workParts(entity.id).student;
  return peopleOf(place.data.children, place.own.id).has(person);
}
