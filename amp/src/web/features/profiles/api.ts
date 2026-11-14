import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import type { SignedInMe } from "../../../account/contracts";
import {
  practiceProfileSchema,
  type ProfileLevels,
} from "../../../learning/practice-profiles";
import type { AuthSession } from "../../auth";
import { useLearnerStore } from "../../learner-store";
import { practiceProfile } from "../../lib/adult-learner";
import { request } from "../../lib/api";
import { meOptions, refreshMe, sessionOptions } from "../../lib/query";
import { closeTo } from "../../lib/return-to";
import { ROOT } from "../../nav/root";
import { modeFrom, modePlace, modeReturnLabel } from "./practice-mode";
import { classesOptions } from "../school/api";

/* Practice profiles (docs/families.md): the adult practicing as someone else.
   Every change refreshes `/me`, the one store the switcher, the drawer and
   practice read. */

const created = z.object({ learnerId: z.string() });

/** Practice as this profile: it becomes the learner practicing, and practice
 * opens on it. The place they came from stays the one `/` remembers. */
export function choosePracticeProfile(id: string) {
  useLearnerStore.getState().select(id);
  rememberProfileUse(id);
}

/** The profiles this device practiced as, newest first, so the list of them
 * opens on the ones in use. Device-local and best effort. */
const RECENT_KEY = "amp.profiles.recent";
export function recentProfiles(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}
function rememberProfileUse(id: string) {
  try {
    localStorage.setItem(
      RECENT_KEY,
      JSON.stringify(
        [id, ...recentProfiles().filter((old) => old !== id)].slice(0, 20),
      ),
    );
  } catch (error) {
    console.warn("The profile list order couldn’t be kept", error);
  }
}

/** Saves a new profile and makes it the learner practicing. */
export function useCreateProfile(session: AuthSession) {
  return useMutation({
    mutationFn: async (input: { label: string; levels: ProfileLevels }) => {
      const { learnerId } = await request("/me/profiles", created, {
        token: session.token,
        body: input,
      });
      await refreshMe(session);
      choosePracticeProfile(learnerId);
      return learnerId;
    },
    onError: (error) => console.error("The profile wasn’t saved", error),
  });
}

/** Renames a profile or moves its strands. */
export function useUpdateProfile(session: AuthSession, id: string) {
  return useMutation({
    mutationFn: async (input: { label: string; levels: ProfileLevels }) => {
      const saved = await request(
        `/me/profiles/${encodeURIComponent(id)}`,
        practiceProfileSchema,
        { token: session.token, body: input, method: "PATCH" },
      );
      await refreshMe(session);
      return saved;
    },
    onError: (error) => console.error("The profile wasn’t saved", error),
  });
}

/** Deletes a profile and what it practiced. */
export function useDeleteProfile(session: AuthSession, id: string) {
  return useMutation({
    mutationFn: async () => {
      await request(`/me/profiles/${encodeURIComponent(id)}`, z.unknown(), {
        token: session.token,
        method: "DELETE",
      });
      await refreshMe(session);
    },
    onError: (error) => console.error("The profile wasn’t deleted", error),
  });
}

/** "Try problems as this student": a profile of this account, copied once
 * from a student's levels now, then practice as it. */
export function useCopyStudent(session: AuthSession, personId: string) {
  return useMutation({
    mutationFn: async (label: string) => {
      const { learnerId } = await request(
        `/school/students/${encodeURIComponent(personId)}/practice-profile`,
        created,
        { token: session.token, body: { label } },
      );
      await refreshMe(session);
      choosePracticeProfile(learnerId);
      return learnerId;
    },
    onError: (error) =>
      console.error("The student’s levels weren’t copied", error),
  });
}

/** The label a copied student's profile starts with: never their name, which
 * stays with their school or family. The adult can rename it. */
export function copiedLabel(now = new Date()) {
  return `Student levels · ${now.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}

/** The way back from a profile: the adult's own practice, or, with none,
 * Back to where it was started (else their place). */
export function leaveTarget(me: SignedInMe | null | undefined) {
  const own = me?.adultPractice?.learner ?? null;
  // Without their own, the family's first child is chosen again, as `/`
  // would choose.
  const first = me?.learners[0]?.id ?? null;
  return own
    ? {
        own: own.id,
        first,
        label: "Back to your levels",
        short: "Your levels",
      }
    : { own: null, first, label: "Back", short: "Back" };
}

/** The profile being practiced as, and the one tap back out of it: to where
 * the mode was started (`?from=`, features/profiles/practice-mode.ts), else
 * the adult's own practice or their home. */
export function usePracticingProfile() {
  const session = useQuery(sessionOptions).data;
  const me = useQuery({
    ...meOptions(session ?? { accountId: "", token: "" }),
    enabled: !!session,
  }).data;
  const account =
    me?.signedIn && me.account.id === session?.accountId ? me : null;
  const learnerId = useLearnerStore((state) => state.learnerId);
  const profile = practiceProfile(account, learnerId);
  const navigate = useNavigate();
  const router = useRouter();
  const from = modeFrom(
    useLocation({ select: (location) => location.search }) as Record<
      string,
      unknown
    >,
  );
  const target = leaveTarget(account);
  // Its class's name, loaded with the screen (practice-mode.ts).
  const { org } = modePlace(from);
  const classes = useQuery({
    ...classesOptions(session!, org ?? ""),
    enabled: !!session && !!org && !!profile,
  }).data;
  return {
    profile,
    back: from
      ? { ...target, ...modeReturnLabel(from, account, classes) }
      : target,
    leave: () => {
      // Back where it was started: X, the browser's Back and this agree.
      if (from) return closeTo(router, from, from);
      const store = useLearnerStore.getState();
      if (target.own) {
        store.select(target.own);
        void navigate({
          to: "/$",
          params: { _splat: "practice" },
          search: { profile: undefined, from: undefined },
        });
        return;
      }
      // No mode's `from` and no practice of their own: Back to where the
      // profile was started, else the root, which opens the place they work
      // (the family's first child chosen again, as the root would).
      store.select(target.first);
      closeTo(router, ROOT);
    },
  };
}
