/**
 * FILE: offlineFetch.js
 * PURPOSE: Drop-in fetch wrapper that handles offline scenarios.
 *
 * BEHAVIOR:
 *   GET requests  → Try network first, fall back to SW cache / IndexedDB
 *   POST/PUT      → Try network first, queue to IndexedDB on failure
 *                   and register background sync
 *
 * USAGE:
 *   import { offlineFetch } from '@/lib/offline/offlineFetch';
 *   const data = await offlineFetch('/api/camps', { method: 'GET' });
 *   await offlineFetch('/api/sync', { method: 'POST', body: JSON.stringify(payload) });
 */

'use client';

import { addToQueue } from './offlineStore';
import { registerBackgroundSync } from './syncEngine';

/**
 * Offline-aware fetch wrapper.
 *
 * @param {string} url - The URL to fetch
 * @param {RequestInit} options - Standard fetch options
 * @param {Object} queueMeta - Extra metadata if this should be queued offline
 * @param {string} queueMeta.action_type - Sync action type (e.g., 'register_victim')
 * @param {string} [queueMeta.camp_id] - Associated camp ID
 * @returns {Promise<Response | { queued: true, offline: true }>}
 */
export async function offlineFetch(url, options = {}, queueMeta = null) {
  const method = (options.method || 'GET').toUpperCase();

  // ─── GET: network-first, cache fallback ────────────
  if (method === 'GET') {
    try {
      const res = await fetch(url, options);
      return res;
    } catch {
      // The service worker should return cached responses,
      // but if even that fails, we return an offline indicator
      return new Response(
        JSON.stringify({ error: 'Offline', offline: true }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // ─── POST/PUT: try network, queue if offline ───────
  try {
    const res = await fetch(url, options);
    return res;
  } catch {
    // Network failed — queue action for later sync
    if (queueMeta?.action_type) {
      let payload = {};
      try {
        payload = JSON.parse(options.body || '{}');
      } catch {
        payload = {};
      }

      await addToQueue({
        action_type: queueMeta.action_type,
        camp_id: queueMeta.camp_id || null,
        payload,
      });

      // Try to register background sync
      await registerBackgroundSync().catch(() => {});

      return {
        ok: true,
        queued: true,
        offline: true,
        json: async () => ({ success: true, queued: true, offline: true }),
      };
    }

    // No queue metadata — just throw
    throw new Error('Network request failed and no offline queue configured');
  }
}

/**
 * Convenience: queue an action directly (for when you know you're offline)
 */
export async function queueOfflineAction(actionType, payload, campId = null) {
  await addToQueue({
    action_type: actionType,
    camp_id: campId,
    payload,
  });
  await registerBackgroundSync().catch(() => {});
}
