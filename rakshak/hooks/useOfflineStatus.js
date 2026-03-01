/**
 * FILE: useOfflineStatus.js
 * PURPOSE: Detect online/offline browser state for offline-first functionality.
 *
 * CONTEXT: Disaster victims often have intermittent or zero connectivity.
 *          This hook tracks the browser's online/offline state and triggers
 *          the OfflineBanner component. When offline, the app falls back to
 *          cached camp data and queues actions for sync when back online.
 *
 * ROLE ACCESS: BOTH
 *
 * EXPORTS:
 *   - useOfflineStatus: Hook returning { isOnline, isOffline }
 *
 * KEY DEPENDENCIES: None (browser API only)
 *
 * TODO:
 *   [x] Listen to window 'online'/'offline' events
 *   [ ] Queue failed API calls for retry when back online
 *   [ ] Trigger data sync on reconnection
 */

'use client';

import { useState, useEffect } from 'react';

/**
 * Track browser online/offline state.
 * @returns {{ isOnline: boolean, isOffline: boolean }}
 */
export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof window !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
  };
}
