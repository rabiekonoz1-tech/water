import * as SQLite from 'expo-sqlite';
import { ActivityItem, Facility, MonthlyPlan, SyncQueueItem } from '../types';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('menoufia_offline.db');
  }
  return dbPromise;
}

export async function initLocalDb() {
  const db = await getDb();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS plans_cache (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS facilities_cache (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      serial_no INTEGER NOT NULL,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS feed_cache (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sync_queue (
      queue_id TEXT PRIMARY KEY,
      facility_id TEXT NOT NULL,
      action TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

export async function savePlansCache(plans: MonthlyPlan[]) {
  const db = await getDb();
  await db.runAsync('DELETE FROM plans_cache');
  for (const p of plans) {
    await db.runAsync('INSERT INTO plans_cache (id, json, created_at) VALUES (?, ?, ?)', [
      p.id,
      JSON.stringify(p),
      p.created_at,
    ]);
  }
}

export async function getPlansCache(): Promise<MonthlyPlan[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ json: string }>('SELECT json FROM plans_cache ORDER BY created_at DESC');
  return rows.map((r) => JSON.parse(r.json));
}

export async function saveFacilitiesCache(planId: string, facilities: Facility[]) {
  const db = await getDb();
  await db.runAsync('DELETE FROM facilities_cache WHERE plan_id = ?', [planId]);
  for (const f of facilities) {
    await db.runAsync('INSERT INTO facilities_cache (id, plan_id, serial_no, json) VALUES (?, ?, ?, ?)', [
      f.id,
      planId,
      f.serial_no,
      JSON.stringify(f),
    ]);
  }
}

export async function updateFacilityLocal(facility: Facility) {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO facilities_cache (id, plan_id, serial_no, json) VALUES (?, ?, ?, ?)', [
    facility.id,
    facility.plan_id,
    facility.serial_no,
    JSON.stringify(facility),
  ]);
}

export async function getFacilitiesCache(planId: string): Promise<Facility[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ json: string }>(
    'SELECT json FROM facilities_cache WHERE plan_id = ? ORDER BY serial_no ASC',
    [planId]
  );
  return rows.map((r) => JSON.parse(r.json));
}

export async function saveFeedCache(planId: string, feed: ActivityItem[]) {
  const db = await getDb();
  await db.runAsync('DELETE FROM feed_cache WHERE plan_id = ?', [planId]);
  for (const item of feed) {
    await db.runAsync('INSERT INTO feed_cache (id, plan_id, created_at, json) VALUES (?, ?, ?, ?)', [
      item.id,
      planId,
      item.created_at,
      JSON.stringify(item),
    ]);
  }
}

export async function getFeedCache(planId: string): Promise<ActivityItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ json: string }>(
    'SELECT json FROM feed_cache WHERE plan_id = ? ORDER BY created_at DESC',
    [planId]
  );
  return rows.map((r) => JSON.parse(r.json));
}

export async function enqueueSyncAction(item: SyncQueueItem) {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO sync_queue (queue_id, facility_id, action, payload_json, created_at) VALUES (?, ?, ?, ?, ?)',
    [item.queue_id, item.facility_id, item.action, item.payload_json, item.created_at]
  );
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await getDb();
  return db.getAllAsync<SyncQueueItem>('SELECT * FROM sync_queue ORDER BY created_at ASC');
}

export async function removeSyncQueueItem(queueId: string) {
  const db = await getDb();
  await db.runAsync('DELETE FROM sync_queue WHERE queue_id = ?', [queueId]);
}
