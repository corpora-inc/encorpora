#!/usr/bin/env node
// Seed the code registry + partner rows into the corpan-iap DynamoDB table.
// Idempotent (plain PutItem overwrites the META rows). Run from the deploy
// machine with AWS creds + region set. See IAP_DEPLOY_RUNBOOK.md.
//
//   IAP_TABLE=corpan-iap AWS_REGION=us-east-2 AWS_PROFILE=corpan-publisher \
//     node seed_registry.js
//
// To DRY-RUN (print what would be written, no AWS calls):
//   node seed_registry.js --dry-run

const { CODES, PARTNERS } = require("./registry_seed");

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const table = process.env.IAP_TABLE || "corpan-iap";

  const items = [];
  for (const [code, body] of Object.entries(CODES)) {
    items.push({ PK: `CODE#${code}`, SK: "META", ...body });
  }
  for (const [pid, body] of Object.entries(PARTNERS)) {
    items.push({ PK: `PARTNER#${pid}`, SK: "META", ...body });
  }

  if (dryRun) {
    console.log(`[seed] DRY RUN — would write ${items.length} items to ${table}:`);
    for (const it of items) console.log("  -", it.PK, it.SK);
    console.log(JSON.stringify(items, null, 2));
    return;
  }

  const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
  const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  });

  for (const Item of items) {
    await doc.send(new PutCommand({ TableName: table, Item }));
    console.log(`[seed] wrote ${Item.PK} / ${Item.SK}`);
  }
  console.log(`[seed] done — ${items.length} items into ${table}`);
}

main().catch((err) => {
  console.error("[seed] FAILED:", err);
  process.exit(1);
});
