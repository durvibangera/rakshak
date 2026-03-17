'use client';

import {
  getPendingActions, markSynced, getPendingCount,
  cacheAlerts, cacheCamp, cacheMissingReports, cacheResources,
  setMeta,
} from './offlineStore';

/**
 * Sync all pending offline actions to the server.
 * Processes in FIFO order. Marks each as synced on success.
 */
export async function syncAll(onProgress) {
  const pending = await getPendingActions();
  if (pending.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const action of pending) {
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      });

      if (res.ok) {
        await markSynced(action.id);
        synced++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }

    if (onProgress) {
      onProgress({ synced, failed, total: pending.length });
    }
  }

  return { synced, failed, total: pending.length };
}

/**
 * Prefetch and cache data for offline use.
 * Called when online to build up the offline cache.
 */
export async function prefetchForOffline(campId) {
  const tasks = [];

  // Cache alerts
  tasks.push(
    fetch('/api/alerts')
      .then(r => r.json())
      .then(d => {
        const alerts = Array.isArray(d) ? d : d.alerts || [];
        return cacheAlerts(alerts);
      })
      .catch(() => {})
  );

  // Cache camps
  tasks.push(
    fetch('/api/camps')
      .then(r => r.json())
      .then(d => {
        const camps = d.camps || [];
        return Promise.all(camps.map(c => cacheCamp(c)));
      })
      .catch(() => {})
  );

  // Cache missing reports (active only)
  tasks.push(
    fetch('/api/missing-reports?status=active')
      .then(r => r.json())
      .then(d => {
        const reports = d.reports || [];
        return cacheMissingReports(reports);
      })
      .catch(() => {})
  );

  // Cache camp resources if camp_id is known
  if (campId) {
    tasks.push(
      fetch(`/api/camp-resources?camp_id=${campId}`)
        .then(r => r.json())
        .then(d => {
          if (d.resources) return cacheResources([d.resources]);
        })
        .catch(() => {})
    );
  }

  await Promise.allSettled(tasks);
  await setMeta('last_prefetch', new Date().toISOString());
}

/**
 * Register for background sync if the browser supports it.
 */
export async function registerBackgroundSync() {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.sync.register('sahaay-sync');
    } catch (err) {
      console.warn('[SyncEngine] Background sync registration failed:', err);
    }
  }
}

export { getPendingCount };
