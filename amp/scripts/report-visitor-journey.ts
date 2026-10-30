import { readFile } from "node:fs/promises";
import { z } from "zod";
import { createDatabasePool } from "../src/server/database.js";
import { visitorJourneyReport } from "../src/analytics/visitor-journey-report.js";
const args = process.argv.slice(2);
const value = (key: string) => {
  const i = args.indexOf(key);
  return i < 0 ? undefined : args[i + 1];
};
if (!process.env.AMP_DATABASE_URL)
  throw new Error("AMP_DATABASE_URL is required");
const pool = createDatabasePool({
  connectionString: process.env.AMP_DATABASE_URL,
});
try {
  const email = value("--email");
  const report = await visitorJourneyReport(pool, {
    email,
    visitor: value("--visitor"),
    days: Number(value("--days") ?? 30),
  });
  const ledger = value("--outreach-file");
  if (ledger && email) {
    const rows = z
      .array(
        z.object({
          email: z.email(),
          sent_at: z.iso.datetime(),
          status: z.string(),
          message_id: z.string().optional(),
        }),
      )
      .parse(JSON.parse(await readFile(ledger, "utf8")));
    for (const row of rows)
      if (
        row.email.toLowerCase() === email.toLowerCase() &&
        row.status === "sent" &&
        !report.timeline.some(
          (event) =>
            event.event === "founder_email_sent" &&
            ((row.message_id &&
              (event.details as { messageId?: string }).messageId ===
                row.message_id) ||
              new Date(event.at).getTime() === Date.parse(row.sent_at)),
        )
      )
        report.timeline.push({
          at: row.sent_at,
          event: "founder_email_sent",
          evidence: "private_sent_receipt",
          details: {},
        });
    report.timeline.sort(
      (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
    );
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  await pool.end();
}
