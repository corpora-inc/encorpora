import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useLoggedError } from "../../feedback";
import { useLearnerStore } from "../../learner-store";
import { AppError } from "../../lib/AppError";
import {
  invalidateAccount,
  meOptions,
  refreshMe,
  sessionOptions,
} from "../../lib/query";
import { Button, buttonClass } from "../../ui/Button";
import { Loading } from "../../ui/Loading";
import controls from "../../ui/Controls.module.css";
import { BirthYearPicker } from "../../ui/Select";
import { TextField } from "../../ui/TextField";
import { Toast } from "../../ui/Toast";
import { useClaimEnrollment } from "../billing/api";
import { Brand } from "../school/SchoolFrame";
import school from "../school/School.module.css";
import { approvalOptions, approvals } from "./api";
import { teacherLine } from "./ApproveLinkScreen";
import styles from "./Approval.module.css";

const DAY = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});
const failures: Record<string, string> = {
  consent_required:
    "Your consent isn’t recorded yet. Buy a license for your child to give it.",
  email_unconfirmed:
    "Confirm your email first: open the link we sent you, then approve.",
  approval_expired: "This link has expired. Ask the teacher to send it again.",
  approval_ended: "The teacher withdrew this link.",
};

/** The approving parent's page about their child in another family's class
 * (docs/families.md, step 5): what the class is and who teaches it, consent
 * through the usual purchase, the approval, and then the child's place. */
