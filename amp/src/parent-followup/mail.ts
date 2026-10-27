import type { FollowupStage } from "./contracts.js";
export interface FollowupMail {
  from: string;
  to: string;
  reply_to: string;
  subject: string;
  text: string;
  headers: Record<string, string>;
}
export interface MailConfig {
  origin: string;
  sender: string;
  postalAddress: string;
  apiKey: string;
}
export function followupMail(
  config: MailConfig,
  input: {
    email: string;
    program: string | null;
    token: string;
    stage: FollowupStage;
  },
): FollowupMail {
  const program =
    input.program === "ar-efa"
      ? {
          name: "Arkansas Education Freedom Account",
          short: "Arkansas EFA",
          path: "arkansas-efa",
        }
      : input.program === "az-esa"
        ? {
            name: "Arizona Empowerment Scholarship Account",
            short: "Arizona ESA",
            path: "arizona-esa",
          }
        : null;
  const trial = new URL("/sign-in", config.origin);
  trial.searchParams.set("return", "free-practice");
  if (input.program) trial.searchParams.set("program", input.program);
  const funding = program
    ? new URL(`/purchase/${program.path}`, config.origin).href
    : new URL("/try/plans", config.origin).href;
  const optout = new URL(
    `/api/v1/parent-followup/unsubscribe/${input.token}`,
    config.origin,
  ).href;
  const welcome = input.stage === "welcome";
  const paragraphs = welcome
    ? [
        "Your free AMP account is ready.",
        "AMP — Adaptive Math Pathways — finds the right level and chooses the next lesson as you answer. Try up to 100 free problems, with explanations when you need them. No payment card required.",
        `Start or return to free practice:\n${trial.href}`,
        "Free practice resumes on the browser where you started it. You can start on another device too.",
        ...(program
          ? [
              `Have ${program.short} funds? Corpora Inc is an approved vendor. Eligible, available funds can cover the full cost of AMP. We’ll help with the purchase steps:\n${funding}`,
            ]
          : []),
      ]
    : [
        program
          ? `Put your ${program.short} funds toward a math program that plans the next lesson for you.`
          : "Ready for another look at AMP?",
        "Catch up, get ahead, or add focused practice alongside school. AMP adapts question by question, so you can spend time learning instead of deciding what to work on next.",
        ...(program
          ? [
              `Corpora Inc, the maker of AMP, is an approved vendor for the ${program.name} program. You can use eligible, available scholarship funds to cover AMP. Get your invoice and the payment steps here:\n${funding}`,
            ]
          : [`See learning options:\n${funding}`]),
        `You can continue free practice whenever you’re ready:\n${trial.href}`,
        "Free practice resumes on the browser where you started it.",
      ];
  paragraphs.push(
    "Need a hand choosing a level or paying with your funds? Reply to this email or write to support@corpora.inc. We’re happy to help.",
    `Corpora Inc\n${config.postalAddress}`,
    `You requested free-account emails from AMP. Stop optional emails:\n${optout}`,
  );
  return {
    from: config.sender,
    to: input.email,
    reply_to: "support@corpora.inc",
    subject: welcome
      ? "Your free AMP account is ready"
      : program
        ? `Your ${program.short} funds can cover AMP`
        : "A math path built around you",
    text: paragraphs.join("\n\n"),
    headers: {
      "List-Unsubscribe": `<${optout}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}
export function followupConfiguration(
  env: NodeJS.ProcessEnv,
): MailConfig | null {
  if (env.AMP_PARENT_FOLLOWUP !== "enabled") return null;
  const origin = env.AMP_ACCOUNTS_URL;
  const sender = env.AMP_MAIL_FROM;
  const apiKey = env.AMP_MAIL_RESEND_API_KEY;
  const postalAddress = env.AMP_PARENT_FOLLOWUP_POSTAL_ADDRESS?.trim();
  if (
    !origin ||
    new URL(origin).origin !== origin ||
    !origin.startsWith("https:") ||
    !sender ||
    /[\r\n]/.test(sender) ||
    !apiKey ||
    !postalAddress
  )
    throw new Error("Parent follow-up mail configuration is incomplete");
  return { origin, sender, apiKey, postalAddress };
}
