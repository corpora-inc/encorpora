import { useState } from "react";
import {
  AGREEMENT_VERSION,
  agreementTitle,
  agreementLead,
  agreementSections,
} from "../../../../schools/agreement";
import { Button } from "../../../ui/Button";
import { Checkbox } from "../../../ui/Checkbox";
import { Sheet } from "../../../ui/Sheet";
import { TextField } from "../../../ui/TextField";
import styles from "./Pilot.module.css";

/** Who signs, and one tick that accepts the student data agreement. The
 * agreement opens from its name in that line, and accepting there ticks it. */
export function Authorization({
  name,
  title,
  authorized,
  onName,
  onTitle,
  onAuthorized,
  errors = {},
  disabled = false,
  scope = "class",
  acceptedAt,
}: {
  name: string;
  title: string;
  authorized: boolean;
  onName: (value: string) => void;
  onTitle: (value: string) => void;
  onAuthorized: (value: boolean) => void;
  errors?: { name?: string; title?: string };
  disabled?: boolean;
  scope?: "class" | "school" | "district";
  acceptedAt?: string;
}) {
  const [reading, setReading] = useState(false);
  const [editSigner, setEditSigner] = useState(false);
  const agreement = (
    <button
      type="button"
      className={styles.inlineLink}
      onClick={(event) => {
        event.preventDefault();
        setReading(true);
      }}
    >
      student data agreement
    </button>
  );
  return (
    <>
      {acceptedAt && !editSigner ? (
        // Already accepted at this version: one line, and the way to change
        // who signs (which asks for the agreement again).
        <div className={styles.covered}>
          <p>
            Covered by your agreement of{" "}
            <span className={styles.nowrap}>
              {new Intl.DateTimeFormat(undefined, {
                month: "short",
                day: "numeric",
              }).format(new Date(acceptedAt))}
            </span>
          </p>
          <Button
            variant="quiet"
            disabled={disabled}
            onClick={() => {
              setEditSigner(true);
              // A new signer accepts for themselves.
              onName(name);
            }}
          >
            Change
          </Button>
        </div>
      ) : (
        <div className={styles.pair}>
          <TextField
            label="Your name"
            value={name}
            onChange={(event) => onName(event.target.value)}
            autoComplete="name"
            maxLength={100}
            error={errors.name}
            disabled={disabled}
          />
          <TextField
            label="Your role"
            value={title}
            onChange={(event) => onTitle(event.target.value)}
            autoComplete="organization-title"
            maxLength={100}
            error={errors.title}
            disabled={disabled}
          />
        </div>
      )}
      {(!acceptedAt || editSigner) && (
        <Checkbox
          checked={authorized}
          onChange={onAuthorized}
          disabled={disabled}
        >
          {scope === "district" ? (
            <>
              I’m authorized to connect this district and accept the {agreement}
              .
            </>
          ) : scope === "school" ? (
            <>I’m authorized to accept the {agreement} for this school.</>
          ) : (
            <>
              My school authorizes me to use AMP with this class, and I accept
              the {agreement}.
            </>
          )}
        </Checkbox>
      )}
      <Sheet
        open={reading}
        onOpenChange={setReading}
        title={agreementTitle}
        description={`Version ${AGREEMENT_VERSION}`}
        tall
      >
        <div className={styles.agreement}>
          <p>{agreementLead}</p>
          {agreementSections.map((section) => (
            <section key={section.heading}>
              <h3>{section.heading}</h3>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
          <div className={styles.agreementAccept}>
            <Button
              variant="primary"
              disabled={disabled}
              onClick={() => {
                onAuthorized(true);
                setReading(false);
              }}
            >
              I’m authorized and accept
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
