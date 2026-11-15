import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { eventBatchSchema } from "../src/analytics/events.js";
import { recordEventBatch } from "../src/analytics/repository.js";
import { MARKETING_SCREENS, SITE_ACTIONS } from "../src/analytics/site-categories.js";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";

test("public resource categories and actions persist through migrated database constraints",{skip:!process.env.AMP_TEST_DATABASE_URL},async()=>{
  const target=process.env.AMP_TEST_DATABASE_URL!;
  assertTestDatabaseTarget(target);
  const schema=`amp_public_resources_${randomUUID().replaceAll("-","")}`;
  const admin=new Pool({connectionString:target,max:1});
  const scoped=new URL(target);scoped.searchParams.set("options",`-c search_path=${schema}`);
  const pool=new Pool({connectionString:scoped.href,max:1});
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const visitorId=randomUUID(),sessionId=randomUUID();
    for(const screen of MARKETING_SCREENS) {
      const batch=eventBatchSchema.parse({visitorId,events:[{event:"page_engagement",at:Date.now(),props:{sessionId,pageId:randomUUID(),ordinal:0,screen,activeMs:10,visibleMs:20}}]});
      await recordEventBatch(pool,batch);
    }
    for(const action of SITE_ACTIONS) {
      const batch=eventBatchSchema.parse({visitorId,events:[{event:"site_action",at:Date.now(),props:{eventId:randomUUID(),screen:"marketing_workbooks",action}}]});
      await recordEventBatch(pool,batch);
      await recordEventBatch(pool,batch);
    }
    assert.deepEqual((await pool.query("SELECT DISTINCT screen FROM amp_engagement_pages ORDER BY screen")).rows.map(r=>r.screen),[...MARKETING_SCREENS].sort());
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM amp_journey_actions")).rows[0].n,SITE_ACTIONS.length);
    assert.deepEqual((await pool.query("SELECT action FROM amp_journey_actions ORDER BY action")).rows.map(r=>r.action),[...SITE_ACTIONS].sort());
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
});