export function ApprovalScreen() {
  const { approvalId } = useParams({ from: "/family/approvals/$approvalId" });
  const navigate = useNavigate();
  const session = useQuery(sessionOptions).data!;
  const me = useQuery(meOptions(session)).data;
  const page = useQuery({ ...approvalOptions(session, approvalId), retry: 1 });
  const claim = useClaimEnrollment(session);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [birthYearError, setBirthYearError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useLoggedError(error);
  const view = page.data;
  useEffect(() => {
    if (view?.childName && !name) setName(view.childName);
  }, [view?.childName]);
  const child = view?.childName ?? "your child";
  const approve = async () => {
    if (!view) return;
    if (!name.trim()) {
      setNameError("Enter your child’s first name.");
      return;
    }
    if (view.asksBirthYear && !birthYear) {
      setBirthYearError("Choose your child’s birth year.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { learnerId } = await approvals.approve(
        session,
        view.id,
        name.trim(),
        view.asksBirthYear ? Number(birthYear) : undefined,
      );
      // A license bought on the way here is for this child.
      const bought = me?.signedIn ? me.unassignedPurchase : undefined;
      if (bought)
        await claim
          .mutateAsync({ purchaseId: bought.id, learnerId })
          .catch((failure) =>
            console.error("The license wasn’t assigned yet", failure),
          );
      await invalidateAccount(session.accountId);
      await refreshMe(session);
    } catch (failure) {
      console.error("The approval didn’t go through", failure);
      setError(
        (failure instanceof AppError &&
          failure.code &&
          failures[failure.code]) ||
          "The approval didn’t go through. Try again in a moment.",
      );
    } finally {
      setBusy(false);
    }
  };
  const progress = () => {
    if (!view?.learnerId) return;
    useLearnerStore.getState().select(view.learnerId);
    void navigate({ to: "/$", params: { _splat: "progress" } });
  };
  const teachers = view ? teacherLine(view.teachers) : "";
  return (
    <main className={school.inviteCard} data-dense>
      <Brand for={null} />
      {page.isError ? (
        <>
          <h1>This page isn’t yours</h1>
          <p>
            Open the link from your email while signed in with the account that
            opened it first.
          </p>
          <Link to={"/family" as never} className={buttonClass("secondary")}>
            Open Family
          </Link>
        </>
      ) : !view || !me?.signedIn ? (
        <div className={styles.wait}>
          <Loading />
        </div>
      ) : view.status === "approved" ? (
        <>
          <h1>
            {child} is in {view.className}
          </h1>
          <p>
            {teachers} gives {child} the class code and three pictures to sign
            in with. {child}’s learning is yours: see it any time, and withdraw
            consent or delete it in Family.
          </p>
          <div className={styles.access} data-access>
            {view.access.active && view.access.endsAt ? (
              <>
                <span>Access</span>
                <strong>
                  Through {DAY.format(new Date(view.access.endsAt))}
                </strong>
              </>
            ) : view.canPractice && view.freeAllowance ? (
              <>
                <span>Free practice</span>
                <strong>
                  {view.freeAllowance.problems.remaining} problems left
                </strong>
              </>
            ) : (
              <>
                <span>Needs access</span>
                <strong>{child} can practice once access is added</strong>
              </>
            )}
          </div>
          <div className={styles.actions}>
            {!view.access.active && (
              <Link
                to="/$"
                params={{ _splat: "family" }}
                className={buttonClass("primary")}
              >
                Buy a license for {child}
              </Link>
            )}
            <Button variant="secondary" onClick={progress}>
              See {child}’s progress
            </Button>
            <Link
              to="/$"
              params={{ _splat: "family" }}
              className={buttonClass("secondary")}
            >
              Consent and privacy
            </Link>
          </div>
        </>
      ) : view.status === "open" ? (
        <>
          <h1>
            {view.childName ?? "Your child"} is invited to {view.className}
          </h1>
          <dl className={styles.about}>
            <div className={styles.fact}>
              <dt>Who teaches it</dt>
              <dd>{teachers}</dd>
            </div>
            <div className={styles.fact}>
              <dt>What it is</dt>
              <dd>
                A class on AMP, the adaptive math practice. Each child practices
                at their own level, from counting to precalculus.
              </dd>
            </div>
            <div className={styles.fact}>
              <dt>What the teacher sees</dt>
              <dd>
                {child}’s work in the class: the class map, today’s practice,
                grades and workbooks.
              </dd>
            </div>
            <div className={styles.fact}>
              <dt>What stays yours</dt>
              <dd>
                Your account, your other children and billing. Only you can
                withdraw consent or delete {child}’s data.
              </dd>
            </div>
          </dl>
          {view.consentActive ? (
            <form
              className={styles.step}
              onSubmit={(event) => {
                event.preventDefault();
                void approve();
              }}
            >
              <TextField
                label="Your child’s first name"
                autoComplete="off"
                value={name}
                maxLength={60}
                error={nameError}
                onChange={(event) => {
                  setName(event.target.value);
                  setNameError("");
                }}
              />
              {/* It sets where their practice starts. */}
              {view.asksBirthYear && (
                <div className={controls.field}>
                  <span aria-hidden="true">Your child’s birth year</span>
                  <BirthYearPicker
                    label="Your child’s birth year"
                    adult={false}
                    value={birthYear}
                    disabled={busy}
                    onChange={(value) => {
                      setBirthYear(value);
                      setBirthYearError("");
                    }}
                  />
                  <span className={controls.fieldError} aria-live="polite">
                    {birthYearError}
                  </span>
                </div>
              )}
              <Button
                variant="primary"
                type="submit"
                aria-busy={busy}
                disabled={busy}
              >
                Approve {child} joining
              </Button>
            </form>
          ) : (
            <div className={styles.step}>
              <p>
                To approve, give your consent as {child}’s parent. Buying{" "}
                {child}’s license records it, and you approve right after.
              </p>
              <Link
                to="/start/plan"
                className={buttonClass("primary")}
                data-buy
              >
                Buy a license for {child}
              </Link>
            </div>
          )}
        </>
      ) : (
        <>
          <h1>
            {view.status === "expired"
              ? "This link has expired"
              : `${child === "your child" ? "Your child isn’t" : `${child} isn’t`} in ${view.className} now`}
          </h1>
          <p>
            {view.status === "expired"
              ? `Ask ${teachers} to send it again.`
              : "The class ended this place, or the link was withdrawn. Your child’s learning stays yours."}
          </p>
          <Link
            to="/$"
            params={{ _splat: "family" }}
            className={buttonClass("secondary")}
          >
            Open Family
          </Link>
        </>
      )}
      <Toast message={error} onDismiss={() => setError("")} />
    </main>
  );
}
