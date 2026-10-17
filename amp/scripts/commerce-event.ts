import { readFile, stat } from 'node:fs/promises';
import { Pool } from 'pg';
import { applyCommerceEvent, parseCommerceEvent } from '../src/commerce/postgres.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !args[0]) throw new Error('Usage: tsx scripts/commerce-event.ts EVENT.json (requires AMP_DATABASE_URL)');
  const databaseUrl = process.env.AMP_DATABASE_URL;
  if (!databaseUrl) throw new Error('AMP_DATABASE_URL is required; there is no default database');
  const info = await stat(args[0]);
  if (!info.isFile() || info.size > 65536) throw new Error('Event must be a regular JSON file of at most 64 KiB');
  const event = parseCommerceEvent(JSON.parse(await readFile(args[0], 'utf8')));
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    const state = await applyCommerceEvent(pool, event);
    const order = state.orders.find(item => item.id === event.orderId)!;
    process.stdout.write(JSON.stringify({ orderId: order.id, approval: order.approval, fulfillment: order.fulfillment, settlement: order.settlement, refund: order.refund, revocation: order.revocation }) + '\n');
  } finally { await pool.end(); }
}
main().catch(() => {
  // Database and validation errors can contain credentials or student data.
  process.stderr.write('Commerce event rejected. Verify arguments, AMP_DATABASE_URL, migrations, event schema, ownership and transition order. No successful import is claimed.\n');
  process.exitCode = 1;
});
