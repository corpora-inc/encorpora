import type { ConsentMail, ConsentPolicy, ConsentStage } from "./contracts.js";
export function consentMail(
  policy: ConsentPolicy,
  input: {
    id: string;
    token: string;
    recipient: string;
    stage: ConsentStage;
    idempotencyKey: string;
    noticeHash: string;
  },
): ConsentMail {
  const n = policy.notice;
  const link = new URL(n.parentAccountUrl);
  link.hash = new URLSearchParams({
    consent: input.id,
    stage: input.stage,
    token: input.token,
    notice: input.noticeHash,
  }).toString();
  const operator = `${n.operator.name}\n${n.operator.address}\n${n.operator.telephone}\n${n.operator.email}`;
  return {
    idempotencyKey: input.idempotencyKey,
    recipient: input.recipient,
    subject:
      input.stage === "initial"
        ? "Review your child's learning privacy notice"
        : "Confirm or withdraw your learning consent",
    text: [
      operator,
      "",
      `Privacy notice ${n.version}`,
      "Your email address was provided to request parental consent. We need your consent before collecting personal information about your child. No child profile is needed to complete this request.",
      "Information collected after consent:",
      ...n.childData.map(
        (d) => `- ${d.category}: ${d.purpose}. Retention: ${d.retention}`,
      ),
      "Service providers supporting internal operations:",
      ...n.processors.map(
        (d) =>
          `- ${d.name} (${d.service}): ${d.data}; ${d.purpose}. Retention: ${d.retention}`,
      ),
      "This enrollment method supports only the reviewed internal-use data practices described here. It does not authorize other disclosure of children's personal information.",
      `Privacy policy: ${n.privacyUrl}`,
      `Review, withdrawal and deletion: ${n.reviewAndDeletion}`,
      `You may revoke consent at any time in your parent account: ${n.parentAccountUrl}. Withdrawing consent stops learning access; deleting learning information is a separate available action.`,
      `If you do not complete consent within ${n.pendingContactDays} days, the pending contact and link records will be deleted. Completed evidence is retained while consent is active and for ${n.withdrawnEvidenceDays} days after withdrawal. Purpose: ${n.evidenceRetentionPurpose}.`,
      input.stage === "initial"
        ? `Sign in to the same parent account, review this notice and affirm that you are the parent or legal guardian. A second notice will follow at least ${policy.confirmationDelayHours} hours after your initial response; access starts only after you affirm that confirmation.`
        : "This is the delayed confirmation of your earlier consent. You can revoke that consent instead of confirming. Access starts only after you affirm this notice in the same parent account.",
      `Review and respond: ${link.href}`,
      "Opening the link does not grant consent. If you did not request this, do not respond; the pending request expires.",
    ].join("\n\n"),
  };
}
