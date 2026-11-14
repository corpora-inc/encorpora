import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { sessionOptions } from "../../lib/query";
import { buttonClass } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { LoadingScreen } from "../../ui/LoadingScreen";
import { RowLink, RowList } from "../../ui/RowList";
import frame from "../school/SchoolFrame.module.css";
import { LoadFailed } from "../school/classes/teacher-shared";
import { familyPlacesOptions } from "./api";
import { FamilyFrame, familyHref, useFamilyPlace } from "./FamilyFrame";

/* Every screen of a family (`/family/…`), one module the router loads. */
export { FamilyTodayScreen } from "./Today";
export { ChildScreen } from "./Child";
export {
  FamilyMapScreen,
  FamilyTimeScreen,
  FamilyWorkbooksScreen,
  FamilyMarkingScreen,
  FamilyReportsScreen,
  FamilyGradesScreen,
  FamilyCardsScreen,
} from "./Records";
export {
  FamilyPeopleScreen,
  FamilySettingsScreen,
  TutoringGroupScreen,
} from "./People";

/** `/family` with several families to choose between: the account holder's
 * own and one they are the second parent of. */
export function FamilyChooserScreen() {
  const session = useQuery(sessionOptions).data;
  const places = useQuery({
    ...familyPlacesOptions(session ?? { accountId: "", token: "" }),
    enabled: !!session,
  });
  const parents = (places.data?.families ?? []).filter(
    (family) => family.role !== "co-teacher",
  );
  return (
    <main className={frame.content} data-dense data-narrow="">
      {places.isPending ? (
        <LoadingScreen overlay />
      ) : places.isError ? (
        <LoadFailed
          what="Your families"
          onRetry={() => void places.refetch()}
        />
      ) : (
        <div style={{ display: "grid", gap: "var(--space-5)" }}>
          <h1>Your families</h1>
          {parents.length === 0 ? (
            <EmptyState
              title="No family yet"
              action={
                <Link
                  to={"/start/parent" as never}
                  className={buttonClass("primary")}
                >
                  Add your kids
                </Link>
              }
            />
          ) : (
            <RowList label="Your families">
              {parents.map((family) => (
                <RowLink
                  key={family.familyId}
                  title={family.displayName}
                  meta={
                    family.role === "holder" ? "Your family" : "Second parent"
                  }
                  to={familyHref(family.familyId)}
                  data-family={family.familyId}
                />
              ))}
            </RowList>
          )}
        </div>
      )}
    </main>
  );
}

/** Any other address in a family: not found, in the family's frame. */
export function FamilyMissingScreen() {
  const place = useFamilyPlace();
  return (
    <FamilyFrame place={place}>
      <EmptyState
        title="There’s no page here"
        action={
          <Link
            to="/$"
            params={{ _splat: familyHref(place.family) }}
            className={buttonClass("primary")}
          >
            Back to Today
          </Link>
        }
      >
        This page isn’t part of a family. Today has everything your kids are
        working on.
      </EmptyState>
    </FamilyFrame>
  );
}
