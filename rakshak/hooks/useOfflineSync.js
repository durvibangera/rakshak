'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useOfflineStatus } from './useOfflineStatus';

export function useOfflineSync(campId = null) {
  const { isOnline } = useOfflineStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState(null);
  const [lastPrefetch, setLastPrefetch] = useState(null);
  const syncingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    try {
      const { getPendingCount } = await import('@/lib/offline/offlineStore');
      const count = await getPendingCount();
      setPendingCount(count);
    } catch {
      setPendingCount(0);
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (syncingRef.current || !isOnline) return;
    syncingRef.current = true;
    setIsSyncing(true);

    try {
      const { syncAll } = await import('@/lib/offline/syncEngine');
      const result = await syncAll((progress) => {
        setPendingCount(progress.total - progress.synced);
      });
      setLastSync(new Date().toISOString());
      await refreshCount();
      return result;
    } catch (err) {
      console.error('[OfflineSync] Sync failed:', err);
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [isOnline, refreshCount]);

  // Prefetch data for offline use when online
  const prefetch = useCallback(async () => {
    if (!isOnline) return;
    try {
      const { prefetchForOffline } = await import('@/lib/offline/syncEngine');
      await prefetchForOffline(campId);
      setLastPrefetch(new Date().toISOString());
    } catch (err) {
      console.error('[OfflineSync] Prefetch failed:', err);
    }
  }, [isOnline, campId]);

  // Load pending count on mount
  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !syncingRef.current) {
      syncNow();
    }
  }, [isOnline, pendingCount, syncNow]);

  // Immediately sync when browser regains connectivity.
  useEffect(() => {
    const handleOnline = async () => {
      await refreshCount();
      if (!syncingRef.current) syncNow();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      return () => window.removeEventListener('online', handleOnline);
    }
  }, [refreshCount, syncNow]);

  // React to new queued actions (even if queue was updated outside this hook).
  useEffect(() => {
    const handleQueueUpdated = async () => {
      await refreshCount();
      if (navigator.onLine && !syncingRef.current) syncNow();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('sahaay:queue-updated', handleQueueUpdated);
      return () => window.removeEventListener('sahaay:queue-updated', handleQueueUpdated);
    }
  }, [refreshCount, syncNow]);

  // Prefetch when online (once per session)
  useEffect(() => {
    if (isOnline && !lastPrefetch) {
      // Prefetch after a short delay to not block initial render
      const timer = setTimeout(() => prefetch(), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, lastPrefetch, prefetch]);

  // Listen for SW sync messages
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const handleMessage = (event) => {
      if (event.data?.type === 'SYNC_REQUESTED') {
        syncNow();
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, [syncNow]);

  const connectionStatus = isSyncing ? 'syncing' : isOnline ? 'online' : 'offline';

  return {
    isOnline,
    isSyncing,
    pendingCount,
    lastSync,
    lastPrefetch,
    connectionStatus,
    syncNow,
    prefetch,
    refreshCount,
  };
}
