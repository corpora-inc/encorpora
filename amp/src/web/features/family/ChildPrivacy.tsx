import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { request } from "../../lib/api";
import { AppError } from "../../lib/AppError";
import { invalidateAccount } from "../../lib/query";
import { Button } from "../../ui/Button";
import { Sheet } from "../../ui/Sheet";
import pages from "../account/AccountPages.module.css";
import {
  canWithdraw,
  ConsentSummary,
  DeletionTerms,
} from "../privacy/LearningData";
import type { FamilyChild } from "./api";
import { familyHref, type FamilyPlace } from "./FamilyFrame";

const ok = z.unknown();

function failed(failure: unknown, fallback: string) {
  return failure instanceof AppError && failure.message
    ? failure.message
    : fallback;
}

/**
 * Consent, over the child's settings (no address of its own: closing it is
 * the same screen, where it was). The family's consent covers every child,
 * so it reads and withdraws the family's, in the words of the account's
 * Privacy page (privacy/LearningData).
 */
export function ConsentSheet({
  place,
  open,
  onOpenChange,
}: {
  place: FamilyPlace;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { session } = place;
  const status = place.me?.family.consent.status;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const withdraw = async () => {
    setBusy(true);
    setError("");
    try {
      await request("/family/consent/withdraw", ok, {
        token: session.token,
        body: {},
      });
      await invalidateAccount(session.accountId);
    } catch (failure) {
      console.error("Consent wasn’t withdrawn", failure);
      setError(failed(failure, "Consent wasn’t withdrawn. Try again."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setError("");
        onOpenChange(next);
      }}
      title="Consent"
    >
      <div className={pages.section} data-consent-sheet="">
        {status && <ConsentSummary status={status} />}
        {status && canWithdraw(status) && (
          <div className={pages.footActions}>
            <Button
              variant="secondary"
              className={pages.danger}
              disabled={busy}
              aria-busy={busy || undefined}
              onClick={() => void withdraw()}
            >
              Withdraw consent
            </Button>
          </div>
        )}
        {error && (
          <p role="alert" className={pages.prose}>
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}

/**
 * Delete one child's learning data, over their settings: what it removes
 * and keeps (the account's own words, privacy/LearningData), then the one
 * action. Once deleted, the child's page is gone, so the family's Today
 * replaces it.
 */
export function DeleteDataSheet({
  place,
  child,
  open,
  onOpenChange,
}: {
  place: FamilyPlace;
  child: FamilyChild;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { session, family } = place;
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const remove = async () => {
    setBusy(true);
    setError("");
    try {
      await request(
        `/family/learners/${encodeURIComponent(child.id)}/delete-learning-data`,
        ok,
        {
          token: session.token,
          body: { confirmation: "delete-learning-data" },
        },
      );
      await navigate({
        to: "/$",
        params: { _splat: familyHref(family) },
        replace: true,
      });
      await invalidateAccount(session.accountId);
    } catch (failure) {
      console.error(`${child.name}’s learning data wasn’t deleted`, failure);
      setError(failed(failure, "Nothing was deleted. Try again."));
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        if (!next) setError("");
        onOpenChange(next);
      }}
      title={`Delete ${child.name}’s learning data`}
    >
      <div className={pages.section} data-delete-sheet="">
        <DeletionTerms learner className={pages.prose} />
        <div className={pages.footActions}>
          <Button
            variant="secondary"
            className={pages.danger}
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={() => void remove()}
          >
            Delete learning data
          </Button>
        </div>
        {error && (
          <p role="alert" className={pages.prose}>
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
