'use client';

import { openDB } from 'idb';

const DB_NAME = 'sahaay_offline';
const DB_VERSION = 2;

const STORES = {
  QUEUE: 'sync_queue',
  VICTIMS: 'victims_cache',
  CAMPS: 'camps_cache',
  ALERTS: 'alerts_cache',
  MISSING: 'missing_cache',
  RESOURCES: 'resources_cache',
  UNIDENTIFIED: 'unidentified_cache',
  META: 'meta',
};

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // v1 stores
      if (!db.objectStoreNames.contains(STORES.QUEUE)) {
        const queue = db.createObjectStore(STORES.QUEUE, { keyPath: 'id', autoIncrement: true });
        queue.createIndex('synced', 'synced');
        queue.createIndex('created_at', 'created_at');
      }
      if (!db.objectStoreNames.contains(STORES.VICTIMS)) {
        db.createObjectStore(STORES.VICTIMS, { keyPath: 'localId' });
      }
      if (!db.objectStoreNames.contains(STORES.CAMPS)) {
        db.createObjectStore(STORES.CAMPS, { keyPath: 'id' });
      }

      // v2 stores — additional caches for offline-first
      if (!db.objectStoreNames.contains(STORES.ALERTS)) {
        db.createObjectStore(STORES.ALERTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.MISSING)) {
        const missing = db.createObjectStore(STORES.MISSING, { keyPath: 'id' });
        missing.createIndex('status', 'status');
      }
      if (!db.objectStoreNames.contains(STORES.RESOURCES)) {
        db.createObjectStore(STORES.RESOURCES, { keyPath: 'camp_id' });
      }
      if (!db.objectStoreNames.contains(STORES.UNIDENTIFIED)) {
        db.createObjectStore(STORES.UNIDENTIFIED, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.META)) {
        db.createObjectStore(STORES.META, { keyPath: 'key' });
      }
    },
  });
}

export async function addToQueue(action) {
  const db = await getDB();
  const entry = {
    ...action,
    synced: false,
    created_at: new Date().toISOString(),
  };
  return db.add(STORES.QUEUE, entry);
}

export async function getPendingActions() {
  const db = await getDB();
  const tx = db.transaction(STORES.QUEUE, 'readonly');
  const index = tx.store.index('synced');
  return index.getAll(false);
}

export async function markSynced(id) {
  const db = await getDB();
  const tx = db.transaction(STORES.QUEUE, 'readwrite');
  const item = await tx.store.get(id);
  if (item) {
    item.synced = true;
    item.synced_at = new Date().toISOString();
    await tx.store.put(item);
  }
  await tx.done;
}

export async function getPendingCount() {
  const db = await getDB();
  const tx = db.transaction(STORES.QUEUE, 'readonly');
  const index = tx.store.index('synced');
  return index.count(false);
}

export async function clearSynced() {
  const db = await getDB();
  const tx = db.transaction(STORES.QUEUE, 'readwrite');
  const index = tx.store.index('synced');
  let cursor = await index.openCursor(true);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function cacheVictim(victim) {
  const db = await getDB();
  return db.put(STORES.VICTIMS, victim);
}

export async function getCachedVictims() {
  const db = await getDB();
  return db.getAll(STORES.VICTIMS);
}

export async function cacheCamp(camp) {
  const db = await getDB();
  return db.put(STORES.CAMPS, camp);
}

export async function getCachedCamp(id) {
  const db = await getDB();
  return db.get(STORES.CAMPS, id);
}

// ─── ALERTS CACHE ────────────────────────────────────────────
export async function cacheAlerts(alerts) {
  const db = await getDB();
  const tx = db.transaction(STORES.ALERTS, 'readwrite');
  for (const alert of alerts) {
    await tx.store.put(alert);
  }
  await tx.done;
}

export async function getCachedAlerts() {
  const db = await getDB();
  return db.getAll(STORES.ALERTS);
}

// ─── MISSING REPORTS CACHE ──────────────────────────────────
export async function cacheMissingReports(reports) {
  const db = await getDB();
  const tx = db.transaction(STORES.MISSING, 'readwrite');
  for (const report of reports) {
    await tx.store.put(report);
  }
  await tx.done;
}

export async function getCachedMissingReports() {
  const db = await getDB();
  return db.getAll(STORES.MISSING);
}

// ─── RESOURCES CACHE ────────────────────────────────────────
export async function cacheResources(resources) {
  const db = await getDB();
  const tx = db.transaction(STORES.RESOURCES, 'readwrite');
  for (const r of resources) {
    await tx.store.put({ ...r, camp_id: r.camp_id || r.id });
  }
  await tx.done;
}

export async function getCachedResources(campId) {
  const db = await getDB();
  if (campId) return db.get(STORES.RESOURCES, campId);
  return db.getAll(STORES.RESOURCES);
}

// ─── UNIDENTIFIED CACHE ─────────────────────────────────────
export async function cacheUnidentified(persons) {
  const db = await getDB();
  const tx = db.transaction(STORES.UNIDENTIFIED, 'readwrite');
  for (const p of persons) {
    await tx.store.put(p);
  }
  await tx.done;
}

export async function getCachedUnidentified() {
  const db = await getDB();
  return db.getAll(STORES.UNIDENTIFIED);
}

// ─── META (last sync times, etc.) ────────────────────────────
export async function setMeta(key, value) {
  const db = await getDB();
  await db.put(STORES.META, { key, value, updated_at: new Date().toISOString() });
}

export async function getMeta(key) {
  const db = await getDB();
  const entry = await db.get(STORES.META, key);
  return entry?.value || null;
}

export { STORES };
