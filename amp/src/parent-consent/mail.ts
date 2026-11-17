import { renderEmail } from "../email/email.js";
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
  const notice = input.stage === "confirmation";
  const subject = notice
    ? "Your learning consent is active"
    : "Review your child's learning privacy notice";
  const purpose = notice
    ? "This confirms the parental consent recently given from your parent account. Learning access is active. You do not need to do anything."
    : "Your email address was provided to request parental consent. We need your consent before collecting personal information about your child. No child profile is needed to complete this request.";
  // The direct notice (16 CFR 312.4(c)) and email plus's confirmatory notice
  // (16 CFR 312.5(b)(2)). Both parts carry every line; HTML only presents it.
  return {
    idempotencyKey: input.idempotencyKey,
    recipient: input.recipient,
    ...renderEmail({
      origin: link.origin,
      subject,
      heading: subject,
      preheader: purpose,
      body: [
        {
          lines: [
            n.operator.name,
            n.operator.address,
            n.operator.telephone,
            n.operator.email,
          ],
        },
        "",
        `Privacy notice ${n.version}`,
        purpose,
        "Information collected after consent:",
        {
          list: n.childData.map(
            (d) => `${d.category}: ${d.purpose}. Retention: ${d.retention}`,
          ),
        },
        "Service providers supporting internal operations:",
        {
          list: n.processors.map(
            (d) =>
              `${d.name} (${d.service}): ${d.data}; ${d.purpose}. Retention: ${d.retention}`,
          ),
        },
        "This enrollment method supports only the reviewed internal-use data practices described here. It does not authorize other disclosure of children's personal information.",
        `Privacy policy: ${n.privacyUrl}`,
        `Review, withdrawal and deletion: ${n.reviewAndDeletion}`,
        `You may revoke consent at any time in your parent account: ${n.parentAccountUrl}. Withdrawing consent stops learning access; deleting learning information is a separate available action.`,
        notice
          ? `Completed evidence is retained while consent is active and for ${n.withdrawnEvidenceDays} days after withdrawal. Purpose: ${n.evidenceRetentionPurpose}.`
          : `If you do not respond within ${n.pendingContactDays} days, the pending contact and link records will be deleted. Completed evidence is retained while consent is active and for ${n.withdrawnEvidenceDays} days after withdrawal. Purpose: ${n.evidenceRetentionPurpose}.`,
        ...(notice
          ? [
              `If you did not give this consent, or want to withdraw it, revoke it in your parent account: ${n.parentAccountUrl}`,
            ]
          : [
              `Sign in to the same parent account, review this notice and affirm that you are the parent or legal guardian. Access starts as soon as you do. A short confirmation notice follows at least ${policy.confirmationDelayHours} hours later; it needs no reply.`,
              {
                button: { label: "Review and respond", url: link.href },
                lead: "Review and respond:",
                sameLine: true,
              },
              "Opening the link does not grant consent. If you did not request this, do not respond; the pending request expires.",
            ]),
      ],
    }),
  };
}
