/**
 * FILE: offline/page.js
 * PURPOSE: Offline fallback page shown when the user navigates
 *          to a page that isn't cached while offline.
 */

'use client';

import { useState, useEffect } from 'react';

export default function OfflinePage() {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    async function loadCount() {
      try {
        const { getPendingCount } = await import('@/lib/offline/offlineStore');
        const count = await getPendingCount();
        setPendingCount(count);
      } catch {}
    }
    loadCount();

    const handleOnline = () => {
      // Reload when back online to get fresh content
      window.location.reload();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  return (
    <div style={{
      minHeight: '100vh', background: '#0F172A', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        fontSize: 64, marginBottom: 16,
        animation: 'pulse 2s ease-in-out infinite',
      }}>📡</div>

      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#F1F5F9', margin: '0 0 8px' }}>
        You&apos;re Offline
      </h1>
      <p style={{ fontSize: 14, color: '#94A3B8', textAlign: 'center', margin: '0 0 24px', maxWidth: 320 }}>
        No internet connection detected. Don&apos;t worry — Sahaay works offline too.
      </p>

      {pendingCount > 0 && (
        <div style={{
          padding: '12px 20px', background: 'rgba(245,158,11,0.1)',
          border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12,
          marginBottom: 20, textAlign: 'center',
        }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#FDE68A', margin: 0 }}>
            {pendingCount} action{pendingCount !== 1 ? 's' : ''} queued
          </p>
          <p style={{ fontSize: 12, color: '#94A3B8', margin: '4px 0 0' }}>
            Will auto-sync when you&apos;re back online
          </p>
        </div>
      )}

      <div style={{
        display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 320,
      }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', margin: '0 0 4px' }}>
          Available Offline
        </p>
        {[
          { icon: '📱', label: 'View your QR Card', href: '/register' },
          { icon: '🗺️', label: 'Disaster Map (cached)', href: '/flood-prediction' },
          { icon: '🔍', label: 'Report Missing Person', href: '/report-missing' },
        ].map((item, i) => (
          <a key={i} href={item.href} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 16px', background: '#1E293B', borderRadius: 10,
            border: '1px solid #334155', textDecoration: 'none',
          }}>
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#E2E8F0' }}>{item.label}</span>
          </a>
        ))}
      </div>

      <p style={{ fontSize: 11, color: '#475569', marginTop: 32, textAlign: 'center' }}>
        This page will auto-reload when internet returns
      </p>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.95); }
        }
      `}</style>
    </div>
  );
}
