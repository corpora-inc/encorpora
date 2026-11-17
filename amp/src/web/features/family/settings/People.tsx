import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useLearnerStore } from "../../../learner-store";
import { useStartOwnPractice } from "../../me/api";
import { OwnStartSetting } from "../../me/OwnStartSetting";
import { Button } from "../../../ui/Button";
import { Toast } from "../../../ui/Toast";
import rowStyles from "../../school/classes/Family.module.css";
import people from "../../school/classes/people/People.module.css";
import { secondParentOptions } from "../../second-parent/api";
import {
  SecondParentInviteSheet,
  SecondParentRow,
} from "../../second-parent/SecondParent";
import { useSheet } from "../../../nav/sheet";
import { NameEditor } from "../../account/NameEditor";
import { PageSection } from "../../../ui/PageSection";
import { RowLink, RowList } from "../../../ui/RowList";
import { familyHref } from "../FamilyFrame";
import styles from "../Family.module.css";
import { AddAction } from "../TutoringGroup";
import type { FamilyPlace } from "../FamilyFrame";

/** The holder's side of People: the second parent, invited, waiting or
 * there, with the one action that works now. */
function SecondParentSection({ place }: { place: FamilyPlace }) {
  const { session, data } = place;
  const manage = !!data?.capabilities.manageSecondParent;
  const invite = !!data?.capabilities.inviteSecondParent;
  const second = useQuery({ ...secondParentOptions(session), enabled: manage });
  // Inviting: a sheet over Settings, in history state.
  const inviting = useSheet("second-parent");
  const [error, setError] = useState("");
  if (!manage && !invite) return null;
  return (
    <section className={people.list} aria-labelledby="people-second">
      <h3 id="people-second" className={people.title}>
        Second parent
      </h3>
      {second.isSuccess && !second.data && (
        <p className={people.lead}>
          They see each child’s progress and practice free.
        </p>
      )}
      <ul className={`${rowStyles.children} ${people.rows}`}>
        {second.isPending && manage ? (
          <li className={`amp-skeleton ${rowStyles.reserve}`} aria-busy="true">
            <span />
          </li>
        ) : second.isError ? (
          <li>
            <span role="alert">Invitations are temporarily unavailable. </span>
            <Button
              variant="quiet"
              aria-busy={second.isFetching}
              disabled={second.isFetching}
              onClick={() => void second.refetch()}
            >
              Reload invitations
            </Button>
          </li>
        ) : second.data ? (
          <SecondParentRow
            session={session}
            parent={second.data}
            onError={setError}
          />
        ) : null}
      </ul>
      {invite && second.isSuccess && !second.data && (
        <div className={people.actions}>
          <AddAction onClick={inviting.show}>Add a second parent</AddAction>
        </div>
      )}
      {inviting.open && (
        <SecondParentInviteSheet session={session} onClose={inviting.close} />
      )}
      <Toast message={error} onDismiss={() => setError("")} />
    </section>
  );
}

/**
 * Your own practice, in place under You: start it here (the account's own
 * learner, made now), then where it starts (your birth year) and Practice.
 * Shown when the account has its own practice or may start one.
 */
function OwnPractice({ place }: { place: FamilyPlace }) {
  const { me, session } = place;
  const start = useStartOwnPractice(session);
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const own = me?.adultPractice?.learner ?? null;
  const eligible = me?.adultPractice?.eligible === true;
  if (!me || (!own && !eligible)) return null;
  const learner = own
    ? me.family.learners.find((entry) => entry.id === own.id)
    : undefined;
  const practice = (learnerId: string) => {
    useLearnerStore.getState().select(learnerId);
    void navigate({ to: "/$", params: { _splat: "practice" } });
  };
  return (
    <section
      className={people.list}
      aria-labelledby="people-own"
      data-own-practice=""
    >
      <h3 id="people-own" className={people.title}>
        Your own practice
      </h3>
      {own ? (
        <>
          <OwnStartSetting start={learner?.start} />
          <div>
            <Button variant="secondary" onClick={() => practice(own.id)}>
              Practice
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className={styles.footnote}>
            Practice at your own level, beside your children.
          </p>
          <div>
            <Button
              variant="secondary"
              aria-busy={start.isPending || undefined}
              data-start-own-practice=""
              onClick={() => {
                if (start.isPending) return;
                setError("");
                start.mutate(undefined, {
                  onError: (failure) => {
                    console.error("Own practice didn’t start", failure);
                    setError("Your practice didn’t start. Try again.");
                  },
                });
              }}
            >
              Start your own practice
            </Button>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className={styles.footnote}>
          {error}
        </p>
      )}
    </section>
  );
}

/**
 * Settings › People (the IA v2 spec, §3.3): you, with your name edited in
 * place; the second parent, invited, waiting or there (the holder), or what
 * the holder looks after (a second parent); and the tutoring group, another
 * place, when the family's class holds other families' children.
 */
export function PeopleSection({ place }: { place: FamilyPlace }) {
  const { data, family } = place;
  if (!data) return null;
  const second = data.role === "second-parent";
  return (
    <PageSection title="People" titleId="family-people" data-settings-people="">
      <section className={people.list} aria-labelledby="people-you">
        <h3 id="people-you" className={people.title}>
          You
        </h3>
        {/* Their own name, changed here (the account's, shown everywhere). */}
        <NameEditor detail="Other parents see it." />
      </section>
      <OwnPractice place={place} />
      {second ? (
        <p className={styles.footnote} data-second-parent-note="">
          {data.holderName ?? "The parent who invited you"} buys access, names
          the children, gives consent and can delete their data.
        </p>
      ) : (
        <SecondParentSection place={place} />
      )}
      {data.teachingPlace && (
        <RowList label="Tutoring group">
          <RowLink
            title="Tutoring group"
            meta={data.teachingPlace.displayName}
            to={familyHref(family, "group")}
            data-settings-group=""
          />
        </RowList>
      )}
    </PageSection>
  );
}
