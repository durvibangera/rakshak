/**
 * FILE: OfflineBanner.js
 * PURPOSE: Connection status indicator with sync progress.
 *          Shows offline warning, pending action count, and sync controls.
 *
 * ROLE ACCESS: ALL
 */

'use client';

import { useEffect, useState } from 'react';
import { useOfflineSync } from '@/hooks/useOfflineSync';

export default function OfflineBanner() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    isOnline,
    isSyncing,
    pendingCount,
    connectionStatus,
    syncNow,
  } = useOfflineSync();

  // Prevent server/client markup mismatch during hydration.
  if (!mounted) return null;

  // State: fully online with nothing pending — hide banner
  if (isOnline && pendingCount === 0 && !isSyncing) return null;

  const isOffline = !isOnline;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      fontFamily: 'system-ui, sans-serif',
      fontSize: 13,
      fontWeight: 600,
      background: isOffline
        ? 'linear-gradient(135deg, #92400E, #78350F)'
        : isSyncing
          ? 'linear-gradient(135deg, #1E40AF, #1E3A8A)'
          : 'linear-gradient(135deg, #065F46, #064E3B)',
      color: '#FFF',
      borderTop: `1px solid ${isOffline ? '#F59E0B' : isSyncing ? '#3B82F6' : '#10B981'}`,
      boxShadow: '0 -2px 12px rgba(0,0,0,0.3)',
      transition: 'all 0.3s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Status icon */}
        <span style={{ fontSize: 16 }}>
          {isOffline ? '📡' : isSyncing ? '🔄' : '✅'}
        </span>

        <div>
          <p style={{ margin: 0, lineHeight: 1.3 }}>
            {isOffline
              ? 'You are offline'
              : isSyncing
                ? 'Syncing...'
                : 'Back online'}
          </p>
          {pendingCount > 0 && (
            <p style={{ margin: 0, fontSize: 11, opacity: 0.85, fontWeight: 400 }}>
              {pendingCount} action{pendingCount !== 1 ? 's' : ''} queued
              {isOffline ? ' — will sync when online' : ''}
            </p>
          )}
        </div>
      </div>

      {/* Sync button (only when online with pending items) */}
      {isOnline && pendingCount > 0 && !isSyncing && (
        <button
          onClick={syncNow}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: '1px solid rgba(255,255,255,0.3)',
            color: '#FFF',
            padding: '6px 14px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Sync Now
        </button>
      )}

      {/* Syncing spinner */}
      {isSyncing && (
        <div style={{
          width: 20, height: 20, border: '2px solid rgba(255,255,255,0.3)',
          borderTopColor: '#FFF', borderRadius: '50%',
          animation: 'offlineSpin 0.8s linear infinite',
        }} />
      )}

      <style>{`
        @keyframes offlineSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
