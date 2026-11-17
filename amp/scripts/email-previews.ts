/**
 * Every email AMP sends, rendered from its real composer with synthetic data.
 * scripts/render-emails.ts writes them out for review; tests/email.test.ts
 * checks each one. A new email adds its entry here.
 */
import type { Email } from "../src/email/email.js";
import {
  linkedEmail,
  signUpCodeEmail,
  type LinkedMessage,
} from "../src/email/email.js";
import {
  confirmationMessage,
  existingAccountEmail,
  resetPasswordEmail,
} from "../src/server/sign-in-methods.js";
import { secondParentInvitation } from "../src/family/second-parent.js";
import { approvalRequest } from "../src/family/approvals.js";
import { setupInvitation } from "../src/schools/onboarding.js";
import { seatRequest, staffInvitation } from "../src/schools/setup-routes.js";
import { integrationRequest } from "../src/schools/org-routes.js";
import { schoolInquiry } from "../src/schools/share-routes.js";
import { followupMail, type MailConfig } from "../src/parent-followup/mail.js";
import { consentMail } from "../src/parent-consent/mail.js";
import type { ConsentPolicy } from "../src/parent-consent/contracts.js";
import { fundedActivationMail } from "../src/funding-purchase/activation-mail.js";
import { fundingInvoiceMail } from "../src/funding-purchase/invoice-mail.js";
import { invoiceReminderMail } from "../src/funding-purchase/reminder-mail.js";

/** The production origin, so the mark loads in a preview. Every address,
 * token and identifier below is synthetic. */
const origin = "https://amp.corpora.inc";
const token = "SYNTHETIC-PREVIEW-TOKEN";
const invoice = "00000000-0000-4000-8000-000000000001";
const recipient = "parent@example.com";

const followup: MailConfig = {
  origin,
  sender: "AMP <hello@example.com>",
  postalAddress: "100 Example Street, Springfield, ST 00000",
  apiKey: "re_synthetic_preview_key",
};

const policy: ConsentPolicy = {
  enabled: true,
  confirmationDelayHours: 24,
  review: {
    reference: "preview",
    expiresAt: "2099-01-01T00:00:00.000Z",
    noDisclosureUnder312_2: true,
    providerContractsReviewed: true,
    deploymentFlowsComplete: true,
    paymentNotificationsReviewed: true,
  },
  notice: {
    version: "preview-v1",
    operator: {
      name: "Example Operator",
      address: "100 Example Street, Springfield, ST 00000",
      telephone: "+1 202 555 0100",
      email: "privacy@example.com",
    },
    privacyUrl: `${origin}/privacy`,
    parentAccountUrl: `${origin}/`,
    childData: [
      {
        category: "Learner nickname and math answers",
        purpose: "Choose and explain the next problem",
        retention: "Until a parent deletes it or the account closes",
      },
      {
        category: "Birth year",
        purpose: "Start practice at a suitable level",
        retention: "Until a parent deletes it or the account closes",
      },
    ],
    processors: [
      {
        name: "Example hosting",
        service: "Database hosting",
        data: "Account-linked learning records",
        purpose: "Internal service operations only",
        retention: "Documented deletion and backup limits",
      },
      {
        name: "Resend",
        service: "Transactional mail",
        data: "Parent address and direct notice",
        purpose: "The two consent notices",
        retention: "Provider log retention",
      },
    ],
    reviewAndDeletion:
      "Use the parent Privacy workspace to review, withdraw, export or delete learning data. Contact privacy@example.com for help.",
    pendingContactDays: 7,
    withdrawnEvidenceDays: 30,
    evidenceRetentionPurpose:
      "Resolve recent consent and withdrawal disputes without retaining contact addresses",
  },
};

const linked = (message: LinkedMessage) => linkedEmail(origin, message);
const signIn = `${origin}/sign-in`;
const reset = `${origin}/reset-password/${token}`;
const consent = (stage: "initial" | "confirmation") =>
  consentMail(policy, {
    id: invoice,
    token,
    recipient,
    stage,
    idempotencyKey: `amp-consent:${invoice}`,
    noticeHash: "0".repeat(64),
  });
const funding = {
  invoiceId: invoice,
  recipient,
  instructions:
    "Sign in to ClassWallet, choose DirectPay, and upload the invoice.",
  programName: "Arizona ESA",
  destinationUrl: "https://example.com/classwallet",
  billingUrl: `${origin}/account/billing`,
  pdfBase64: "",
};

export interface EmailPreview {
  id: string;
  /** Who gets it and when. */
  title: string;
  email: Email;
}

