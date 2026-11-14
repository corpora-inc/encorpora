import { useEffect } from "react";
import { queryOptions, skipToken, useQuery } from "@tanstack/react-query";
import { meOptions, queryClient, sessionOptions } from "./query";
import { useLearnerStore } from "../learner-store";
import {
  learningIdentity,
  type AddressedIdentity,
} from "../features/spaces/identity";
import {
  useAddressedIdentity,
  useAddressedRecordsReadable,
} from "../features/spaces/useAddressed";
import {
  adultLearner,
  practiceProfile,
  practicingAsAdult,
  profileLearner,
} from "./adult-learner";
import { request } from "./api";
import {
  catalogSchema,
  progressSchema,
  frontierSchema,
} from "../features/pathways/model";
import type { AuthSession } from "../auth";
import { studentSkillResponse } from "../../schools/teacher-contracts";
import {
  secondParentChild,
  secondParentChildren,
} from "../features/second-parent/api";

export const skillCatalogOptions = queryOptions({
  queryKey: ["pathways-catalog"],
  queryFn: ({ signal }) => request("/catalog", catalogSchema, { signal }),
  staleTime: 60_000,
});
export const learnerEvidenceOptions = (
  session: AuthSession,
  learnerId: string,
) =>
  queryOptions({
    queryKey: ["account", session.accountId, "pathways", learnerId],
    queryFn: ({ signal }) =>
      request(
        `/learners/${encodeURIComponent(learnerId)}/progress`,
        progressSchema,
        { token: session.token, signal },
      ),
  });
/** A learner on one skill (the skill layer over Pathways): the engine's
 * counts and their latest answers on it, as a teacher reads a student's. */
export const learnerSkillOptions = (
  session: AuthSession,
  learnerId: string,
  skillId: string,
) =>
  queryOptions({
    queryKey: [
      "account",
      session.accountId,
      "pathways",
      learnerId,
      "skill",
      skillId,
    ],
    queryFn: ({ signal }) =>
      request(
        `/learners/${encodeURIComponent(learnerId)}/skills/${encodeURIComponent(skillId)}`,
        studentSkillResponse,
        { token: session.token, signal },
      ),
  });
export const learnerFrontierOptions = (
  session: AuthSession,
  learnerId: string,
) =>
  queryOptions({
    queryKey: ["account", session.accountId, "pathways-frontier", learnerId],
    queryFn: ({ signal }) =>
      request(
        `/learners/${encodeURIComponent(learnerId)}/frontier`,
        frontierSchema,
        { token: session.token, signal },
      ),
  });

type SignedIn = Extract<
  Awaited<ReturnType<NonNullable<ReturnType<typeof meOptions>["queryFn"]>>>,
  { signedIn: true }
>;

/** Whose record a learning screen shows, from the account and the learner this
 * device chose: the adult's own (or one of their profiles), the chosen child
 * (theirs or a second parent's family's), else the first child. Pure, so a
 * route can load that record before its screen renders. */
export function chooseLearner(
  account: SignedIn | null,
  selectedId: string | null,
  /** The learner or profile the screen's address names: when present it is
   * the only answer, and one this account doesn't read is nobody (no
   * fallback to the device's choice or the first child). */
  addressed: AddressedIdentity | null = null,
) {
  if (addressed) {
    const learners = account?.learners ?? [];
    const shared = secondParentChildren(account);
    const solo =
      !learners.length && !shared.length ? adultLearner(account) : null;
    const id = addressed.id;
    const profile =
      addressed.kind === "profile" ? practiceProfile(account, id) : null;
    const own = profile
      ? profileLearner(account, id)
      : addressed.kind === "learner" && practicingAsAdult(account, id)
        ? adultLearner(account)
        : null;
    const learner =
      own ??
      (addressed.kind === "learner"
        ? (learners.find((l) => l.id === id) ?? shared.find((l) => l.id === id))
        : undefined);
    return {
      learners,
      shared,
      profile,
      solo,
      own,
      learner,
      unavailable: !learner,
    };
  }
  const learners = account?.learners ?? [];
  const shared = secondParentChildren(account);
  const profile = practiceProfile(account, selectedId);
  const solo =
    !learners.length && !shared.length ? adultLearner(account) : null;
  const own = practicingAsAdult(account, selectedId)
    ? adultLearner(account)
    : profile
      ? profileLearner(account, selectedId)
      : solo;
  const learner =
    own ??
    learners.find((l) => l.id === selectedId) ??
    shared.find((l) => l.id === selectedId) ??
    learners[0];
  return { learners, shared, profile, solo, own, learner, unavailable: false };
}

