import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
export const learners = pgTable(
  "amp_learners",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("amp_learners_account_idx").on(t.accountId)],
);
export const instances = pgTable(
  "amp_instances",
  {
    id: text("id").primaryKey(),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    content: jsonb("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("amp_instances_learner_idx").on(t.learnerId)],
);
export const attempts = pgTable(
  "amp_attempts",
  {
    id: text("id").primaryKey(),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    problemId: text("problem_id")
      .notNull()
      .references(() => instances.id, { onDelete: "cascade" }),
    requestId: text("request_id").notNull(),
    outcome: jsonb("outcome").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("amp_attempts_request_idx").on(t.learnerId, t.requestId),
    uniqueIndex("amp_attempts_problem_idx").on(t.problemId),
  ],
);
export const grants = pgTable(
  "amp_grants",
  {
    id: text("id").primaryKey(),
    learnerId: text("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    externalOrderId: text("external_order_id").notNull(),
    status: text("status").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("amp_grants_source_idx").on(t.channel, t.externalOrderId),
  ],
);
export const contentReleases = pgTable("amp_content_releases", {
  id: text("id").primaryKey(),
  version: integer("version").notNull(),
  manifest: jsonb("manifest").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