export function emailPreviews(): EmailPreview[] {
  return [
    {
      id: "sign-up-code",
      title: "Sign-up code",
      email: signUpCodeEmail({ code: "428193", origin, expiresInMinutes: 10 }),
    },
    {
      id: "confirm-email-parent",
      title: "Confirm a parent account's address",
      email: linked(
        confirmationMessage("AMP", false, `${origin}/verify-email?t=${token}`),
      ),
    },
    {
      id: "confirm-email-school",
      title: "Confirm a school account's address",
      email: linked(
        confirmationMessage("AMP", true, `${origin}/verify-email?t=${token}`),
      ),
    },
    {
      id: "reset-password",
      title: "Password reset (account with a password)",
      email: resetPasswordEmail("AMP", ["password"], signIn, reset),
    },
    {
      id: "reset-password-provider",
      title: "Password reset (account that signs in with Google)",
      email: resetPasswordEmail("AMP", ["google", "passkey"], signIn, reset),
    },
    {
      id: "existing-account",
      title: "Sign-up with an address that has an account (password)",
      email: existingAccountEmail("AMP", ["password"], {
        signIn,
        forgot: `${origin}/sign-in/forgot`,
      }),
    },
    {
      id: "existing-account-provider",
      title: "Sign-up with an address that has an account (Google)",
      email: existingAccountEmail("AMP", ["google"], {
        signIn,
        forgot: `${origin}/sign-in/forgot`,
      }),
    },
    {
      id: "second-parent-invitation",
      title: "Invitation to a family's second parent",
      email: linked(
        secondParentInvitation(
          "Jordan",
          "Jordan's family",
          `${origin}/join/${token}`,
        ),
      ),
    },
    {
      id: "family-approval",
      title: "A teacher asks a parent to approve a child joining",
      email: linked(
        approvalRequest(
          "Ms. Example",
          "Room 12 Math",
          `${origin}/approve/${token}`,
        ),
      ),
    },
    {
      id: "school-setup-invitation",
      title: "A new school's admin invitation",
      email: linked(
        setupInvitation({
          name: "Example Elementary",
          setupUrl: `${origin}/school/setup/${token}`,
        }),
      ),
    },
    {
      id: "school-staff-invitation",
      title: "A school invites a teacher",
      email: linked(
        staffInvitation(
          "Example Elementary",
          "teacher",
          `${origin}/join/${token}`,
        ),
      ),
    },
    {
      id: "school-seat-request",
      title: "Seat request (to Corpora)",
      email: linked(
        seatRequest({
          name: "Example Elementary",
          orgId: "org-example",
          seats: 120,
          view: { used: 98, seats: 100, waiting: 6 },
          requester: "admin@example.com",
          note: "Two more classes start in January.",
          origin,
        }),
      ),
    },
    {
      id: "school-integration-request",
      title: "Integration request (to Corpora)",
      email: linked(
        integrationRequest({
          name: "Example Elementary",
          label: "Clever",
          orgId: "org-example",
          requester: "admin@example.com",
          origin,
        }),
      ),
    },
    {
      id: "school-inquiry",
      title: "School inquiry from the public form (to Corpora)",
      email: linked(
        schoolInquiry(
          {
            name: "Alex Example",
            email: "alex@example.com",
            school: "Example Middle School",
            students: 240,
            message:
              "We would like to pilot AMP with two sixth-grade classes.\n\nCan we start next week?",
          },
          origin,
        ),
      ),
    },
    {
      id: "followup-welcome",
      title: "Free account welcome",
      email: followupMail(followup, {
        email: recipient,
        program: null,
        token,
        stage: "welcome",
        hasPlace: false,
      }),
    },
    {
      id: "followup-welcome-esa",
      title: "Free account welcome (Arizona ESA)",
      email: followupMail(followup, {
        email: recipient,
        program: "az-esa",
        token,
        stage: "welcome",
        hasPlace: false,
      }),
    },
    {
      id: "followup-reminder",
      title: "Free account follow-up",
      email: followupMail(followup, {
        email: recipient,
        program: null,
        token,
        stage: "reminder",
        hasPlace: true,
      }),
    },
    {
      id: "followup-reminder-esa",
      title: "Free account follow-up (Arizona ESA)",
      email: followupMail(followup, {
        email: recipient,
        program: "az-esa",
        token,
        stage: "reminder",
        hasPlace: true,
      }),
    },
    {
      id: "consent-request",
      title: "Parental consent: direct notice",
      email: consent("initial"),
    },
    {
      id: "consent-confirmation",
      title: "Parental consent: confirmatory notice",
      email: consent("confirmation"),
    },
    {
      id: "funded-access-ready",
      title: "Funded purchase: access ready",
      email: fundedActivationMail({
        requestId: invoice,
        recipient,
        link: `${origin}/`,
      }),
    },
    {
      id: "funded-next-term",
      title: "Funded purchase: next term confirmed",
      email: fundedActivationMail({
        requestId: invoice,
        recipient,
        link: `${origin}/`,
        scheduled: {
          period: "month",
          startsAt: "2026-12-01",
          endsAt: "2027-01-01",
        },
      }),
    },
    {
      id: "funding-invoice",
      title: "Program invoice and next steps",
      email: fundingInvoiceMail({ ...funding, submitBy: "2026-12-01" }),
    },
    {
      id: "invoice-reminder-submit",
      title: "Invoice reminder: submit",
      email: invoiceReminderMail({
        ...funding,
        kind: "submission",
        deadline: "2026-12-01",
      }),
    },
    {
      id: "invoice-reminder-payment",
      title: "Invoice reminder: awaiting payment",
      email: invoiceReminderMail({
        ...funding,
        kind: "processing",
        deadline: "2026-12-15",
      }),
    },
  ];
}