/** A learning screen's data (who, the curriculum, and the chosen learner's
 * record and level), loaded before it renders so it paints once, whole
 * (docs/design/ia.md, "Smoothness"). A failure is left for the screen to
 * show in place. */
/** The Overview's level only, before it paints: its layout (a learner's
 * first day, or their record) depends on it. Its areas hold their rows while
 * the catalog loads, so the catalog is not needed first. */
export async function preloadOverviewLevel(location?: {
  pathname: string;
  search: Record<string, unknown>;
}) {
  const session = await queryClient
    .ensureQueryData(sessionOptions)
    .catch(() => undefined);
  if (!session) return;
  const me = await queryClient
    .ensureQueryData(meOptions(session))
    .catch(() => undefined);
  const account =
    me?.signedIn && me.account.id === session.accountId ? me : null;
  // The address being loaded names its learner; a load never changes this
  // device's choice.
  const { learner } = chooseLearner(
    account as SignedIn | null,
    useLearnerStore.getState().learnerId,
    location
      ? learningIdentity(
          location.pathname,
          location.search,
          account?.adultPractice?.learner?.id,
        )
      : null,
  );
  if (learner)
    await queryClient
      .ensureQueryData(learnerFrontierOptions(session, learner.id))
      .catch((error: unknown) =>
        console.error("The level did not preload", error),
      );
}

export async function preloadLearningView(location?: {
  pathname: string;
  search: Record<string, unknown>;
}) {
  const quiet = <T>(promise: Promise<T>, what: string) =>
    promise.catch((error: unknown) => {
      console.error(`${what} did not preload`, error);
      return undefined;
    });
  const catalog = quiet(
    queryClient.ensureQueryData(skillCatalogOptions),
    "The curriculum",
  );
  const session = await quiet(
    queryClient.ensureQueryData(sessionOptions),
    "The session",
  );
  if (!session) return void (await catalog);
  const me = await quiet(
    queryClient.ensureQueryData(meOptions(session)),
    "The account",
  );
  const account =
    me?.signedIn && me.account.id === session.accountId ? me : null;
  // The address being loaded names its learner; a load never changes this
  // device's choice.
  const { learner } = chooseLearner(
    account as SignedIn | null,
    useLearnerStore.getState().learnerId,
    location
      ? learningIdentity(
          location.pathname,
          location.search,
          account?.adultPractice?.learner?.id,
        )
      : null,
  );
  await Promise.all([
    catalog,
    learner &&
      quiet(
        queryClient.ensureQueryData(
          learnerEvidenceOptions(session, learner.id),
        ),
        "The record",
      ),
    learner &&
      quiet(
        queryClient.ensureQueryData(
          learnerFrontierOptions(session, learner.id),
        ),
        "The level",
      ),
  ]);
}

/** One explicit learning context for navigation and inventory: the chosen
 * learner of the signed-in account, or the adult's own.
 * `records: false` (the drawer) asks only who and where, never the learner's
 * evidence, so opening it fetches nothing the screen behind it hasn't. */
