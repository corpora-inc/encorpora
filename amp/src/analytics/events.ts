import {
  purchaseAttemptSchema,
  purchaseActionSchema,
} from "./purchase-attempt.js";
import { entryContextSchema } from "./entry-context.js";
export { REFERRER_CATEGORIES, DEVICE_CLASSES } from "./entry-context.js";
import { z } from "zod";
import { siteActionSchema } from "./site-actions.js";
import { engagementSchema, TRAFFIC_KINDS, SCREENS } from "./engagement.js";

/**
 * The AMP funnel vocabulary, shared by the server and the web app. It is
 * fixed: the collection endpoint rejects any other name. Props are small,
 * closed objects with no free text, so event props cannot carry names, emails, answers or raw errors.
 * The optional envelope account scope is independently authenticated.
 */
export const FUNNEL_EVENTS = [
  "landing_view",
  "try_click",
  "placement_answer",
  "placement_done",
  "map_view",
  "practice_answer",
  "practice_skip",
  "lesson_open",
  "hint_use",
  "mastery",
  "email_saved",
  "session_start",
  "paywall_view",
  "paywall_dismiss",
  "plan_view",
  "plan_select",
  "checkout_start",
  "checkout_return",
  "purchase",
  "learner_added",
  "paid_practice_first",
  "refund_requested",
  "refund",
  "level_check_view",
  "purchase_attempt",
  "purchase_action",
  "trial_problem_view",
  "auth_failure",
  "page_view",
  "problem_rendered",
  "learning_request",
  "client_error",
  "account_session",
] as const;
export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

/** Written only by the billing code from verified provider events. */
export const SERVER_ONLY_EVENTS = [
  "purchase",
  "refund",
] as const satisfies readonly FunnelEvent[];
export type ServerOnlyEvent = (typeof SERVER_ONLY_EVENTS)[number];
export type ClientEvent =
  Exclude<FunnelEvent, ServerOnlyEvent> | "page_engagement" | "site_action";

export const GRADE_BANDS = [
  "K",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "algebra-1",
  "geometry",
  "algebra-2",
] as const;
/** Coarse bands only; a birth year is never sent. */
export const AGE_BANDS = [
  "under-6",
  "6-8",
  "9-11",
  "12-14",
  "15-plus",
] as const;
export const PAYWALL_REASONS = ["limit", "choice"] as const;
export const PAYWALL_DISMISS_REASONS = [
  "closed",
  "not-now",
  "price",
  "need-more-practice",
  "ask-another-adult",
  "other",
] as const;
export const REFUND_REASONS = [
  "not-a-fit",
  "price",
  "duplicate",
  "technical",
  "unrecognized",
  "other",
] as const;
export const PLAN_INTERVALS = ["year", "month"] as const;

const index = z.number().int().min(0).max(100_000);
const none = z.strictObject({});

