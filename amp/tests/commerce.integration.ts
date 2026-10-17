import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import type { CommerceEvent, OrderInput } from '../src/commerce/contracts.js';
import { applyCommerceEvent, commerceSourceId, parseCommerceEvent } from '../src/commerce/postgres.js';

const at = '2020-01-01T00:00:00.000Z';
const later = '2020-01-02T00:00:00.000Z';
const order: OrderInput = { id: 'o1', account: { id: 'parent' }, license: { accountId: 'parent', learnerId: 'child', sku: 'annual', startsAt: at, endsAt: '2030-01-01T00:00:00.000Z' }, channel: 'esa', channelReference: 'az-esa', externalOrderId: 'one', amountMinor: 10000, currency: 'USD', activationPolicy: 'after-approval' };
function created(input = order) { return { id: 'created', occurredAt: at, orderId: input.id, channel: input.channel, channelReference: input.channelReference, type: 'order.created' as const, order: input }; }
function event(type: 'order.approved' | 'order.fulfilled' | 'license.activated' | 'license.revoked', input = order) { return { id: type, occurredAt: at, orderId: input.id, channel: input.channel, channelReference: input.channelReference, type, evidence: 'reference' }; }

test('boundary parser rejects unknown fields, malformed JSON shapes and invalid timestamps', () => {
  assert.throws(() => parseCommerceEvent({ ...created(), extra: true }));
  assert.throws(() => parseCommerceEvent({ type: 'license.activated' }));
  assert.throws(() => parseCommerceEvent({ ...created(), occurredAt: '2026-02-30T00:00:00.000Z' }));
  assert.throws(() => parseCommerceEvent(created({ ...order, amountMinor: Infinity })));
  const spaced = { ...created(), id: ' created ' };
  assert.equal(parseCommerceEvent(spaced).id, ' created ', 'validation must not silently rewrite event identity');
  assert.notEqual(commerceSourceId('ab', 'c'), commerceSourceId('a', 'bc'));
});

test('PostgreSQL imports serialize, preserve events and project only authorized grants', { skip: !process.env.AMP_TEST_DATABASE_URL }, async () => {
  const connectionString = process.env.AMP_TEST_DATABASE_URL!;
  const schema = `amp_commerce_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new Pool({ connectionString, max: 1 });
  const pool = new Pool({ connectionString, max: 4, options: `-c search_path=${schema}` });
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    // Only this fresh random schema is modified. No public tables are truncated.
    await pool.query(await readFile(new URL('../migrations/0001.sql', import.meta.url), 'utf8'));
    await pool.query(await readFile(new URL('../migrations/0002-commerce.sql', import.meta.url), 'utf8'));
    await pool.query("INSERT INTO amp_learners(id,account_id,name) VALUES('child','parent','Test student')");
    const replay = await Promise.all([applyCommerceEvent(pool, created()), applyCommerceEvent(pool, created())]);
    assert.equal(replay[0]!.events.length, 1);
    assert.equal(replay[1]!.events.length, 1);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM amp_commerce_events')).rows[0].count, 1);
    await assert.rejects(applyCommerceEvent(pool, { ...created(), occurredAt: later }), /different payload/);
    await assert.rejects(applyCommerceEvent(pool, created({ ...order, id: 'bad', channelReference: 'other', license: { ...order.license, accountId: 'intruder' }, account: { id: 'intruder' } })), /purchasing account/);
    await assert.rejects(applyCommerceEvent(pool, event('license.activated')), /not eligible/);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM amp_grants')).rows[0].count, 0);
    await applyCommerceEvent(pool, event('order.approved'));
    await applyCommerceEvent(pool, event('order.fulfilled'));
    await applyCommerceEvent(pool, { ...event('license.activated'), occurredAt: later });
    const projected = (await pool.query('SELECT * FROM amp_grants')).rows[0];
    assert.equal(projected.id, 'commerce:o1');
    assert.equal(projected.external_order_id, commerceSourceId('az-esa', 'one'));
    assert.equal(projected.starts_at.toISOString(), later, 'access cannot precede issuance');
    assert.equal(projected.ends_at.toISOString(), order.license.endsAt);
    assert.equal(projected.status, 'active');
    // Identical external order IDs in different ESA programs must not collide.
    const second = { ...order, id: 'o2', channelReference: 'nc-esa-plus' };
    await applyCommerceEvent(pool, created(second));
    await applyCommerceEvent(pool, event('order.approved', second));
    await applyCommerceEvent(pool, event('order.fulfilled', second));
    await applyCommerceEvent(pool, event('license.activated', second));
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM amp_grants')).rows[0].count, 2);
    await applyCommerceEvent(pool, { ...event('license.revoked'), occurredAt: later });
    assert.equal((await pool.query("SELECT status FROM amp_grants WHERE id='commerce:o1'")).rows[0].status, 'revoked');
    assert.equal((await pool.query("SELECT status FROM amp_grants WHERE id='commerce:o2'")).rows[0].status, 'active');
    const before = (await pool.query('SELECT count(*)::int AS count FROM amp_commerce_events')).rows[0].count;
    await assert.rejects(applyCommerceEvent(pool, { ...event('license.activated'), id: 'retry-activation', occurredAt: later }), /not eligible/);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM amp_commerce_events')).rows[0].count, before, 'rejected transitions do not persist an event');
    const settled: CommerceEvent = { ...event('order.approved', second), id: 'settled', type: 'order.settled', evidence: 'settlement-reference', occurredAt: later, amountMinor: second.amountMinor, currency: second.currency };
    await applyCommerceEvent(pool, settled);
    await applyCommerceEvent(pool, { ...settled, id: 'refunded', type: 'refund.completed' });
    assert.equal((await pool.query("SELECT status FROM amp_grants WHERE id='commerce:o2'")).rows[0].status, 'revoked');
    const third = { ...order, id: 'o3', externalOrderId: 'three' };
    await applyCommerceEvent(pool, { ...created(third), id: 'created-three' });
    await applyCommerceEvent(pool, { ...event('order.approved', third), id: 'approved-three' });
    await applyCommerceEvent(pool, { ...event('order.fulfilled', third), id: 'delivered-three' });
    await pool.query("INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at) VALUES('legacy','child','esa',$1,'active',$2,$3)", [commerceSourceId(third.channelReference, third.externalOrderId), at, third.license.endsAt]);
    await assert.rejects(applyCommerceEvent(pool, { ...event('license.activated', third), id: 'activate-three' }), /duplicate key/);
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM amp_commerce_events WHERE event_id='activate-three'")).rows[0].count, 0);
    const rolledBack = (await pool.query('SELECT state FROM amp_commerce_ledger WHERE id=1')).rows[0].state;
    assert.equal(rolledBack.grants.some((grant: { orderId: string }) => grant.orderId === 'o3'), false);
    await assert.rejects(pool.query("UPDATE amp_commerce_events SET order_id='tampered'"), /append-only/);
    await assert.rejects(pool.query('DELETE FROM amp_commerce_events'), /append-only/);
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
});