export function useLearningView({
  records = true,
}: { records?: boolean } = {}) {
  const session = useQuery(sessionOptions);
  const me = useQuery({
    ...meOptions(session.data ?? { accountId: "", token: "" }),
    enabled: !!session.data,
  });
  const account =
    me.data?.signedIn && me.data.account.id === session.data?.accountId
      ? me.data
      : null;
  const selectedId = useLearnerStore((s) => s.learnerId);
  // The displayed screen's address names whose it is; otherwise the adult's
  // own (or a profile of theirs), the chosen child, a second parent's
  // family's child (read-only), else the first child, as practice
  // (LegacyApp) takes it, so every screen and the drawer agree.
  const addressed = useAddressedIdentity();
  // A family's child's records only where that family shows them (CP-5 #6).
  const readable = useAddressedRecordsReadable();
  const { learners, shared, profile, solo, own, learner, unavailable } =
    chooseLearner(account, selectedId, addressed);
  const viewOnly = !own && !!secondParentChild(account, learner?.id);
  useEffect(() => {
    // A named screen never moves the device's choice from here: the shell
    // adopts it once the screen shows (AppShell), and a named learner who is
    // gone is nobody, never another.
    if (addressed) return;
    if (solo && own === solo && selectedId !== solo.id)
      useLearnerStore.getState().select(solo.id);
    if (own) return;
    const chosen =
      learners.some((l) => l.id === selectedId) ||
      shared.some((l) => l.id === selectedId);
    if (!chosen && learners[0])
      useLearnerStore.getState().select(learners[0].id);
  }, [account, selectedId, addressed?.kind, addressed?.id]);
  const loadingIdentity = session.isPending || (!!session.data && me.isPending);
  // Without records (the drawer), these observe nothing: a disabled observer
  // of the learner's level would still be its last, and unmounting it (the
  // drawer closing on its way to the Overview) cancels the level refresh the
  // Overview is waiting for.
  const evidence = useQuery(
    records
      ? {
          ...learnerEvidenceOptions(
            session.data ?? { accountId: "", token: "" },
            learner?.id ?? "",
          ),
          enabled: !!session.data && !!learner && readable,
        }
      : {
          queryKey: ["learning-view", "no-records", "evidence"],
          queryFn: skipToken,
        },
  );
  const frontier = useQuery(
    records
      ? {
          ...learnerFrontierOptions(
            session.data ?? { accountId: "", token: "" },
            learner?.id ?? "",
          ),
          enabled: !!session.data && !!learner && readable,
        }
      : {
          queryKey: ["learning-view", "no-records", "frontier"],
          queryFn: skipToken,
        },
  );
  const active = !!learner;
  const canPractice =
    !!learner &&
    !viewOnly &&
    !!account?.family.learners.find((l) => l.id === learner.id)?.canPractice;
  const identityError = session.error || (session.data && me.error);
  const loading =
    loadingIdentity ||
    (active && records && (evidence.isPending || frontier.isPending));
  const error =
    identityError || (active && records && (evidence.error || frontier.error));
  return {
    session,
    identityLoading: loadingIdentity,
    identityError,
    account,
    /** The learners to choose between: the family's, then those of a family
     * this account is the second parent of. */
    learners: [...learners, ...shared],
    learner,
    /** The chosen child is a second parent's family's: their progress is
     * read here, and practice is the family's class. */
    viewOnly,
    /** The chosen learner is the adult's own: their own practice, or one of
     * their practice profiles. */
    ownPractice: !!own,
    /** The adult is practicing as this profile of theirs. */
    profile,
    active,
    canPractice,
    evidence: active ? evidence.data : undefined,
    frontier: active ? frontier.data : undefined,
    loading,
    error,
    // A second parent's family's child practises from the family's class.
    // Otherwise practice, or the pause in practice when the free problems
    // are used; with no learner yet, the starter.
    practiceHref:
      learner && viewOnly
        ? `/${secondParentChild(account, learner.id)!.classPath}`
        : learner
          ? "/practice"
          : "/start",
    retry: () => {
      void session.refetch();
      if (session.data) void me.refetch();
      if (active) {
        void evidence.refetch();
        void frontier.refetch();
      }
    },
  };
}
