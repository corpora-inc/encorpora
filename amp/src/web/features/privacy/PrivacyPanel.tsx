import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { SignedInMe } from "../../../account/contracts";
import { nativeRuntime } from "../../native-runtime";
import { meOptions } from "../../lib/query";
import { messageFor } from "../../lib/report-error";
import { useSession } from "../../lib/session";
import { Button } from "../../ui/Button";
import { Disclosure } from "../../ui/Disclosure";
import { EmptyState } from "../../ui/EmptyState";
import { LegalDocuments } from "../account/LegalDocuments";
import {
  PRIVACY_PANELS,
  usePanel,
  type PrivacyPanelId,
} from "../account/panels";
import { secondParentOnly } from "../second-parent/api";
import { ConsentPanel } from "./ConsentPanel";
import { ExportData } from "./ExportData";
import { LearningDataDelete } from "./LearningDataDelete";
import styles from "./Privacy.module.css";
import { PurchaseMeasurement } from "./PurchaseMeasurement";
import { RetentionNote } from "./RetentionNote";

const TITLES: Record<PrivacyPanelId, string> = {
  consent: "Learning permission",
  export: "Download your data",
  delete: "Delete learning data",
  retention: "Data retention",
  measurement: "Advertising preferences",
  documents: "Policies & documents",
};

const PROVIDERS = [
  ["google", "purchaseMeasurement"],
  ["meta", "metaPurchaseMeasurement"],
  ["openai", "openaiPurchaseMeasurement"],
] as const;

/** What this reader's account holds, for choosing its panels. */
function holdings(me: SignedInMe) {
  const learners = me.family.learners.filter((entry) => !entry.deletedAt);
  return {
    children: learners.some((entry) => !entry.adult),
    own: learners.some((entry) => entry.adult && !entry.simulation),
    holder: !secondParentOnly(me),
  };
}

/**
 * Which panels this reader sees, in order (IA v2 §3.6, "Shown to"):
 * - Learning permission: the account holder, when the family has children
 *   or its consent is withdrawn. A second parent's family's consent is the
 *   holder's, and an adult on their own has nothing to consent to.
 * - Delete learning data: the holder of children's records, or an adult
 *   with their own learning record.
 * - Advertising preferences: the web, when any recipient is available
 *   (the app stores carry no purchase measurement).
 * - Everyone: download, retention, policies and documents.
 */
export function privacyPanelsFor(
  me: SignedInMe,
  native = nativeRuntime,
): PrivacyPanelId[] {
  const { children, own, holder } = holdings(me);
  const shown: Record<PrivacyPanelId, boolean> = {
    consent: holder && (children || me.family.consent.status === "withdrawn"),
    export: true,
    delete: (holder && children) || own,
    retention: true,
    measurement:
      !native && PROVIDERS.some(([, key]) => me.family[key]?.available),
    documents: true,
  };
  return PRIVACY_PANELS.filter((id) => shown[id]);
}

/**
 * The account's privacy and data, as panels folded one under another, one
 * open at a time and none with an address (IA v2 §3.6). Which is open is
 * the account's panel store (features/account/panels.ts), so a refresh or a legacy address
 * opens the same one. No panel opens another layer: each action and its
 * one confirmation happen inside it.
 *
 * Every panel cites the requirement it meets where it is built
 * (ConsentPanel, ExportData, LearningDataDelete, RetentionNote,
 * PurchaseMeasurement, LegalDocuments).
 */
export function PrivacyPanel() {
  const session = useSession();
  const me = useQuery(meOptions(session));
  const [open, setOpen] = usePanel(session.accountId, "privacy");
  if (me.error && !me.data)
    return (
      <EmptyState
        title="Privacy didn’t load"
        action={
          <Button variant="primary" onClick={() => void me.refetch()}>
            Try again
          </Button>
        }
      >
        {messageFor(me.error, "Check your connection, then try again.")}
      </EmptyState>
    );
  if (!me.data?.signedIn)
    return (
      <div className={styles.skeleton} aria-busy="true">
        {PRIVACY_PANELS.map((id) => (
          <div key={id} className={`amp-skeleton ${styles.skeletonRow}`} />
        ))}
      </div>
    );
  const account = me.data;
  const { children } = holdings(account);
  const body = (id: PrivacyPanelId): ReactNode => {
    switch (id) {
      case "consent":
        return <ConsentPanel />;
      case "export":
        return <ExportData family={children} />;
      case "delete":
        return <LearningDataDelete family={children} />;
      case "retention":
        return <RetentionNote retained={account.family.retained} />;
      case "measurement":
        return PROVIDERS.map(([provider, key]) => {
          const view = account.family[key];
          return view?.available ? (
            <PurchaseMeasurement
              key={`${session.accountId}:${provider}`}
              provider={provider}
              view={view}
            />
          ) : null;
        });
      case "documents":
        return <LegalDocuments />;
    }
  };
  return (
    <div className={styles.panels} data-privacy-panels="">
      {privacyPanelsFor(account).map((id) => (
        <Disclosure
          key={id}
          summary={TITLES[id]}
          open={open === id}
          onOpenChange={(now) => {
            if (now) setOpen(id);
            else if (open === id) setOpen(null);
          }}
        >
          <div data-privacy-panel={id}>{body(id)}</div>
        </Disclosure>
      ))}
    </div>
  );
}
