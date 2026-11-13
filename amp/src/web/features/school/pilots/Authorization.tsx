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

export function Authorization({
  name,
  title,
  authorized,
  onName,
  onTitle,
  onAuthorized,
  disabled = false,
  scope = "class",
}: {
  name: string;
  title: string;
  authorized: boolean;
  onName: (value: string) => void;
  onTitle: (value: string) => void;
  onAuthorized: (value: boolean) => void;
  disabled?: boolean;
  scope?: "class" | "district";
}) {
  const [reading, setReading] = useState(false);
  return (
    <section
      className={styles.form}
      aria-label={
        scope === "district" ? "District authorization" : "Class authorization"
      }
    >
      <div className={styles.pair}>
        <TextField
          label="Your name"
          value={name}
          onChange={(event) => onName(event.target.value)}
          autoComplete="name"
          maxLength={100}
          required
          disabled={disabled}
        />
        <TextField
          label="Your role at the school"
          value={title}
          onChange={(event) => onTitle(event.target.value)}
          autoComplete="organization-title"
          placeholder="Teacher"
          maxLength={100}
          required
          disabled={disabled}
        />
      </div>
      <Button type="button" variant="quiet" onClick={() => setReading(true)}>
        Read the student data agreement
      </Button>
      <Checkbox
        checked={authorized}
        onChange={onAuthorized}
        disabled={disabled}
      >
        {scope === "district"
          ? "I am authorized to connect this district to AMP, share its selected roster, and accept the student data agreement for the district."
          : "I am authorized by my school to use AMP with this class, share its roster, and accept the student data agreement for this use."}
      </Checkbox>
      <Sheet
        open={reading}
        onOpenChange={setReading}
        title={agreementTitle}
        description={`Version ${AGREEMENT_VERSION}`}
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
        </div>
      </Sheet>
    </section>
  );
}