export const funnelPropsSchemas = {
  page_engagement: engagementSchema,
  page_view: z.strictObject({
    screen: z.enum(SCREENS),
    page: z.enum([
      "sign-up",
      "sign-in",
      "reset-password",
      "trial-start",
      "trial-practice",
      "trial-map",
      "trial-plans",
      "funding-az",
      "funding-ar",
      "funding-nh",
      "invoice",
      "other",
    ]),
  }),
  account_session: none,
  problem_rendered: z.strictObject({ mode: z.enum(["trial", "practice"]) }),
  learning_request: z.strictObject({
    attemptId: z.uuidv4(),
    operation: z.enum([
      "problem",
      "answer",
      "skip",
      "hint",
      "progress",
      "trial",
      "catalog",
    ]),
    outcome: z.enum(["started", "succeeded", "failed", "cancelled"]),
    failure: z
      .enum([
        "authentication",
        "permission",
        "validation",
        "unavailable",
        "network",
        "contract",
      ])
      .optional(),
  }),
  client_error: z.strictObject({
    kind: z.enum(["error", "unhandled_rejection", "render"]),
    screen: z.enum(SCREENS),
  }),
  site_action: siteActionSchema,
  landing_view: entryContextSchema,
  try_click: none,
  trial_problem_view: none,
  auth_failure: z.strictObject({
    method: z.enum(["passkey", "social"]),
    reason: z.enum(["exists", "cancelled", "failed"]),
  }),
  placement_answer: z.strictObject({ index }),
  placement_done: z.strictObject({
    gradeBand: z.enum(GRADE_BANDS),
    ageBand: z.enum(AGE_BANDS).optional(),
  }),
  map_view: none,
  practice_answer: z.strictObject({ index }),
  /** A neutral pass. Per-template skip rates come from the problem records
   * (`npm run report:insights`), never from this anonymous stream. */
  practice_skip: none,
  lesson_open: none,
  hint_use: none,
  mastery: none,
  email_saved: none,
  session_start: z.strictObject({
    daysSinceFirstVisit: z.number().int().min(0).max(3650),
  }),
  paywall_view: z.strictObject({ reason: z.enum(PAYWALL_REASONS) }),
  paywall_dismiss: z.strictObject({ reason: z.enum(PAYWALL_DISMISS_REASONS) }),
  plan_view: none,
  plan_select: z.strictObject({ interval: z.enum(PLAN_INTERVALS) }),
  purchase_attempt: purchaseAttemptSchema,
  purchase_action: purchaseActionSchema,
  checkout_start: z.strictObject({ interval: z.enum(PLAN_INTERVALS) }),
  checkout_return: z.strictObject({ outcome: z.enum(["success", "cancel"]) }),
  purchase: z.strictObject({ interval: z.enum(PLAN_INTERVALS) }),
  learner_added: z.strictObject({ ageBand: z.enum(AGE_BANDS).optional() }),
  paid_practice_first: none,
  refund_requested: z.strictObject({ reason: z.enum(REFUND_REASONS) }),
  /** The free assessment's level check, shown after `index` problems. */
  level_check_view: z.strictObject({ index }),
  refund: z.strictObject({
    full: z.boolean(),
    /** A partial refund of the same purchase that later became full. */
    upgrade: z.literal(true).optional(),
    reason: z.enum(REFUND_REASONS).optional(),
  }),
} as const satisfies Record<
  FunnelEvent | "page_engagement" | "site_action",
  z.ZodType
>;

export type FunnelProps<
  E extends FunnelEvent | "page_engagement" | "site_action",
> = z.input<(typeof funnelPropsSchemas)[E]>;

/** `crypto.randomUUID()` output: a random version-4 UUID. */
export const visitorIdSchema = z.uuidv4();

/** One event inside a batch; `at` is the client's epoch-milliseconds clock. */
export const clientEventSchema = z
  .strictObject({
    event: z.enum([...FUNNEL_EVENTS, "page_engagement", "site_action"]),
    props: z.unknown().optional(),
    at: z.number().int().positive().max(8_640_000_000_000_000),
    id: z.uuidv4().optional(),
    sessionId: z.uuidv4().optional(),
  })
  .transform((value, ctx) => {
    if ((SERVER_ONLY_EVENTS as readonly string[]).includes(value.event)) {
      ctx.addIssue({ code: "custom", message: "server-only event" });
      return z.NEVER;
    }
    const props = funnelPropsSchemas[value.event].safeParse(value.props ?? {});
    if (!props.success) {
      ctx.addIssue({ code: "custom", message: "invalid props" });
      return z.NEVER;
    }
    return { ...value, props: props.data };
  });

export const MAX_EVENTS_PER_BATCH = 25;
export const MAX_BATCH_BYTES = 8192;

/** The body of `POST /api/v1/events`. `trial` is the device's trial token,
 * used by legacy clients only to read a coarse age band and never stored. */
export const eventBatchSchema = z.strictObject({
  visitorId: visitorIdSchema,
  accountScope: z.string().min(1).max(256).optional(),
  accountGeneration: z.union([z.literal("initial"), z.uuidv4()]).optional(),
  context: funnelPropsSchemas.landing_view.optional(),
  traffic: z.enum(TRAFFIC_KINDS).optional(),
  trial: z
    .string()
    .regex(/^[A-Za-z0-9_-]{16,128}$/)
    .optional(),
  events: z.array(clientEventSchema).min(1).max(MAX_EVENTS_PER_BATCH),
});
export type EventBatch = z.infer<typeof eventBatchSchema>;

/** Validate one event's props, for server-side writers and tests. */
export function parseFunnelProps<E extends FunnelEvent>(
  event: E,
  props: unknown,
): z.output<(typeof funnelPropsSchemas)[E]> {
  return funnelPropsSchemas[event].parse(props ?? {}) as z.output<
    (typeof funnelPropsSchemas)[E]
  >;
}
