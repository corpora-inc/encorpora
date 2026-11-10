import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { request } from "../../lib/api";
import { meOptions, refreshMe, sessionOptions } from "../../lib/query";
import { Button } from "../../ui/Button";
import { Sheet } from "../../ui/Sheet";
import { TextField } from "../../ui/TextField";
import { forgetContinuation, readContinuation } from "./memory";
import styles from "./Continue.module.css";

/**
 * After "Continue with AMP": back on the screen it was opened from, with the
 * learner's access active, a parent may add the child's name. Paying was the
 * consent a name needs. It is offered once, over the screen, and never asked
 * again: "Not now" leaves the picture name, and Family can name them later.
 */
export function AfterPurchase() {
  const session = useQuery(sessionOptions).data;
  const location = useRouterState({
    select: (state) => state.location.pathname + state.location.searchStr,
  });
  const me = useQuery({
    ...meOptions(session ?? { accountId: "", token: "" }),
    enabled: !!session,
  }).data;
  const [dismissed, setDismissed] = useState(false);
  const continuation = session ? readContinuation(session.accountId) : null;
  const account = me?.signedIn ? me : null;
  const learner = account?.family.learners.find(
    (entry) => entry.id === continuation?.learnerId,
  );
  const naming =
    continuation?.stage === "naming" &&
    location.split("?")[0] === continuation.returnTo.split("?")[0];
  // Nothing to name: an adult's own practice, or a child already named.
  useEffect(() => {
    if (
      naming &&
      learner &&
      learner.hasAccess &&
      (!learner.namePending || learner.adult)
    )
      forgetContinuation();
  }, [naming, learner?.id, learner?.namePending]);
  const shown =
    !dismissed &&
    naming &&
    !!learner &&
    !!learner.hasAccess &&
    !!learner.namePending &&
    !learner.adult &&
    account?.consent.status === "active";
  if (!shown || !session || !learner) return null;
  return (
    <NameSheet
      token={session.token}
      accountId={session.accountId}
      learner={learner}
      onDone={() => {
        forgetContinuation();
        setDismissed(true);
      }}
    />
  );
}

function NameSheet({
  token,
  accountId,
  learner,
  onDone,
}: {
  token: string;
  accountId: string;
  learner: { id: string; name: string };
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const save = useMutation({
    mutationFn: async (value: string) => {
      await request(
        `/family/learners/${encodeURIComponent(learner.id)}/rename`,
        z.object({ renamed: z.literal(true) }),
        { token, body: { name: value } },
      );
      await refreshMe({ accountId, token });
    },
    onSuccess: onDone,
    onError: (failure) => {
      console.error("The name wasn’t saved", failure);
      setError("The name wasn’t saved. Try again.");
    },
  });
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onDone();
      }}
      title={`Add ${learner.name}’s name`}
    >
      <form
        className={styles.nameForm}
        onSubmit={(event) => {
          event.preventDefault();
          const value = name.trim();
          if (!value) return setError("Enter a first name or nickname.");
          if (!save.isPending) save.mutate(value);
        }}
      >
        <p className={styles.sheetText}>
          {learner.name} is ready to practice. Add a first name or nickname, or
          keep {learner.name} for now.
        </p>
        <TextField
          label="First name or nickname"
          autoComplete="off"
          value={name}
          maxLength={60}
          error={error}
          onChange={(event) => {
            setName(event.target.value);
            setError("");
          }}
        />
        <div className={styles.nameActions}>
          <Button
            variant="primary"
            type="submit"
            aria-busy={save.isPending || undefined}
            disabled={save.isPending}
          >
            Save name
          </Button>
          <Button
            variant="secondary"
            type="button"
            disabled={save.isPending}
            onClick={onDone}
          >
            Not now
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
